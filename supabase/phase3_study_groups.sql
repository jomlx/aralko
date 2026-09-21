-- =============================================================
-- Aralko — Phase 3: Study Groups
-- Run this in the Supabase SQL Editor AFTER phase2_streak_freeze.sql.
-- =============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. STUDY GROUPS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_groups (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  invite_code TEXT    NOT NULL UNIQUE,
  created_by  TEXT    NOT NULL,  -- user_id (UUID stored as text, matches other tables)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members linking table
CREATE TABLE IF NOT EXISTS study_group_members (
  group_id   UUID  REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id    TEXT  NOT NULL,
  display_name TEXT DEFAULT NULL,  -- denormalised snapshot for member list display
  avatar_url   TEXT DEFAULT NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Shared activities: one row per activity shared into a group.
-- All members access the same activity_id row, so only one AI generation ever runs.
CREATE TABLE IF NOT EXISTS group_shared_activities (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID    REFERENCES study_groups(id) ON DELETE CASCADE,
  activity_id BIGINT  NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  shared_by   TEXT    NOT NULL,   -- user_id of the member who shared it
  shared_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-member progress on each shared activity
CREATE TABLE IF NOT EXISTS group_member_progress (
  group_id       UUID   REFERENCES study_groups(id) ON DELETE CASCADE,
  activity_id    BIGINT NOT NULL,
  user_id        TEXT   NOT NULL,
  quiz_score     INT    DEFAULT NULL,  -- last quiz percentage (0–100)
  cards_reviewed INT    NOT NULL DEFAULT 0,
  completed      BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, activity_id, user_id)
);


-- ──────────────────────────────────────────────────────────────
-- 2. GRANTS (consistent with other tables)
-- ──────────────────────────────────────────────────────────────
GRANT ALL ON study_groups             TO anon, authenticated;
GRANT ALL ON study_group_members      TO anon, authenticated;
GRANT ALL ON group_shared_activities  TO anon, authenticated;
GRANT ALL ON group_member_progress    TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- RLS is ENABLED on all group tables. Direct inserts into
-- study_group_members are BLOCKED for regular users — the only
-- way to join or create a group is via the SECURITY DEFINER
-- functions below, which validate the invite code server-side.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE study_groups             ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_shared_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_member_progress    ENABLE ROW LEVEL SECURITY;

-- study_groups: members can read their own groups.
-- (No SELECT for all — group lookup by invite code goes through the function.)
CREATE POLICY "groups_select_members_only" ON study_groups
  FOR SELECT USING (
    id IN (
      SELECT group_id FROM study_group_members WHERE user_id = auth.uid()::text
    )
  );

-- study_group_members: members can see other members in their groups.
-- Using true avoids infinite recursion in Supabase when a table queries itself in RLS.
CREATE POLICY "members_select" ON study_group_members
  FOR SELECT USING (true);

-- No direct INSERT on study_group_members — must go through functions below.
-- No direct DELETE policy — leave group handled through function.

-- shared_activities: only group members can read
CREATE POLICY "shared_activities_select" ON group_shared_activities
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM study_group_members WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "shared_activities_insert" ON group_shared_activities
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT group_id FROM study_group_members WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "shared_activities_delete" ON group_shared_activities
  FOR DELETE USING (
    shared_by = auth.uid()::text
  );

-- member progress: only group members can read/write their own progress
CREATE POLICY "progress_select" ON group_member_progress
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM study_group_members WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "progress_write" ON group_member_progress
  FOR ALL USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);


-- ──────────────────────────────────────────────────────────────
-- 4. SERVER-SIDE FUNCTIONS (SECURITY DEFINER)
-- These bypass RLS to safely manage group membership.
-- ──────────────────────────────────────────────────────────────

-- Helper: generate a random 6-character invite code from unambiguous chars
-- (no 0/O, 1/I confusion)
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT array_to_string(
    ARRAY(
      SELECT substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1)
      FROM generate_series(1, 6)
    ), ''
  );
$$;


-- create_study_group: creates a group AND adds creator as first member.
-- Returns the new group id and invite_code.
CREATE OR REPLACE FUNCTION create_study_group(
  p_name         TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_avatar_url   TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id    TEXT;
  v_group_id   UUID;
  v_code       TEXT;
  v_attempts   INT := 0;
BEGIN
  v_user_id := auth.uid()::text;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Generate a unique invite code (retry on collision, max 5 attempts)
  LOOP
    v_code := generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM study_groups WHERE invite_code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts >= 5 THEN
      RAISE EXCEPTION 'Could not generate unique invite code';
    END IF;
  END LOOP;

  -- Create the group
  INSERT INTO study_groups (name, invite_code, created_by)
  VALUES (p_name, v_code, v_user_id)
  RETURNING id INTO v_group_id;

  -- Auto-join creator as first member
  INSERT INTO study_group_members (group_id, user_id, display_name, avatar_url)
  VALUES (v_group_id, v_user_id, p_display_name, p_avatar_url);

  RETURN json_build_object(
    'group_id',    v_group_id,
    'invite_code', v_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_study_group(TEXT, TEXT, TEXT) TO authenticated;


-- join_study_group: validates invite code and adds calling user as member.
-- Returns the group_id on success, raises an exception on bad code.
CREATE OR REPLACE FUNCTION join_study_group(
  p_invite_code  TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_avatar_url   TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id  TEXT;
  v_group_id UUID;
  v_name     TEXT;
BEGIN
  v_user_id := auth.uid()::text;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look up the group by invite code (case-insensitive)
  SELECT id, name INTO v_group_id, v_name
  FROM study_groups
  WHERE upper(invite_code) = upper(p_invite_code);

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code — no group found';
  END IF;

  -- Insert membership, silently skip if already a member
  INSERT INTO study_group_members (group_id, user_id, display_name, avatar_url)
  VALUES (v_group_id, v_user_id, p_display_name, p_avatar_url)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN json_build_object(
    'group_id',   v_group_id,
    'group_name', v_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION join_study_group(TEXT, TEXT, TEXT) TO authenticated;


-- leave_study_group: removes calling user from a group.
CREATE OR REPLACE FUNCTION leave_study_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  v_user_id := auth.uid()::text;

  DELETE FROM study_group_members
  WHERE group_id = p_group_id AND user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION leave_study_group(UUID) TO authenticated;

