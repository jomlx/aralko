import type { Flashcard } from '../types';

export function getTestModePrompt(flashcards: Flashcard[]): string {
  const termsList = flashcards
    .map((f) => `- Term: ${f.front}\n  Definition: ${f.back}`)
    .join('\n\n');

  return `Generate a test with a mix of single-answer and multi-select questions based on these flashcard terms.

RULES:
1. Generate approximately 60% single-answer questions and 40% multi-select questions. Distribute them randomly throughout the array.
2. For SINGLE-ANSWER questions:
   - "answer_type": "single"
   - "options": exactly 4 strings
   - "correct_options": array with exactly 1 string (must be one of the options)
3. For MULTI-SELECT questions ("select all that apply"):
   - "answer_type": "multiple"
   - "options": exactly 4 strings
   - "correct_options": array with 2 or 3 strings (all must be present in options)
   - The incorrect options must be plausible distractors from the same topic
4. Do NOT copy the exact flashcard definition as the question. Paraphrase or use a scenario.
5. Each question must be 1-2 sentences.
6. "explanation": one brief sentence (under 20 words) explaining why the correct answer(s) are right.
7. Generate one question per flashcard term. Cover ALL terms provided.

OUTPUT FORMAT:
Output ONLY a valid JSON array. No markdown, no code fences, no commentary.
Each object must have EXACTLY these keys:
- "question": string
- "answer_type": "single" | "multiple"
- "options": array of exactly 4 strings
- "correct_options": array of 1-3 strings (all must appear in "options")
- "explanation": string

Example Output:
[
  {
    "question": "Which SQL command removes all rows from a table without logging individual row deletions?",
    "answer_type": "single",
    "options": ["DELETE", "DROP", "TRUNCATE", "REMOVE"],
    "correct_options": ["TRUNCATE"],
    "explanation": "TRUNCATE is a DDL command that clears a table faster by not logging individual deletions."
  },
  {
    "question": "Which of the following are characteristics of a Data Lake?",
    "answer_type": "multiple",
    "options": ["Stores raw unstructured data", "Enforces strict schema on write", "Supports schema-on-read", "Cannot store structured data"],
    "correct_options": ["Stores raw unstructured data", "Supports schema-on-read"],
    "explanation": "Data Lakes store raw data and apply schema only when reading, making them flexible."
  }
]

Here are the terms to use:
${termsList}`;
}

