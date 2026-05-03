-- Allow students to read word template content for decks they are assigned to.
-- Without this policy, vocabulary_deck_words returns empty for student auth contexts,
-- causing getStudentVocab to skip the merge and leave definition_ja/reading/etc. null.
CREATE POLICY "Students read words in their assigned decks"
  ON vocabulary_deck_words
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vocabulary_bank vb
      WHERE vb.deck_id = vocabulary_deck_words.deck_id
        AND vb.student_id = auth.uid()
        AND vb.is_active = true
    )
  );
