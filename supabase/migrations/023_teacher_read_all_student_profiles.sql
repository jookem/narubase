-- Allow any teacher to read any student profile.
-- Needed for cross-teacher queries (shared student list, calendar joins).
CREATE POLICY "All teachers can read student profiles"
  ON profiles FOR SELECT
  USING (
    auth_user_role() = 'teacher'
    AND role = 'student'
  );
