-- =============================================================
-- Aralko — Permissions Fix
-- Run this in the Supabase SQL Editor AFTER schema.sql.
--
-- Why this is needed:
--   Supabase's anon key maps to the `anon` PostgreSQL role.
--   By default, newly created tables grant NO privileges to
--   the anon role, so every read/write from the browser is
--   rejected — even when RLS is disabled.
--   This script grants the anon role full access to all three
--   app tables so the client can read and write freely.
--   (This is appropriate for a single-user / no-auth app.)
-- =============================================================

-- ── Grant table access to the anon role ────────────────────────
GRANT ALL ON TABLE activities    TO anon;
GRANT ALL ON TABLE sessions      TO anon;
GRANT ALL ON TABLE user_settings TO anon;

-- ── Grant sequence access (needed for GENERATED ALWAYS AS
--    IDENTITY columns — without this, INSERT fails on the id) ──
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ── Also grant to authenticated role in case you add auth later
GRANT ALL ON TABLE activities    TO authenticated;
GRANT ALL ON TABLE sessions      TO authenticated;
GRANT ALL ON TABLE user_settings TO authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ── Disable RLS on all three tables (optional but keeps things
--    simple while the app has no per-user auth) ─────────────────
ALTER TABLE activities    DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;

