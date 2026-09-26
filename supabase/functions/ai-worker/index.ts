import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildPrompt(jobType: string, text: string): string {
  const t = text.substring(0, 50000);
  if (jobType === "flashcards") {
    return `Generate an exhaustive JSON object {"data": [...]} of flashcards. Each item must have: "front" (term/concept), "back" (definition max 2 sentences), "options" (array of exactly 4 strings: correct answer + 3 distractors). Output ONLY the JSON object, no markdown or explanation.\n\n${t}`;
  } else if (jobType === "quiz") {
    return `Generate an exhaustive JSON object {"data": [...]} of quiz questions that thoroughly covers ALL facts, terms, and concepts in the text (generate 20-40 questions depending on text length). Each item: "question", "answer", "options" (4 strings), "explanation". Output ONLY the JSON object.\\n\\n${t}`;
  } else if (jobType === "reviewer") {
    return `Generate a concise, highly dense markdown cheat sheet summarizing the core concepts. Do NOT include a table of contents, introduction, or high-level overview. Jump straight into the facts, definitions, and key terms using bullet points and concise tables. Keep it dense and straight to the point without fluff.\\n\\n${t}`;
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
    throw new Error(`AI output not parseable as JSON. Preview: ${rawText.substring(0, 150)}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const defaultGeminiKey = Deno.env.get("GEMINI_API_KEY");
  const fallbackGroqKey = Deno.env.get("GROK_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Claim one pending job atomically
  const { data: jobs, error: claimErr } = await supabase.rpc("claim_next_job", { worker_id: crypto.randomUUID() });
  if (claimErr) {
    console.error("[ai-worker] claim error:", claimErr.message);
    return new Response(JSON.stringify({ error: claimErr.message }), { status: 500, headers: corsHeaders });
  }
  if (!jobs || jobs.length === 0) {
    return new Response(JSON.stringify({ message: "No jobs available" }), { headers: corsHeaders });
  }

  const job = jobs[0];
  console.log(`[ai-worker] claimed job ${job.id} type=${job.job_type}`);

  try {
    // 2. Load text from storage
    const { data: cacheRow } = await supabase
      .from("file_cache").select("storage_path").eq("file_hash", job.file_hash).single();
    if (!cacheRow) throw new Error("file_cache row missing");

    const { data: fileBlob, error: fileErr } = await supabase.storage
      .from("learning_materials").download(cacheRow.storage_path);
    if (fileErr || !fileBlob) throw new Error("Storage download failed: " + fileErr?.message);
    const textContent = await fileBlob.text();

    // 3. API key selection
    const apiKey = job.personal_api_key || defaultGeminiKey;
    if (!apiKey) throw new Error("No API key available (no personal key and GEMINI_API_KEY not set)");

    // 4. Rate limiter — only for shared key
    if (!job.personal_api_key) {
      const { data: waitMs } = await supabase.rpc("acquire_rate_limit_slot", { min_interval_ms: 2000 });
      if (waitMs && waitMs > 0) {
        console.log(`[ai-worker] rate limiter: sleeping ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }

    // 5. Call AI (Gemini → Groq fallback)
    const prompt = buildPrompt(job.job_type, textContent);
    let rawText: string;

    try {
      const gRes = await fetch(
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
      if (!gRes.ok) throw new Error(`Gemini ${gRes.status}: ${(await gRes.text()).substring(0, 200)}`);
      const gJson = await gRes.json();
      rawText = gJson.candidates[0].content.parts[0].text;
    } catch (gemErr: unknown) {
      const gemMsg = gemErr instanceof Error ? gemErr.message : String(gemErr);
      console.warn(`[ai-worker] Gemini failed (${gemMsg}), trying Groq`);
      if (!fallbackGroqKey) throw new Error("Gemini failed, no Groq key: " + gemMsg);

      const qRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${fallbackGroqKey}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          ...(job.job_type === "reviewer" ? {} : { response_format: { type: "json_object" } }),
          max_tokens: 8000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!qRes.ok) throw new Error(`Groq ${qRes.status}: ${(await qRes.text()).substring(0, 200)}`);
      const qJson = await qRes.json();
      rawText = qJson.choices[0].message.content;
    }

    // 6. Parse + save
    const result = parseResult(rawText, job.job_type);
    const col = `${job.job_type}_result`;
    await supabase.from("file_cache").update({ [col]: result }).eq("file_hash", job.file_hash);
    await supabase.from("job_queue")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", job.id);

    console.log(`[ai-worker] job ${job.id} done`);
    return new Response(JSON.stringify({ ok: true, job_id: job.id }), { headers: corsHeaders });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ai-worker] job ${job.id} failed:`, msg);
    await supabase.from("job_queue")
      .update({ status: "failed", error_message: msg, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});



