-- Explicit deck assignment tracking for the Spelling Bee.
-- Rather than inferring "assigned decks" from vocabulary_bank rows (which can have
-- stale/orphaned entries), teachers explicitly assign decks here.
-- The Spelling page reads this table to decide which decks to present.

CREATE TABLE IF NOT EXISTS student_spelling_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id     uuid NOT NULL REFERENCES vocabulary_decks(id) ON DELETE CASCADE,
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE (student_id, deck_id)
);

ALTER TABLE student_spelling_assignments ENABLE ROW LEVEL SECURITY;

-- Teachers manage assignments for their own students
CREATE POLICY "Teachers manage spelling assignments"
  ON student_spelling_assignments
  FOR ALL
  USING (teacher_id = auth.uid());

-- Cross-teacher: any teacher with a relationship to the student can read/remove
CREATE POLICY "Teachers read assignments for their students"
  ON student_spelling_assignments
  FOR SELECT
  USING (
    auth_user_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM teacher_student_relationships tsr
      WHERE tsr.student_id = student_spelling_assignments.student_id
        AND tsr.teacher_id = auth.uid()
        AND tsr.status = 'active'
    )
  );

-- Students read their own assignments
CREATE POLICY "Students read their spelling assignments"
  ON student_spelling_assignments
  FOR SELECT
  USING (student_id = auth.uid());

-- Backfill: create assignments for every (student, deck) pair that currently
-- has active vocabulary_bank entries, so existing students see their decks immediately.
INSERT INTO student_spelling_assignments (student_id, deck_id, teacher_id)
SELECT DISTINCT vb.student_id, vb.deck_id, vb.teacher_id
FROM vocabulary_bank vb
WHERE vb.deck_id IS NOT NULL
  AND vb.is_active = true
ON CONFLICT (student_id, deck_id) DO NOTHING;
