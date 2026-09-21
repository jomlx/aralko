-- =============================================================
-- Aralko — Phase 2: Streak Freeze
-- Run this in the Supabase SQL Editor AFTER phase1_xp_leaderboard.sql.
-- =============================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS streak_freezes INT NOT NULL DEFAULT 0,
  -- How many freezes the user currently has stockpiled (max 2).
  -- Earned at a rate of 1 per 7 consecutive study days.

  ADD COLUMN IF NOT EXISTS saved_streak   INT NOT NULL DEFAULT 0;
  -- The last known streak value, persisted in DB so the freeze logic
  -- survives a page reload without recalculating from scratch.

-- Freeze mechanic summary (enforced in app code, not DB):
--   - Earn 1 freeze every 7 consecutive study days (max 2 stored).
--   - On login/load: if yesterday had no session AND saved_streak > 0
--     AND streak_freezes > 0, decrement streak_freezes by 1 and keep
--     saved_streak unchanged. Show toast: "Your streak was protected! ❄️ 1 freeze used."
--   - If no freezes available, streak resets to 0 as before.
--   - Display: snowflake icon + count next to streak badge in StudyTracker.

