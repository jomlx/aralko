export function getQuizPrompt(notes: string, isFresh: boolean = false): string {
  const intro = isFresh
    ? 'Generate a fresh set of quiz questions from these notes. Cover different aspects than a typical previous set.'
    : 'Generate a comprehensive set of multiple-choice quiz questions from these notes:';

  return `${intro}

QUIZ GENERATION RULES:

1. QUESTION FORMAT:
   - Each question must be a short DEFINITION or SCENARIO — not a flashcard front.
   - Example: "Which term refers to removing all rows from a table without logging individual deletions?"
   - Or: "A star schema's central table that stores measurable events is called a ___."
   - Questions should be phrased in plain English. Avoid overly academic or verbose phrasing.
   - Keep questions to 1-2 sentences maximum.

2. COVERAGE:
   - Cover ALL key concepts, terms, and definitions in the notes.
   - Do NOT skip minor but tested concepts.
   - Generate as many questions as needed to fully cover the material.

3. ANSWER & OPTIONS:
   - "answer": the single correct answer — typically 1-5 words (a term or phrase).
   - "options": exactly 4 strings. One must match "answer" exactly. The other 3 are plausible distractors.
   - Distractors should be from the SAME domain/topic (e.g., other SQL commands if the answer is a SQL command).
   - Options should be similar in length and format to each other.
   - Shuffle the options randomly (the correct one should NOT always be first).

4. EXPLANATION:
   - "explanation": 1 brief sentence clarifying WHY the answer is correct. Keep it under 20 words.

5. DIFFICULTY:
   - Mix easy (recall) and medium (application) questions.
   - Avoid trivially obvious questions or trick questions.

6. OUTPUT FORMAT:
   Output ONLY a valid JSON array with no markdown, no commentary, no code fences.
   Each object must have EXACTLY these keys:
   - "question": string
   - "answer": string
   - "options": array of exactly 4 strings
   - "explanation": string

Example Output:
[
  {
    "question": "Which term refers to removing all rows from a table without logging individual deletions?",
    "answer": "TRUNCATE",
    "options": [
      "DELETE",
      "DROP",
      "TRUNCATE",
      "REMOVE"
    ],
    "explanation": "TRUNCATE is a DDL command that quickly removes all rows without logging individual row deletions."
  }
]

Notes:
${notes}`;
}

export function getQuizPromptFromFlashcards(flashcards: { front: string; back: string }[]): string {
  const termsList = flashcards.map(f => `- Term: ${f.front}\n  Original Definition: ${f.back}`).join('\n\n');

  return `Generate a multiple-choice quiz based on the following flashcard terms.

IMPORTANT REQUIREMENT:
DO NOT just copy the flashcard's original definition as the question. Instead, create a slightly different definition, scenario, or practical application for the term. The question should test if the student truly understands the concept, not just if they memorized the exact phrasing.

QUIZ GENERATION RULES:
1. QUESTION FORMAT:
   - Each question must be a short definition, scenario, or fill-in-the-blank that leads to the term.
   - Do NOT use the exact phrasing from the "Original Definition". Paraphrase it or describe its purpose/use-case.
   - Keep questions concise (1-2 sentences).

2. ANSWER & OPTIONS:
   - "answer": the flashcard Term.
   - "options": exactly 4 strings. One must match "answer" exactly. The other 3 are plausible distractors related to the topic.
   - Shuffle the options randomly (the correct one should NOT always be first).

3. EXPLANATION:
   - "explanation": 1 brief sentence clarifying WHY the answer is correct.

4. OUTPUT FORMAT:
   Output ONLY a valid JSON array with no markdown, no commentary, no code fences.
   Each object must have EXACTLY these keys:
   - "question": string
   - "answer": string
   - "options": array of exactly 4 strings
   - "explanation": string

Example Output:
[
  {
    "question": "A company wants to store massive amounts of unstructured data before determining how to process it. Which architecture should they use?",
    "answer": "Data Lake",
    "options": [
      "Data Warehouse",
      "Data Lake",
      "Relational Database",
      "OLAP Cube"
    ],
    "explanation": "A Data Lake is designed to store raw, unstructured data in its native format until it is needed for processing."
  }
]

Here are the terms to use:
${termsList}`;
}

