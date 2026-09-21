/**
 * Robust JSON parser for AI-generated responses.
 *
 * Pipeline:
 *  1. Strip markdown code fences (```json ... ```)
 *  2. Extract the first JSON array [ ] or object { } in the text
 *     (handles stray prose before/after the JSON)
 *  3. Try JSON.parse()
 *  4. On failure → try jsonrepair() (fixes truncation, unescaped quotes, trailing commas…)
 *  5. On both failing → log the full raw text and throw a user-friendly error
 *
 * @param raw    Raw string from the AI
 * @param label  Human label used in console logs ("flashcards", "quiz", etc.)
 * @param expect 'array' | 'object' — controls which bracket pair to extract
 */

import { jsonrepair } from 'jsonrepair';

export function parseAIJson<T = unknown>(
  raw: string,
  label: string,
  expect: 'array' | 'object' = 'array'
): T {
  // ── Step 1: strip markdown fences ────────────────────────────────────────
  let text = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // ── Step 2: extract first JSON structure ──────────────────────────────────
  const open  = expect === 'array' ? '[' : '{';
  const close = expect === 'array' ? ']' : '}';
  const start = text.indexOf(open);
  const end   = text.lastIndexOf(close);
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  // ── Step 3: try direct parse ──────────────────────────────────────────────
  try {
    return JSON.parse(text) as T;
  } catch (directErr) {
    console.warn(`[parseAIJson] ${label}: direct JSON.parse failed —`, (directErr as Error).message);
    console.warn(`[parseAIJson] ${label}: full raw response:\n`, raw);
  }

  // ── Step 4: try jsonrepair ────────────────────────────────────────────────
  try {
    const repaired = jsonrepair(text);
    const result = JSON.parse(repaired) as T;
    console.info(`[parseAIJson] ${label}: jsonrepair recovered the response ✓`);
    return result;
  } catch (repairErr) {
    console.error(`[parseAIJson] ${label}: jsonrepair also failed —`, (repairErr as Error).message);
    console.error(`[parseAIJson] ${label}: full raw response (repair attempt):\n`, raw);
  }

  // ── Step 5: custom salvage for truncated arrays of objects ───────────────
  if (expect === 'array') {
    console.log(`[parseAIJson] ${label}: attempting custom salvage for truncated array...`);
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace !== -1) {
      const salvagedText = text.slice(0, lastBrace + 1) + ']';
      try {
        const salvagedRepaired = jsonrepair(salvagedText);
        const result = JSON.parse(salvagedRepaired) as T;
        console.info(`[parseAIJson] ${label}: custom salvage recovered the response ✓`);
        return result;
      } catch (salvageErr) {
        console.error(`[parseAIJson] ${label}: custom salvage failed.`);
      }
    }
  }

  // ── Step 6: give up with a friendly error ─────────────────────────────────
  throw new Error('We had trouble processing that response — please try again.');
}

