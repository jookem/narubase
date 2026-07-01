-- get_classmates: returns students who share a teacher with the requesting student
CREATE OR REPLACE FUNCTION get_classmates(requesting_student_id UUID)
RETURNS TABLE (id UUID, full_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.full_name
  FROM profiles p
  JOIN teacher_student_relationships tsr_them
    ON tsr_them.student_id = p.id AND tsr_them.status = 'active'
  JOIN teacher_student_relationships tsr_me
    ON tsr_me.teacher_id = tsr_them.teacher_id
   AND tsr_me.student_id = requesting_student_id
   AND tsr_me.status = 'active'
  WHERE p.id != requesting_student_id
    AND p.role = 'student'
  ORDER BY p.full_name
$$;

CREATE TABLE IF NOT EXISTS kid_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player2_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  game             TEXT NOT NULL,
  score            INTEGER NOT NULL DEFAULT 0,
  words_correct    INTEGER NOT NULL DEFAULT 0,
  words_attempted  INTEGER NOT NULL DEFAULT 0,
  streak_best      INTEGER NOT NULL DEFAULT 0,
  played_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kid_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students insert own kid sessions"
  ON kid_sessions FOR INSERT
  WITH CHECK (player1_id = auth.uid());

CREATE POLICY "Students read own kid sessions"
  ON kid_sessions FOR SELECT
  USING (player1_id = auth.uid() OR player2_id = auth.uid());

CREATE POLICY "Teachers read student kid sessions"
  ON kid_sessions FOR SELECT
  USING (
    auth_user_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM teacher_student_relationships tsr
      WHERE tsr.teacher_id = auth.uid()
        AND (tsr.student_id = kid_sessions.player1_id OR tsr.student_id = kid_sessions.player2_id)
        AND tsr.status = 'active'
    )
  );
