import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: jobs, error: claimError } = await supabase.rpc("claim_next_job", { worker_id: "worker-1" });
    
    if (claimError) throw claimError;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No jobs in queue" }), { headers: corsHeaders });
    }

    const job = jobs[0];
    
    try {
      const { data: cacheData } = await supabase.from("file_cache").select("storage_path").eq("file_hash", job.file_hash).single();
      if (!cacheData) throw new Error("File Cache entry missing");

      const { data: fileData, error: fileError } = await supabase.storage.from("learning_materials").download(cacheData.storage_path);
      if (fileError || !fileData) throw new Error("Failed to download file from storage");

      const textContent = await fileData.text();
      const truncatedText = textContent.substring(0, 50000);

      const defaultApiKey = Deno.env.get("GEMINI_API_KEY");
      const fallbackApiKey = Deno.env.get("GROK_API_KEY");
      
      const apiKeyToUse = job.personal_api_key || defaultApiKey;
      if (!apiKeyToUse) throw new Error("No primary API key available");

      let prompt = "";
      if (job.job_type === "flashcards") {
        prompt = "Generate a JSON array of flashcards with 'front', 'back', and 'options' (array of 4 strings) from this material:\n" + truncatedText;
      } else if (job.job_type === "quiz") {
        prompt = "Generate a JSON array of quiz questions with 'question', 'answer', 'options', and 'explanation' from this material:\n" + truncatedText;
      } else if (job.job_type === "reviewer") {
        prompt = "Generate a detailed markdown study guide from this material:\n" + truncatedText;
      } else if (job.job_type === "test") {
        prompt = "Generate a JSON array of test questions from this material:\n" + truncatedText;
      }

      await delay(1000);

      let resultData: any;
      try {
        const geminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKeyToUse, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
        });
        
        if (!geminiRes.ok) throw new Error("Gemini API Error: " + geminiRes.statusText);
        const geminiJson = await geminiRes.json();
        resultData = geminiJson.candidates[0].content.parts[0].text;
        
      } catch (geminiError: any) {
        console.warn("Primary AI Failed: " + geminiError.message + ". Routing to Fallback AI Provider...");
        if (!fallbackApiKey) throw new Error("Primary failed and no Fallback API key provided");
        
        const fallbackRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + fallbackApiKey },
          body: JSON.stringify({ model: "mixtral-8x7b-32768", messages: [{ role: "user", content: prompt }] })
        });
        
        if (!fallbackRes.ok) throw new Error("Fallback API Error: " + fallbackRes.statusText);
        const fallbackJson = await fallbackRes.json();
        resultData = fallbackJson.choices[0].message.content;
      }

      if (job.job_type !== "reviewer") {
         resultData = resultData.replace(/`json/g, "").replace(/`/g, "").trim();
         try { resultData = JSON.parse(resultData); } catch (e) { /* ignore */ }
      }

      const cacheColumn = job.job_type + "_result";
      await supabase.from("file_cache").update({ [cacheColumn]: resultData }).eq("file_hash", job.file_hash);

      await supabase.from("job_queue").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", job.id);

      fetch(supabaseUrl + "/functions/v1/ai-worker", { method: "POST", headers: { "Authorization": "Bearer " + supabaseKey } }).catch(() => {});

      return new Response(JSON.stringify({ message: "Job processed successfully", job_id: job.id }), { headers: corsHeaders });

    } catch (jobError: any) {
      console.error("Job processing failed:", jobError);
      await supabase.from("job_queue").update({ 
        status: "failed", 
        error_message: jobError.message,
        updated_at: new Date().toISOString() 
      }).eq("id", job.id);
      
      return new Response(JSON.stringify({ error: jobError.message }), { status: 500, headers: corsHeaders });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: corsHeaders });
  }
});
