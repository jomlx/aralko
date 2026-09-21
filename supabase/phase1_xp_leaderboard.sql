-- =============================================================
-- Aralko — Phase 1: XP, Leveling & Leaderboard
-- Run this in the Supabase SQL Editor.
-- =============================================================

-- Add XP, level, weekly XP tracking, and display info to user_settings.
-- These columns are all safe to add IF NOT EXISTS, so re-running is harmless.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS xp            INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level         INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_this_week  INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS week_start    TEXT          DEFAULT NULL,
  -- week_start = 'YYYY-MM-DD' of the Monday that started the current XP week.
  -- The app resets xp_this_week when this date is stale on load.

  ADD COLUMN IF NOT EXISTS display_name  TEXT          DEFAULT NULL,
  -- Synced from user.user_metadata.full_name on every login (null-safe).

  ADD COLUMN IF NOT EXISTS avatar_url    TEXT          DEFAULT NULL;
  -- Synced from user.user_metadata.avatar_url on every login (null-safe).


-- Progressive level formula (enforced in app code, not DB):
--   XP needed to go from level N to N+1 = N * 200
--   Total XP to reach level L = 100 * L * (L - 1)
--   Level from XP = floor((1 + sqrt(1 + XP / 25)) / 2)
--
-- Examples:
--   Level 1:  0 XP
--   Level 2:  200 XP  (+200)
--   Level 3:  600 XP  (+400)
--   Level 4:  1,200 XP (+600)
--   Level 5:  2,000 XP (+800)
--   Level 10: 9,000 XP

-- XP awards (enforced in app code, not DB):
--   +20 XP  — complete a Pomodoro session
--   +25 XP + 1 per correct answer — finish a quiz (once per activity)
--   +15 XP  — complete a flashcard deck (once per activity)
--   +10 XP  — generate a reviewer (once per activity)

-- The leaderboard query the app will use:
--   All Time:   SELECT * FROM user_settings ORDER BY xp DESC LIMIT 50
--   This Week:  SELECT * FROM user_settings ORDER BY xp_this_week DESC LIMIT 50
-- No extra view needed — user_settings is already readable.

