-- In a multi-teacher school, vocabulary may be assigned to a student by any teacher.
-- The existing "Teachers manage vocab for their students" policy (teacher_id = auth.uid())
-- means teacher A cannot see or unassign vocabulary assigned by teacher B, even for
-- a shared student. This causes the student to see "mystery" decks the current teacher
-- cannot inspect or remove.
--
-- Fix: allow any teacher who has an active relationship with the student to
-- SELECT and UPDATE (including deactivate) any vocabulary_bank rows for that student.
-- INSERT and DELETE remain restricted to the assigning teacher.

CREATE POLICY "Teachers read all vocab for their students"
  ON vocabulary_bank
  FOR SELECT
  USING (
    auth_user_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM teacher_student_relationships tsr
      WHERE tsr.student_id = vocabulary_bank.student_id
        AND tsr.teacher_id = auth.uid()
        AND tsr.status = 'active'
    )
  );

CREATE POLICY "Teachers update vocab for their students"
  ON vocabulary_bank
  FOR UPDATE
  USING (
    auth_user_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM teacher_student_relationships tsr
      WHERE tsr.student_id = vocabulary_bank.student_id
        AND tsr.teacher_id = auth.uid()
        AND tsr.status = 'active'
    )
  );

-- Also allow teachers to read vocabulary_deck_words for any deck assigned to their students,
-- even decks created by a different teacher.
CREATE POLICY "Teachers read deck words for their students"
  ON vocabulary_deck_words
  FOR SELECT
  USING (
    auth_user_role() = 'teacher'
    AND EXISTS (
      SELECT 1
      FROM vocabulary_bank vb
      JOIN teacher_student_relationships tsr ON tsr.student_id = vb.student_id
      WHERE vb.deck_id = vocabulary_deck_words.deck_id
        AND vb.is_active = true
        AND tsr.teacher_id = auth.uid()
        AND tsr.status = 'active'
    )
  );
