/**
 * API Client for interacting with the Supabase Backend API.
 * Replaces direct client-side AI calls.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function uploadAndQueueJob(
  textContent: string, 
  jobTypes: string[], 
  personalApiKey?: string | null
): Promise<{ fileHash: string, cachedData?: any }> {
  const formData = new FormData();
  formData.append('text_content', textContent);
  formData.append('job_types', JSON.stringify(jobTypes));
  if (personalApiKey) {
    formData.append('personal_api_key', personalApiKey);
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/backend-api`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Backend API error: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Polls the file_cache table to check if a specific result column is populated.
 */
export async function pollCacheForResult(
  supabase: any,
  fileHash: string, 
  jobType: string,
  maxWaitMs = 120000
): Promise<any> {
  const column = `${jobType}_result`;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const { data, error } = await supabase
      .from('file_cache')
      .select(column)
      .eq('file_hash', fileHash)
      .single();

    if (!error && data && data[column] !== null) {
      return data[column];
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`Timeout waiting for ${jobType} generation to complete.`);
}
