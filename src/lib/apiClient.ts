/**
 * API Client — talks to the Supabase backend-api Edge Function.
 * The Edge Function runs AI generation synchronously and returns results directly.
 * No polling needed.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function generateWithBackend(
  textContent: string,
  jobTypes: string[],
  personalApiKey?: string | null
): Promise<{ fileHash: string; cachedData: Record<string, any> }> {
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

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Backend API error: ${res.status} ${res.statusText}`);
  }

  return data;
}

// Keep old names as aliases so existing imports don't break
export const uploadAndQueueJob = generateWithBackend;

/** @deprecated — no longer needed, kept for safety */
export async function pollCacheForResult(
  _supabase: any,
  _fileHash: string,
  _jobType: string,
): Promise<any> {
  throw new Error('pollCacheForResult is deprecated — results are now returned directly from generateWithBackend.');
}
