import { callAI } from './src/lib/aiCall.js';

// Setup mock env
(globalThis as any).import = { meta: { env: {
  VITE_GEMINI_API_KEY: 'mock-gemini-key',
  VITE_GROQ_API_KEY: process.env.GROQ_API_KEY,
  VITE_GEMINI_MODEL: 'gemini-3.6-flash'
}}};

// Mock fetch to simulate Gemini 503 and intercept Groq
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url: any, options: any) => {
  if (url.includes('generativelanguage')) {
    console.log('--- MOCK GEMINI: Returning 503 ---');
    return new Response('Unavailable', { status: 503 });
  }
  return originalFetch(url, options);
};

async function run() {
  try {
    const res = await callAI({
      contents: [{ role: 'user', parts: [{ text: 'Say hello world' }] }]
    }, { maxRetries: 1 }); // limit retries to fail faster
    console.log('SUCCESS:', res);
  } catch (err) {
    console.error('FAILED:', err);
  }
}
run();

