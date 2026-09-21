import { useState, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { getReviewerPrompt } from '../prompts/reviewerPrompt';
import { callAI } from '../lib/aiCall';
import type { AIBody } from '../lib/aiCall';

export function useGemini() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);

  useEffect(() => {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    setIsConfigured(!!key);
  }, []);

  const call = async (body: AIBody): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setRetryStatus(null);
    try {
      const result = await callAI(body, {
        maxRetries: 1,
        onRetry: (attempt, waitMs) => {
          if (attempt === 999) {
            setRetryStatus('Switching to backup AI...');
          } else {
            setRetryStatus(`Rate limited — trying again in ${Math.round(waitMs / 1000)}s...`);
          }
        },
        onQueueWait: () => {
          setRetryStatus('Waiting for another request to finish...');
        }
      });
      return result;
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
      throw err;
    } finally {
      setIsLoading(false);
      setRetryStatus(null);
    }
  };

  const sendChat = async (messages: ChatMessage[], systemPrompt: string): Promise<string> => {
    const contents = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
    const body: AIBody = {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: 65536 },  // was 8192 — increased for large flashcard/quiz generation
    };
    return call(body);
  };

  const generateReviewer = async (notes: string): Promise<string> => {
    const body: AIBody = {
      contents: [{ role: 'user', parts: [{ text: getReviewerPrompt(notes) }] }],
      systemInstruction: {
        parts: [{ text: 'You are an expert study guide creator. Output ONLY the condensed cheat-sheet — no introductions, no commentary, no markdown code blocks.' }],
      },
      generationConfig: { maxOutputTokens: 32768 },  // was 8192 — reviewers for long docs need more room
    };
    return call(body);
  };

  const generateExam = async (notes: string, topic: string): Promise<string> => {
    const body: AIBody = {
      contents: [{ role: 'user', parts: [{ text: `Topic: ${topic}\n\nNotes:\n${notes}` }] }],
      systemInstruction: {
        parts: [{ text: 'You are an expert examiner. Generate a set of challenging but fair exam questions based on the provided notes and topic. Provide multiple-choice and short-answer questions.' }],
      },
      generationConfig: { maxOutputTokens: 16384 },
    };
    return call(body);
  };

  return {
    sendChat,
    generateReviewer,
    generateExam,
    isLoading,
    error,
    retryStatus,
    isConfigured,
  };
}
