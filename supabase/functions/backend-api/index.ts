import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildPrompt(jobType: string, text: string): string {
  const truncated = text.substring(0, 50000);
  if (jobType === "flashcards") {
    return `Generate an exhaustive JSON array of flashcards from this material. Each object must have exactly: "front" (term/concept), "back" (concise definition, max 2 sentences), and "options" (array of exactly 4 strings — the correct answer plus 3 plausible distractors). Output ONLY the raw JSON array, no markdown.\n\n${truncated}`;
  } else if (jobType === "quiz") {
    return `Generate a JSON array of quiz questions from this material. Each object must have: "question", "answer", "options" (array of 4 strings), "explanation". Output ONLY raw JSON array.\n\n${truncated}`;
  } else if (jobType === "reviewer") {
    return `Generate a comprehensive, well-structured markdown study guide from this material. Use headings, bullet points, and key terms. Be thorough.\n\n${truncated}`;
  } else if (jobType === "test") {
    return `Generate a JSON array of test questions from this material. Each object must have: "question", "answer_type" ("single" or "multiple"), "options" (array of strings), "correct_options" (array of correct option strings), "explanation". Output ONLY raw JSON array.\n\n${truncated}`;
  }
  return text;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 65536 }
      })
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini error ${res.status}: ${body.substring(0, 200)}`);
  }
  const json = await res.json();
  return json.candidates[0].content.parts[0].text;
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "mixtral-8x7b-32768",
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq error ${res.status}: ${body.substring(0, 200)}`);
  }
  const json = await res.json();
  return json.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const defaultGeminiKey = Deno.env.get("GEMINI_API_KEY");
  const fallbackGroqKey = Deno.env.get("GROK_API_KEY");

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const textContent = formData.get("text_content") as string;
    const personalApiKey = formData.get("personal_api_key") as string | null;
    const jobTypesRaw = formData.get("job_types") as string;
    const jobTypes: string[] = JSON.parse(jobTypesRaw || '["flashcards"]');

    if (!textContent || textContent.trim().length < 10) {
      throw new Error("Missing or empty text_content");
    }

    // 1. Hash the content for cache key
    const msgBuffer = new TextEncoder().encode(textContent);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const fileHash = bufferToHex(hashBuffer);

    // 2. Check cache
    const { data: existingCache } = await supabase
      .from("file_cache")
      .select("*")
      .eq("file_hash", fileHash)
      .single();

    if (existingCache) {
      // Check if all requested job types are already cached
      const allCached = jobTypes.every(t => existingCache[`${t}_result`] !== null);
      if (allCached) {
        return new Response(JSON.stringify({ fileHash, cachedData: existingCache }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 3. Upload file to storage (upsert — safe to call again)
    const storagePath = fileHash + ".txt";
    await supabase.storage
      .from("learning_materials")
      .upload(storagePath, textContent, { contentType: "text/plain", upsert: true });

    // 4. Ensure cache row exists
    if (!existingCache) {
      await supabase.from("file_cache").insert({ file_hash: fileHash, storage_path: storagePath });
    }

    // 5. Process each requested job type (AI Router → Gemini → Groq fallback)
    const primaryKey = personalApiKey || defaultGeminiKey;
    const results: Record<string, any> = {};

    for (const jobType of jobTypes) {
      // Skip if already cached
      if (existingCache && existingCache[`${jobType}_result`] !== null) {
        results[`${jobType}_result`] = existingCache[`${jobType}_result`];
        continue;
      }

      const prompt = buildPrompt(jobType, textContent);
      let rawText = "";

      try {
        if (!primaryKey) throw new Error("No Gemini API key configured");
        rawText = await callGemini(prompt, primaryKey);
      } catch (geminiErr: any) {
        console.warn(`Gemini failed (${geminiErr.message}), trying Groq fallback...`);
        if (!fallbackGroqKey) throw new Error("Gemini failed and no Groq fallback key set: " + geminiErr.message);
        rawText = await callGroq(prompt, fallbackGroqKey);
      }

      // Parse JSON for non-reviewer types
      let result: any = rawText;
      if (jobType !== "reviewer") {
        const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        try { result = JSON.parse(cleaned); } catch { result = cleaned; }
      }

      results[`${jobType}_result`] = result;
    }

    // 6. Save results to cache
    const { data: updatedCache } = await supabase
      .from("file_cache")
      .update(results)
      .eq("file_hash", fileHash)
      .select("*")
      .single();

    return new Response(JSON.stringify({
      fileHash,
      cachedData: updatedCache
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[backend-api] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
