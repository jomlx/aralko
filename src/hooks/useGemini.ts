import { useState, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { getReviewerPrompt } from '../prompts/reviewerPrompt';
import { callAI } from '../lib/aiCall';
import type { AIBody } from '../lib/aiCall';
import { getPersonalGeminiKey } from '../lib/aiCall';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function useGemini() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true); // always true: shared key is server-side
  const [retryStatus, setRetryStatus] = useState<string | null>(null);

  useEffect(() => {
    // isConfigured is always true: personal key OR server-side shared key both work
    setIsConfigured(true);
  }, []);

  /** Call AI client-side (personal key path only) */
  const callClientSide = async (body: AIBody): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setRetryStatus(null);
    try {
      const result = await callAI(body, {
        maxRetries: 1,
        onRetry: (attempt, waitMs) => {
          if (attempt === 999) setRetryStatus('Switching to backup AI...');
          else setRetryStatus(`Rate limited — retrying in ${Math.round(waitMs / 1000)}s...`);
        },
        onQueueWait: () => setRetryStatus('Waiting for another request to finish...'),
      });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
      setRetryStatus(null);
    }
  };

  /**
   * sendChat:
   *   - Personal key present → call Gemini directly client-side (user's own key, their risk)
   *   - No personal key     → call /functions/v1/chat Edge Function (shared key stays server-side)
   */
  const sendChat = async (messages: ChatMessage[], systemPrompt: string): Promise<string> => {
    const personalKey = getPersonalGeminiKey();

    if (personalKey) {
      // Client-side path: personal key
      const contents = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));
      const body: AIBody = {
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 4096 },
      };
      return callClientSide(body);
    }

    // Server-side path: shared key via Edge Function
    setIsLoading(true);
    setError(null);
    setRetryStatus(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          systemPrompt,
        }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) || `Chat API error: ${res.status}`);
      return (data.response as string) ?? '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
      setRetryStatus(null);
    }
  };

  const generateReviewer = async (notes: string): Promise<string> => {
    const body: AIBody = {
      contents: [{ role: 'user', parts: [{ text: getReviewerPrompt(notes) }] }],
      generationConfig: { maxOutputTokens: 65536 },
    };
    return callClientSide(body);
  };

  const generateExam = async (notes: string, topic: string): Promise<string> => {
    const prompt = `Generate 10 exam questions about "${topic}" based on these notes:\n\n${notes}\n\nFormat as numbered list with answers at the end.`;
    const body: AIBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    };
    return callClientSide(body);
  };

  return {
    sendChat,
    generateReviewer,
    generateExam,
    isLoading,
    error,
    isConfigured,
    retryStatus,
  };
}
