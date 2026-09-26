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
  const t = text.substring(0, 50000);
  if (jobType === "flashcards") {
    return `Generate an exhaustive JSON object {"data": [...]} of flashcards. Each item: "front" (term), "back" (definition max 2 sentences), "options" (array of exactly 4 strings: correct answer + 3 distractors). Output ONLY the JSON object, no markdown.\n\n${t}`;
  } else if (jobType === "quiz") {
    return `Generate a JSON object {"data": [...]} of quiz questions. Each item: "question", "answer", "options" (4 strings), "explanation". Output ONLY the JSON object.\n\n${t}`;
  } else if (jobType === "reviewer") {
    return `Generate a comprehensive markdown study guide. Use headings, bullet points, key terms.\n\n${t}`;
  } else {
    return `Generate a JSON object {"data": [...]} of test questions. Each item: "question", "answer_type" ("single" or "multiple"), "options" (array of strings), "correct_options" (array of correct strings), "explanation". Output ONLY the JSON object.\n\n${t}`;
  }
}

function parseResult(rawText: string, jobType: string): unknown {
  if (jobType === "reviewer") return rawText;
  const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    const p = JSON.parse(cleaned);
    return Array.isArray(p) ? p : (p.data ?? p);
  } catch {
    const m = rawText.match(/\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* fall */ } }
    throw new Error(`AI output not parseable. Preview: ${rawText.substring(0, 150)}`);
  }
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 65536 }
      })
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).substring(0, 200)}`);
  const json = await res.json();
  return json.candidates[0].content.parts[0].text;
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      ...(jobType === "reviewer" ? {} : { response_format: { type: "json_object" } }),
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).substring(0, 200)}`);
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
    const personalApiKey = (formData.get("personal_api_key") as string | null) || null;
    const jobTypesRaw = formData.get("job_types") as string;
    const jobTypes: string[] = JSON.parse(jobTypesRaw || '["flashcards"]');

    if (!textContent || textContent.trim().length < 10) {
      throw new Error("Missing or empty text_content");
    }

    // 1. Hash
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(textContent));
    const fileHash = bufferToHex(hashBuffer);

    // 2. Cache check
    const { data: existingCache } = await supabase
      .from("file_cache").select("*").eq("file_hash", fileHash).single();

    if (existingCache) {
      const allCached = jobTypes.every(t => existingCache[`${t}_result`] !== null);
      if (allCached) {
        return new Response(JSON.stringify({ fileHash, cachedData: existingCache, fromCache: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 3. Upload to storage
    const storagePath = fileHash + ".txt";
    await supabase.storage.from("learning_materials")
      .upload(storagePath, textContent, { contentType: "text/plain", upsert: true });

    // 4. Ensure file_cache row
    if (!existingCache) {
      await supabase.from("file_cache").insert({ file_hash: fileHash, storage_path: storagePath });
    }

    // ── PATH A: Personal key ─ call AI directly, return result synchronously ──
    if (personalApiKey) {
      const results: Record<string, unknown> = {};
      for (const jobType of jobTypes) {
        if (existingCache && existingCache[`${jobType}_result`] !== null) {
          results[`${jobType}_result`] = existingCache[`${jobType}_result`];
          continue;
        }
        const prompt = buildPrompt(jobType, textContent);
        let rawText: string;
        try {
          rawText = await callGemini(prompt, personalApiKey);
        } catch (gErr: unknown) {
          const gMsg = gErr instanceof Error ? gErr.message : String(gErr);
          if (!fallbackGroqKey) throw new Error("Gemini failed, no Groq key: " + gMsg);
          rawText = await callGroq(prompt, fallbackGroqKey);
        }
        results[`${jobType}_result`] = parseResult(rawText, jobType);
      }
      const { data: updatedCache } = await supabase.from("file_cache")
        .update(results).eq("file_hash", fileHash).select("*").single();
      return new Response(JSON.stringify({ fileHash, cachedData: updatedCache, fromCache: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── PATH B: Shared key ─ insert into job_queue, fire workers, return jobIds ──
    const jobIds: Record<string, string> = {};
    for (const jobType of jobTypes) {
      // Skip already-cached types
      if (existingCache && existingCache[`${jobType}_result`] !== null) {
        jobIds[jobType] = "cached";
        continue;
      }
      const { data: newJob, error: insertErr } = await supabase.from("job_queue")
        .insert({ file_hash: fileHash, job_type: jobType, status: "pending" })
        .select("id").single();
      if (insertErr) throw new Error("job_queue insert failed: " + insertErr.message);
      jobIds[jobType] = newJob.id;
    }

    // Fire both workers simultaneously (fire-and-forget via waitUntil)
    const workerUrl = supabaseUrl + "/functions/v1/ai-worker";
    const workerHeaders = { "Authorization": "Bearer " + supabaseKey, "Content-Type": "application/json" };
    const w1 = fetch(workerUrl, { method: "POST", headers: workerHeaders });
    const w2 = fetch(workerUrl, { method: "POST", headers: workerHeaders });
    // @ts-ignore: EdgeRuntime available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(Promise.allSettled([w1, w2]));
    } else {
      Promise.allSettled([w1, w2]).catch(() => {});
    }

    return new Response(JSON.stringify({ fileHash, jobIds, queued: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backend-api] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});


