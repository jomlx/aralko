-- =============================================================
-- Aralko — Full Database Schema
-- Run this entire script in the Supabase SQL Editor.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. ACTIVITIES
--    Stores each study material/activity the user creates.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id                bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id           text   NOT NULL DEFAULT 'default-user',

  -- Core fields
  name              text   NOT NULL,
  subject           text   NOT NULL DEFAULT '',
  progress          int    NOT NULL DEFAULT 0,
  notes             text            DEFAULT '',

  -- AI-generated content (stored as text / JSONB text)
  "reviewerContent" text            DEFAULT '',
  technique         text            DEFAULT '',
  "techniqueData"   text            DEFAULT NULL,  -- JSON string
  "quizData"        text            DEFAULT NULL,  -- JSON string
  "reviewedCards"   text            DEFAULT NULL,  -- JSON string

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Index for fast per-user fetches
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities (user_id);


-- ──────────────────────────────────────────────────────────────
-- 2. SESSIONS
--    One row per completed Pomodoro focus session.
--    date is stored as a plain DATE string (YYYY-MM-DD) to make
--    daily grouping trivial on the client side.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id       text   NOT NULL DEFAULT 'default-user',

  date          text   NOT NULL,           -- 'YYYY-MM-DD'
  minutes       int    NOT NULL DEFAULT 25,
  "activityId"  bigint          DEFAULT NULL,
  "activityName" text           DEFAULT '',

  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date    ON sessions (user_id, date);


-- ──────────────────────────────────────────────────────────────
-- 3. USER_SETTINGS
--    One row per user — stores preferences that should roam
--    across devices (personal Gemini key, Pomodoro prefs, etc.)
--    Using 'default-user' as the user_id until auth is added.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id               text PRIMARY KEY DEFAULT 'default-user',

  -- Personal Gemini API key (optional)
  gemini_api_key        text            DEFAULT NULL,

  -- Pomodoro preferences
  pomodoro_preset       text            NOT NULL DEFAULT 'classic',  -- 'classic' | 'short' | 'extended'
  pomodoro_autostart    boolean         NOT NULL DEFAULT false,

  -- Spotify OAuth tokens (stored server-side for cross-device sync)
  spotify_access_token  text            DEFAULT NULL,
  spotify_refresh_token text            DEFAULT NULL,
  spotify_token_expiry  timestamptz     DEFAULT NULL,

  updated_at            timestamptz     NOT NULL DEFAULT now()
);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed the default user row so upsert always works
INSERT INTO user_settings (user_id)
VALUES ('default-user')
ON CONFLICT (user_id) DO NOTHING;
