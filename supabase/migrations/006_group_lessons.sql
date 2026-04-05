-- ============================================================
-- 006 - Group lesson support
-- Allows one lesson to have multiple student participants
-- ============================================================

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS lesson_participants (
  lesson_id  UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, student_id)
);

ALTER TABLE lesson_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage participants for their lessons"
  ON lesson_participants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lessons l
      WHERE l.id = lesson_participants.lesson_id AND l.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their lesson participation"
  ON lesson_participants FOR SELECT
  USING (student_id = auth.uid());
