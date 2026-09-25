import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert ArrayBuffer to hex string without encodeHex
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const textContent = formData.get("text_content") as string;
    const personalApiKey = formData.get("personal_api_key") as string | null;
    const jobTypesRaw = formData.get("job_types") as string;
    const jobTypes: string[] = JSON.parse(jobTypesRaw || '["flashcards"]');

    if (!textContent) throw new Error("Missing text_content");

    // Hash the content to use as cache key
    const messageBuffer = new TextEncoder().encode(textContent);
    const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
    const fileHash = bufferToHex(hashBuffer);

    // Check cache first
    const { data: existingCache, error: cacheCheckError } = await supabase
      .from("file_cache")
      .select("*")
      .eq("file_hash", fileHash)
      .single();

    // PGRST116 = row not found, which is expected on cache miss
    if (cacheCheckError && cacheCheckError.code !== "PGRST116") {
      throw new Error("Cache check failed: " + cacheCheckError.message);
    }

    // Cache hit — return existing data immediately
    if (existingCache) {
      return new Response(JSON.stringify({
        message: "Cache hit",
        fileHash,
        cachedData: existingCache
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cache miss — store the file
    const storagePath = fileHash + ".txt";
    const { error: storageError } = await supabase.storage
      .from("learning_materials")
      .upload(storagePath, textContent, { contentType: "text/plain", upsert: true });

    if (storageError) throw new Error("Storage upload failed: " + storageError.message);

    // Create cache entry
    const { error: insertCacheError } = await supabase
      .from("file_cache")
      .insert({ file_hash: fileHash, storage_path: storagePath });

    if (insertCacheError) throw new Error("Cache insert failed: " + insertCacheError.message);

    // Queue the jobs
    const jobsToInsert = jobTypes.map((type: string) => ({
      file_hash: fileHash,
      job_type: type,
      personal_api_key: personalApiKey || null,
      status: "pending"
    }));

    const { error: jobsError } = await supabase
      .from("job_queue")
      .insert(jobsToInsert);

    if (jobsError) throw new Error("Job queue insert failed: " + jobsError.message);

    // Fire-and-forget: wake up the AI worker
    fetch(supabaseUrl + "/functions/v1/ai-worker", {
      method: "POST",
      headers: { "Authorization": "Bearer " + supabaseKey }
    }).catch(err => console.error("Failed to trigger ai-worker:", err));

    return new Response(JSON.stringify({
      message: "Jobs queued successfully",
      fileHash,
      status: "processing"
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[backend-api] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
