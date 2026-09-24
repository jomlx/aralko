import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const MAX_CONCURRENT_JOBS = 5;

// AI Provider configurations
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GROK_API_KEY = Deno.env.get('GROK_API_KEY');

const callGemini = async (prompt: string, maxTokens: number = 8192) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: 'You are an expert AI study assistant. Output ONLY valid JSON array or object without markdown wrappers like ```json.' }] },
      generationConfig: { maxOutputTokens: maxTokens }
    })
  });
  
  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.status} ${await response.text()}`);
  }
  
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text;
};

const callGrok = async (prompt: string) => {
  // Assuming standard OpenAI-compatible completions endpoint for Grok (xAI)
  const url = "https://api.x.ai/v1/chat/completions";
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify({
      model: "grok-beta", // or appropriate model
      messages: [
        { role: "system", content: "You are an expert AI study assistant. Output ONLY valid JSON array or object without markdown wrappers." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Grok API Error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Grok");
  return text;
};

const callAIWithFallback = async (prompt: string, maxTokens: number = 8192) => {
  try {
    console.log("Attempting Gemini...");
    return await callGemini(prompt, maxTokens);
  } catch (err: any) {
    console.error("Gemini failed:", err.message);
    if (GROK_API_KEY) {
      console.log("Falling back to Grok...");
      try {
        return await callGrok(prompt);
      } catch (grokErr: any) {
        console.error("Grok fallback also failed:", grokErr.message);
        throw new Error(`Both AI providers failed. Primary: ${err.message}. Fallback: ${grokErr.message}`);
      }
    }
    throw err;
  }
};

const cleanAndParseJSON = (text: string) => {
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
};

// Main Edge Function Handler
Deno.serve(async (req) => {
  // Allow CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Need service role to bypass RLS in the worker
    );

    // 1. Claim a job
    const { data: jobs, error: claimError } = await supabaseClient
      .rpc('claim_next_ai_job', { max_concurrent: MAX_CONCURRENT_JOBS });

    if (claimError) {
      console.error("Claim error:", claimError);
      return new Response(JSON.stringify({ error: claimError.message }), { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending jobs or max concurrency reached" }), { status: 200 });
    }

    const job = jobs[0];
    console.log(`Claimed job: ${job.id} of type ${job.job_type}`);

    try {
      // 2. Fetch the activity to get the source text (notes)
      const { data: activity, error: activityError } = await supabaseClient
        .from('activities')
        .select('notes')
        .eq('id', job.activity_id)
        .single();

      if (activityError || !activity) {
        throw new Error("Activity not found or could not read notes.");
      }

      const sourceText = activity.notes || "";
      let prompt = "";
      let maxTokens = 8192;

      // 3. Build Prompt based on Job Type
      // Note: In reality, we could import the prompts from shared code, but Edge functions are isolated.
      // We will embed the standard prompts here.
      if (job.job_type === 'flashcards') {
        prompt = `Generate a comprehensive list of study flashcards based on the following material. Create enough flashcards to cover all key concepts, definitions, and important details.
Return an array of objects. Each object MUST have:
- "front": string (a clear, specific question or concept)
- "back": string (the detailed answer or definition)
Material:
${sourceText.substring(0, 50000)}`;
        maxTokens = 65536; // Allow long outputs for flashcards
      } 
      else if (job.job_type === 'quiz') {
        prompt = `Generate a multiple-choice quiz based on this study material. Return an array of objects.
Each object MUST have:
- "question": string (the question)
- "answer": string (the exact correct option)
- "options": array of 4 strings (including the correct answer)
- "explanation": string (why it's correct)
Material:
${sourceText.substring(0, 50000)}`;
      } 
      else if (job.job_type === 'reviewer') {
        prompt = `Condense the following notes into a high-yield study reviewer (cheat sheet). Use clear headings, bullet points, and bold text for key terms.
Return ONLY a JSON object with a single field "content" containing the formatted markdown string.
Notes:
${sourceText.substring(0, 50000)}`;
      }
      else if (job.job_type === 'test') {
        prompt = `Generate a rigorous test covering the material. Mix single-answer and multi-select questions.
Return an array of objects. Each MUST have:
- "question": string
- "answer_type": "single" or "multiple"
- "options": array of 4 strings
- "correct_options": array of strings (1 item for single, 2+ for multiple)
- "explanation": string
Material:
${sourceText.substring(0, 50000)}`;
      } else {
        throw new Error(`Unsupported job type: ${job.job_type}`);
      }

      // 4. Call AI
      const rawAiResponse = await callAIWithFallback(prompt, maxTokens);
      const parsedData = cleanAndParseJSON(rawAiResponse);

      // 5. Save Results to AI Jobs Table
      await supabaseClient
        .from('ai_jobs')
        .update({ 
          status: 'completed', 
          result_data: parsedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      // 6. Automatically update the Activity with the new data
      let activityUpdates: any = {};
      if (job.job_type === 'flashcards') {
        activityUpdates.techniqueData = parsedData;
      } else if (job.job_type === 'quiz') {
        activityUpdates.quizData = parsedData;
      } else if (job.job_type === 'reviewer') {
        activityUpdates.reviewerContent = parsedData.content || (typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData));
      } else if (job.job_type === 'test') {
        activityUpdates.testData = parsedData;
      }

      await supabaseClient
        .from('activities')
        .update(activityUpdates)
        .eq('id', job.activity_id);

      // Loop: Trigger itself asynchronously to process the next job in the queue
      fetch(req.url, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization') || '',
        }
      }).catch(e => console.error("Auto-trigger error:", e));

      return new Response(JSON.stringify({ success: true, job_id: job.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (jobError: any) {
      console.error(`Error processing job ${job.id}:`, jobError);
      // Mark job as failed
      await supabaseClient
        .from('ai_jobs')
        .update({ 
          status: 'failed', 
          error_message: jobError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      return new Response(JSON.stringify({ error: jobError.message }), { status: 200 }); // Return 200 so webhook doesn't infinitely retry unless configured
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
