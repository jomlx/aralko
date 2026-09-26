/**
 * apiClient.ts
 * Talks to the Supabase backend-api Edge Function.
 *
 * PATH A (personal key):  backend-api calls AI directly, returns cachedData synchronously.
 * PATH B (shared key):    backend-api queues job, returns { fileHash, jobIds }.
 *                         We poll file_cache every 2s until the result columns appear.
 *                         This deliberately avoids Realtime entirely — it's unreliable
 *                         unless job_queue is added to the supabase_realtime publication.
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
 * No key → queued job, poll file_cache until results appear.
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

  // PATH B: shared key, job(s) queued
  if (data.queued) {
    const fileHash = data.fileHash as string;
    const jobIds = data.jobIds as Record<string, string>;

    // Determine which job types are still pending (not already cached)
    const pendingTypes = Object.entries(jobIds)
      .filter(([, id]) => id !== 'cached')
      .map(([type]) => type);

    if (pendingTypes.length === 0) {
      // All results were already in cache — just fetch and return them
      const { data: cacheRow } = await supabase
        .from('file_cache').select('*').eq('file_hash', fileHash).single();
      return { fileHash, cachedData: cacheRow as Record<string, unknown> };
    }

    // Wait for the AI workers to write results into file_cache
    const cacheRow = await waitForCacheResults(fileHash, pendingTypes, timeoutMs);
    return { fileHash, cachedData: cacheRow };
  }

  throw new Error('Unexpected backend-api response shape');
}

/**
 * Poll file_cache every 2s until all requested result columns are non-null.
 *
 * Root-cause fix: The previous implementation watched job_queue via Supabase Realtime.
 * Realtime only delivers events if the table is added to the supabase_realtime publication,
 * which it wasn't. The AI workers DO complete (the data IS in file_cache), but the browser
 * never got notified and timed out after 120s. Polling file_cache directly is simpler,
 * requires no special DB config, and is guaranteed to work.
 */
function waitForCacheResults(
  fileHash: string,
  pendingTypes: string[],
  timeoutMs: number
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let done = false;

    const check = async () => {
      if (done) return;
      try {
        const { data: row } = await supabase
          .from('file_cache')
          .select('*')
          .eq('file_hash', fileHash)
          .single();

        if (!row) return;

        // Check that every pending type has a non-null result column
        const allReady = pendingTypes.every(type => row[`${type}_result`] != null);
        if (allReady) {
          done = true;
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          resolve(row as Record<string, unknown>);
        }
      } catch {
        // Ignore transient network errors and keep polling
      }
    };

    // Check immediately (catches jobs that finished before we even started polling)
    check();

    // Then poll every 2 seconds
    const intervalId = setInterval(check, 2000);

    // Timeout safety net
    const timeoutId = setTimeout(() => {
      if (done) return;
      done = true;
      clearInterval(intervalId);
      reject(new Error('Job timed out after ' + Math.round(timeoutMs / 1000) + 's'));
    }, timeoutMs);
  });
}

// Alias for existing imports — keeps all call sites unchanged
export const uploadAndQueueJob = generateWithBackend;

/** @deprecated - polling removed, use generateWithBackend */
export async function pollCacheForResult(): Promise<never> {
  throw new Error('pollCacheForResult removed. Use generateWithBackend instead.');
}
