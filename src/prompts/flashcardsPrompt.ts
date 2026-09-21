export function getFlashcardPrompt(notes: string, isFreshSet: boolean = false): string {
  const intro = isFreshSet
    ? "Generate a fresh, incredibly exhaustive set of flashcards covering ALL topics from these notes. Make these different from a typical/previous set — vary the phrasing and angle of questions where possible."
    : "Generate a truly exhaustive and complete set of flashcards that strictly covers EVERY distinct topic, concept, term, formula, and fact from these notes:";

  return `${intro}

1. EXHAUSTIVE, UNLIMITED COVERAGE (CRITICAL REQUIREMENT):
   You MUST extract every single key term, concept, definition, command, formula, or key fact present in the source material. 
   Do not limit yourself to a fixed number of cards. Continue generating flashcards until EVERY significant concept has been covered. 
   A longer, more thorough document should produce proportionally more flashcards — DO NOT artificially cap the output. Prioritize breadth of coverage over adding extra depth to a single concept.

2. TERM-DEFINITION FORMAT:
   - The "front" should be the term, concept name, or command itself (e.g., "TRUNCATE", "Data Definition Language") — NOT phrased as a question. Avoid formats like "What is TRUNCATE?".
   - The "back" should be the exact, concise definition or explanation of that term (e.g., "Removes all rows from a table without logging individual deletions").

3. FOUNDATIONAL-FIRST ORDERING:
   - Prioritize foundational concepts first (clear definitions, core terms) before more advanced or nuanced ones.
   - Avoid overly advanced or jargon-heavy phrasing — if a concept is inherently advanced, simplify its explanation rather than skipping it.
   - Order flashcards progressively from simplest to most advanced.

4. CONCISENESS RULES for the "back":
   a. Limit answers to 1-2 short sentences maximum (ideally under 25-30 words).
   b. If a concept requires nuance, prioritize the single most essential distinction rather than explaining every supporting detail.
   c. Favor direct, memorable phrasing. Brief analogies (a few words) are fine; full explanatory analogy sentences are not.

5. MULTIPLE-CHOICE OPTIONS:
   Each flashcard MUST include an "options" array of exactly 4 strings. One option must exactly match the "back" (the correct answer). The other 3 must be plausible, believable distractors of similar length and format — avoid obviously wrong or absurd options.
   - Expand all acronyms/abbreviations into full words in both "back" and "options" (e.g., "Data Definition Language" instead of "DDL").
   - Options should mostly be short — typically 1 word or a few words. For harder/more nuanced questions, allow up to 1 short sentence.

6. BRIDGE CARDS (LIMITED):
   You may include up to 2 "bridge" flashcards using general, widely-known related knowledge not explicitly stated in the notes, only to help contextualize a concept (e.g., a brief analogy). These must remain a small minority of the total set.

7. OUTPUT FORMAT:
   Output ONLY a valid JSON array of objects. Each object must have exactly these keys:
   - "front": the term/concept/command
   - "back": the concise correct definition
   - "options": an array of 4 strings (the correct answer plus 3 distractors, shuffled randomly)
   Do not include any text, markdown formatting, or commentary outside the JSON array.

Notes:
${notes}`;
}