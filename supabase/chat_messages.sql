-- =============================================================
-- Aralko — Chat Messages Table
-- Run this in the Supabase SQL Editor.
-- =============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id       text   NOT NULL,
  activity_id   bigint NOT NULL,

  role          text   NOT NULL CHECK (role IN ('user', 'assistant')),
  content       text   NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_activity ON chat_messages (user_id, activity_id, created_at);

-- Grant access (same pattern as the other tables)
GRANT ALL ON TABLE chat_messages TO anon;
GRANT ALL ON TABLE chat_messages TO authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

