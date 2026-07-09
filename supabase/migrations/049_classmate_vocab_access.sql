-- Duo kids-game mode lets one logged-in student pick a classmate as "Player 2"
-- and pass the device back and forth. Flashcard Fiesta then needs Player 2's
-- own vocabulary_bank rows, but "Students read their own vocabulary"
-- (student_id = auth.uid()) silently blocks that read for anyone but the
-- classmate themselves — the fetch just returns zero rows, no error, so the
-- UI shows "No vocabulary yet!" after the hand-off even though Player 2 has
-- words assigned. get_classmates (047) already establishes who counts as a
-- classmate (shares an active teacher with the requester); reuse that same
-- check here, SECURITY DEFINER, to hand back Player 2's active vocab with
-- the same deck-template overlay getStudentVocab() applies for the logged-in
-- student's own words.
CREATE OR REPLACE FUNCTION get_classmate_vocab(requesting_student_id UUID, classmate_id UUID)
RETURNS SETOF vocabulary_bank
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vb.id, vb.student_id, vb.teacher_id, vb.word,
    COALESCE(dw.reading, vb.reading) AS reading,
    COALESCE(dw.definition_en, vb.definition_en) AS definition_en,
    COALESCE(dw.definition_ja, vb.definition_ja) AS definition_ja,
    COALESCE(dw.example, vb.example) AS example,
    vb.lesson_id, vb.mastery_level, vb.next_review, vb.created_at, vb.updated_at,
    vb.image_url, vb.deck_id,
    COALESCE(dw.quiz_sentence, vb.quiz_sentence) AS quiz_sentence,
    COALESCE(to_jsonb(dw.quiz_distractors), vb.quiz_distractors) AS quiz_distractors,
    COALESCE(dw.category, vb.category) AS category,
    vb.is_active,
    CASE WHEN vb.deck_id IS NOT NULL THEN dw.quiz_answer ELSE vb.quiz_answer END AS quiz_answer,
    vb.interval_days, vb.ease_factor, vb.is_phonics
  FROM vocabulary_bank vb
  LEFT JOIN vocabulary_deck_words dw ON dw.deck_id = vb.deck_id AND dw.word = vb.word
  WHERE vb.student_id = classmate_id
    AND vb.is_active = true
    AND EXISTS (
      SELECT 1 FROM teacher_student_relationships tsr_them
      JOIN teacher_student_relationships tsr_me
        ON tsr_me.teacher_id = tsr_them.teacher_id
       AND tsr_me.student_id = requesting_student_id
       AND tsr_me.status = 'active'
      WHERE tsr_them.student_id = classmate_id
        AND tsr_them.status = 'active'
    )
  ORDER BY vb.word;
$$;
