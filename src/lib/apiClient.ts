/**
 * apiClient.ts
 * Talks to the Supabase backend-api Edge Function.
 *
 * PATH A (personal key):  backend-api calls AI directly, returns cachedData synchronously.
 * PATH B (shared key):    backend-api queues job, returns { fileHash, jobIds }.
 *                         We subscribe to the job_queue row via Supabase Realtime and
 *                         resolve when status = "completed", then fetch the cache row.
 */

import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;


export interface GenerationResult {
  fileHash: string;
  cachedData: Record<string, unknown>;
}

/**
 * Main entry point for all AI generation.
 * Personal key → synchronous result.
 * No key → queued job, resolves via Realtime when worker completes.
 */
export async function generateWithBackend(
  textContent: string,
  jobTypes: string[],
  personalApiKey?: string | null,
  timeoutMs = 120_000
): Promise<GenerationResult> {
  const formData = new FormData();
  formData.append('text_content', textContent);
  formData.append('job_types', JSON.stringify(jobTypes));
  if (personalApiKey) formData.append('personal_api_key', personalApiKey);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/backend-api`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error((data.error as string) || `Backend API error: ${res.status}`);
  }

  // PATH A: personal key, result came back directly
  if (data.cachedData && !data.queued) {
    return { fileHash: data.fileHash as string, cachedData: data.cachedData as Record<string, unknown> };
  }

  // PATH B: shared key, job(s) queued — wait via Realtime
  if (data.queued) {
    const fileHash = data.fileHash as string;
    const jobIds = data.jobIds as Record<string, string>;

    // Wait for all non-cached job types to complete
    const pendingJobIds = Object.values(jobIds).filter(id => id !== 'cached');
    if (pendingJobIds.length === 0) {
      // All were already cached — fetch the cache row directly
            const { data: cacheRow } = await supabase.from('file_cache').select('*').eq('file_hash', fileHash).single();
      return { fileHash, cachedData: cacheRow as Record<string, unknown> };
    }

    await Promise.all(pendingJobIds.map(jobId => waitForJob(jobId, timeoutMs)));

    // Fetch final cache row after all jobs complete
        const { data: cacheRow } = await supabase.from('file_cache').select('*').eq('file_hash', fileHash).single();
    if (!cacheRow) throw new Error('Cache row missing after job completion');
    return { fileHash, cachedData: cacheRow as Record<string, unknown> };
  }

  throw new Error('Unexpected backend-api response shape');
}

/**
 * Subscribe to a single job_queue row via Realtime.
 * Resolves when status = completed, rejects on failed or timeout.
 * Fixes the "cannot add callbacks after subscribe()" bug by subscribing
 * BEFORE checking current status.
 */
function waitForJob(jobId: string, timeoutMs: number): Promise<void> {
  
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout>;
    let fallbackHandle: ReturnType<typeof setTimeout>;

    function finish(err?: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      if (typeof fallbackHandle !== 'undefined') clearTimeout(fallbackHandle);
      supabase.removeChannel(channel);
      if (err) reject(new Error(err));
      else resolve();
    }

    // Subscribe FIRST, then check current status (avoids race)
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_queue', filter: `id=eq.${jobId}` },
        (payload: { new: Record<string, unknown> }) => {
          const status = payload.new.status as string;
          if (status === 'completed') finish();
          else if (status === 'failed') finish(String(payload.new.error_message || 'Job failed'));
        }
      )
      .subscribe();

    // After subscribing, poll once for already-completed jobs
    supabase.from('job_queue').select('status, error_message').eq('id', jobId).single()
      .then(({ data }) => {
        if (!data) return;
        if (data.status === 'completed') finish();
        else if (data.status === 'failed') finish(String(data.error_message || 'Job failed'));
      });

    // Safety net: if Realtime dropped the event, do a direct fetch after 20 seconds
    fallbackHandle = setTimeout(() => {
      if (settled) return;
      supabase.from('job_queue').select('status, error_message').eq('id', jobId).single()
        .then(({ data }) => {
          if (!data) return;
          if (data.status === 'completed') finish();
          else if (data.status === 'failed') finish(String(data.error_message || 'Job failed'));
        });
    }, 20_000);

    // Timeout safety net
    timeoutHandle = setTimeout(() => {
      clearTimeout(fallbackHandle);
      finish('Job timed out after ' + Math.round(timeoutMs / 1000) + 's');
    }, timeoutMs);

    // Store channel ref so we can clean up on early finish
    void channel;
  });
}

// Alias for existing imports — keeps all call sites unchanged
export const uploadAndQueueJob = generateWithBackend;

/** @deprecated - polling removed, use generateWithBackend */
export async function pollCacheForResult(): Promise<never> {
  throw new Error('pollCacheForResult removed. Use generateWithBackend instead.');
}




