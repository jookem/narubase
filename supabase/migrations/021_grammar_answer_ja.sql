-- Add answer_ja to grammar_deck_points: Japanese equivalent of the answer,
-- shown in the blank on Pattern flashcards so students can think logically.
ALTER TABLE grammar_deck_points
  ADD COLUMN IF NOT EXISTS answer_ja text;
