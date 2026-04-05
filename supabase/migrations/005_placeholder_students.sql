-- ============================================================
-- 005 - Placeholder students
-- Allows teachers to create placeholder profiles for students
-- who haven't signed up yet. When the real student joins,
-- all their data is migrated via the link-placeholder function.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN NOT NULL DEFAULT FALSE;

-- Teachers can insert placeholder profiles (needed by edge function via service role)
-- Students can view placeholder profiles for their teacher's roster display
-- No additional RLS needed — edge function uses service role key
