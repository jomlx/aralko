-- Add ai_consent_acknowledged_at to user_settings
-- Run this in the Supabase SQL Editor.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS ai_consent_acknowledged_at TIMESTAMPTZ DEFAULT NULL;
-- NULL means not yet acknowledged. When the user ticks the checkbox in
-- Settings > Data & Privacy, the app upserts the current timestamp here.
