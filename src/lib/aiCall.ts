/**
 * Centralized AI call wrapper.
 * Key resolution order:
 *   1. User's personal Gemini key (from localStorage 'aralko-personal-gemini-key')
 *   2. Shared default Gemini key (VITE_GEMINI_API_KEY)
 *   3. Groq fallback (VITE_GROQ_API_KEY)
 * Transparent to callers — they just get a string or a thrown Error.
 */

const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.6-flash';
const GROQ_MODEL   = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';

const PERSONAL_KEY_STORAGE = 'aralko-personal-gemini-key';

/** Read the user's saved personal Gemini key from localStorage (if any). */
export function getPersonalGeminiKey(): string | null {
  try { return localStorage.getItem(PERSONAL_KEY_STORAGE) || null; } catch { return null; }
}

/** Save (or clear) the user's personal Gemini key. */
export function setPersonalGeminiKey(key: string | null) {
  try {
    if (key) localStorage.setItem(PERSONAL_KEY_STORAGE, key);
    else localStorage.removeItem(PERSONAL_KEY_STORAGE);
  } catch { /* ignore */ }
}

/**
 * Quick, lightweight validation call — sends a tiny prompt to confirm the key works.
 * Returns true on success, throws a descriptive Error on failure.
 */
export async function validateGeminiKey(key: string): Promise<true> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say "ok"' }] }] }),
    });
  } catch (networkErr) {
    throw new Error('Could not reach the Gemini API. Please check your internet connection.');
  }

  // 401/403 = definitely an auth/key problem
  if (res.status === 401 || res.status === 403) {
    throw new Error('Invalid API key. Please make sure you copied the full key correctly.');
  }
  // 400 can mean the model name is custom/proxied — treat as success for validation purposes
  // 429/503/504 = server-side transient, not a key problem
  if (res.status === 429 || res.status === 503 || res.status === 504) {
    // Key format is likely fine, Gemini is just busy — accept the key
    return true;
  }
  if (!res.ok && res.status !== 400) {
    throw new Error(`Validation failed (${res.status}). Please try again.`);
  }
  return true;
}


export interface AIBody {
  // Gemini-format request body
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: { maxOutputTokens?: number };
}

// ─── Gemini ────────────────────────────────────────────────────────────────

async function callGeminiOnce(body: AIBody, apiKey: string, signal?: AbortSignal): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const status = res.status;
    const txt = await res.text();
    console.error(`[Gemini] HTTP ${status} from API. Response body:`, txt);
    if (status === 429 || status === 503) throw Object.assign(new Error(status === 429 ? 'rate_limit' : 'unavailable'), { status });
    if (status === 401 || status === 403)
      throw new Error(`Invalid Gemini API Key (${status}). Check https://aistudio.google.com/apikey`);
    throw new Error(`Gemini API Error ${status}: ${txt}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

async function callGeminiWithRetry(
  body: AIBody,
  apiKey: string,
  maxRetries = 1,
  onRetry?: (attempt: number, waitMs: number) => void,
  signal?: AbortSignal,
  retryDelayMs?: number  // if set, use fixed delay instead of exponential backoff
): Promise<string> {
  let delay = retryDelayMs ?? 2000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callGeminiOnce(body, apiKey, signal);
    } catch (err: any) {
      if (signal?.aborted) throw err;
      if ((err.status === 429 || err.status === 503) && attempt < maxRetries) {
        onRetry?.(attempt + 1, delay);
        
        await new Promise<void>((resolve, reject) => {
          if (signal?.aborted) return reject(new Error('Aborted'));
          
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          }, delay);
          
          const onAbort = () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
          };
          signal?.addEventListener('abort', onAbort);
        });

        // Only do exponential backoff when NOT using fast-fail mode
        if (!retryDelayMs) delay *= 2;
        continue;
      }
      throw err; // non-429/503 or exhausted retries
    }
  }
  throw new Error('Gemini retries exhausted');
}

// ─── Groq fallback ─────────────────────────────────────────────────────────

function geminiBodyToGroqMessages(body: AIBody): Array<{ role: string; content: string }> {
  const msgs: Array<{ role: string; content: string }> = [];

  if (body.systemInstruction?.parts?.[0]?.text) {
    msgs.push({ role: 'system', content: body.systemInstruction.parts[0].text });
  }

  for (const turn of body.contents) {
    msgs.push({
      role: turn.role === 'model' ? 'assistant' : turn.role,
      content: turn.parts.map(p => p.text).join('\n'),
    });
  }
  return msgs;
}

async function callGroq(body: AIBody, apiKey: string, signal?: AbortSignal): Promise<string> {
  const messages = geminiBodyToGroqMessages(body);
  console.log('[Groq] Sending fallback request. Model:', GROQ_MODEL, 'Messages:', JSON.stringify(messages).substring(0, 500) + '...');
  
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ 
      model: GROQ_MODEL, 
      messages,
      // Groq max is 32768; clamp in case caller requested more (e.g., Gemini allows 65536)
      ...(body.generationConfig?.maxOutputTokens && { max_tokens: Math.min(body.generationConfig.maxOutputTokens, 32768) })
    }),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[Groq] Request failed with status ${res.status}:`, txt);
    throw new Error(`Groq API Error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  console.log('[Groq] Fallback response received. Length:', text?.length);
  if (!text) throw new Error('Empty response from Groq');
  return text;
}

// ─── Global Request Queue ───────────────────────────────────────────────────
let globalAiLock: Promise<void> = Promise.resolve();

// ─── Public API ────────────────────────────────────────────────────────────

export interface CallAIOptions {
  /** Called before each retry attempt with the attempt number and ms waited */
  onRetry?: (attempt: number, waitMs: number) => void;
  /** Called if this request has to wait in the global queue for another request to finish */
  onQueueWait?: () => void;
  /** Max Gemini retry attempts before falling back to Groq (default 1) */
  maxRetries?: number;
  /**
   * Fast-fail mode: try Gemini only ONCE with a short fixed 2s delay,
   * then immediately fall back to Groq. Total max wait: ~4s before Groq.
   * Use this during time-sensitive generation (Add Activity modal).
   */
  fastFail?: boolean;
  /** Abort signal to cancel the request */
  signal?: AbortSignal;
}

/**
 * Main entry point used by all AI features.
 * Uses Flash model for Gemini. Falls back to Groq if Gemini fails.
 * Enforces a global queue so only ONE request runs at a time.
 */
export async function callAI(body: AIBody, options: CallAIOptions = {}): Promise<string> {
  const personalKey = getPersonalGeminiKey();
  const sharedKey   = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const groqKey     = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

  if (!personalKey && !sharedKey)
    throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.');

  // In fast-fail mode: 1 retry max, 2s fixed delay — total ~4s before Groq kicks in
  const maxRetries   = options.fastFail ? 1 : (options.maxRetries ?? 1);
  const retryDelayMs = options.fastFail ? 2000 : undefined; // undefined = exponential backoff
  const signal = options.signal;

  // Queue mechanism: wait for previous requests to finish
  let releaseLock!: () => void;
  const myTurn = new Promise<void>(resolve => { releaseLock = resolve; });
  const previousLock = globalAiLock;
  globalAiLock = globalAiLock.then(() => myTurn);

  let isWaiting = true;
  previousLock.then(() => { isWaiting = false; });

  // If we don't acquire the lock almost immediately, notify the caller
  setTimeout(() => {
    if (isWaiting) options.onQueueWait?.();
  }, 50);

  try {
    await previousLock;
    if (signal?.aborted) throw new Error('Aborted');

    // ── Tier 1: Personal key (if the user saved one) ──────────────────────
    if (personalKey) {
      try {
        return await callGeminiWithRetry(body, personalKey, maxRetries, options.onRetry, signal, retryDelayMs);
      } catch (personalErr: any) {
        if (signal?.aborted || personalErr.message === 'Aborted') throw personalErr;
        console.warn('[AI] Personal Gemini key failed — falling back to shared key:', personalErr.message);
        // fall through to shared key
      }
    }

    // ── Tier 2: Shared default Gemini key ──────────────────────────────────
    if (sharedKey) {
      try {
        return await callGeminiWithRetry(body, sharedKey, maxRetries, options.onRetry, signal, retryDelayMs);
      } catch (sharedErr: any) {
        if (signal?.aborted || sharedErr.message === 'Aborted') throw sharedErr;
        
        // If both Gemini tiers fail, signal caller and fall through to Groq
        if (groqKey) {
          options.onRetry?.(999, 0); // "Switching to backup AI..."
          console.warn(`[AI] Shared Gemini key also failed (${sharedErr.message}) — VITE_GROQ_API_KEY found, falling back to Groq...`);
          try {
            return await callGroq(body, groqKey, signal);
          } catch (groqErr: any) {
            if (signal?.aborted || groqErr.message === 'Aborted') throw groqErr;
            console.error('[AI] Groq also failed:', groqErr.message);
            throw new Error('Aralko is currently busy or unavailable. Please try again in a moment.');
          }
        } else {
          console.warn(`[AI] Shared Gemini key failed (${sharedErr.message}) — no VITE_GROQ_API_KEY found, skipping Groq fallback.`);
        }

        // Friendly error
        if (sharedErr.status === 429 || sharedErr.status === 503) {
          throw new Error('Aralko is currently busy or unavailable. Please try again in a moment.');
        }
        if (sharedErr.message?.includes('Invalid API key')) throw sharedErr;
        console.error('[AI] Call failed:', sharedErr);
        throw new Error('Aralko encountered an error. Please try again in a moment.');
      }
    }

    // ── Tier 3: Groq only (no Gemini key available, shouldn't normally happen) ─
    if (groqKey) {
      return await callGroq(body, groqKey, signal);
    }

    throw new Error('No provider available.');
  } finally {
    releaseLock();
  }
}

