export function getReviewerPrompt(content: string): string {
  // Clamp to ~60k chars (~15k tokens) to stay well within API limits
  const MAX_CHARS = 60_000;
  const truncated = content.length > MAX_CHARS
    ? content.slice(0, MAX_CHARS) + '\n\n[Document truncated — content was too long, reviewer is based on the first portion.]'
    : content;

  return `
   You are generating an exam-focused study reviewer from the document below. Follow this exact structure and style — it mimics a "cheat sheet" built for rapid memorization and exam recall, NOT a textbook explanation.

   STRUCTURE:

   1. Title + Tagline
      🚀 [Topic] Reviewer
      Cheat Sheet • Quick Memorization • Exam Trigger • [Subject/Exam Code if relevant]

   2. Big Picture Definition
      🎯 What is [Main Topic]?
      1-2 sentence definition, followed by a short "Think: X + Y + Z" mental shortcut line.

   3. Core Components Table
      List all major components/parts in a simple two-column table: Component | Purpose. Keep each purpose to 3-6 words.

   4. Individual Component Breakdown
      For EACH component, use this compact format:
      [Number] [Component Name]
      Purpose: [one short line]
      Memory: [Component] = [one-word or short-phrase association]

      Only include OTHER subsections (Example, Uses, Activities) if that specific component genuinely needs it — do not force every component into the same sub-structure if it doesn't apply.

   5. Comparison Sections (if applicable)
      For concepts that are commonly confused (e.g., X vs Y), use a short table or side-by-side format: 2-4 bullet traits per side, no more.

   6. Architecture/Flow Diagram (if applicable)
      Represent the data/process flow as a simple vertical arrow chain:
      Step 1 → Step 2 → Step 3

   7. Consolidated Exam Trigger Table
      ONE final summary table near the end: Question (short form) | Answer. This replaces the need to repeat "Exam Trigger" blocks after every single component — do NOT include individual "Exam Trigger" callouts after each component AND a final table; choose ONE approach and use it consistently (prefer the single consolidated table at the end).

   8. Quick Brain Dump / Memory Formula
      One consolidated list at the very end: [Term] = [Meaning], one line each, no repeated headers.

   STRICT RULES TO AVOID REPETITION:
   - Do NOT repeat the same "Exam Trigger" question format after every individual component if a consolidated exam trigger table already exists at the end — pick one location only.
   - Do NOT restate the same "Memory:" association in multiple places (e.g., in both the component breakdown AND the brain dump) — each fact should appear ONCE in its most useful location.
   - Avoid duplicate architecture diagrams — if a flow chain is shown once, do not repeat the same flow again in a different section using different wording.
   - Merge near-duplicate sections. If two sections would say almost the same thing (e.g., "Master Memory Formula" and "Ultimate Memory Formula" both showing a data flow), combine them into ONE clearly-labeled section instead of two similar ones.
   - Keep language sparse — favor short fragments, tables, and arrows over repeated full sentences.

   FORMATTING:
   - Use bold/emoji headers sparingly for scannability (🎯, 🧠, 🚨, ⚡, 🏆 — pick 2-3 max per document, not one per section).
   - Keep tables compact — no more than 2 columns unless absolutely necessary.
   - End with ONE final "What to Memorize" checklist — a flat list of Term = Meaning pairs, not duplicated from earlier sections.

   Document content:
   ${truncated}`;
}

