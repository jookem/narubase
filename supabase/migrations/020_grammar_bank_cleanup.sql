-- Capture category column on grammar_deck_points (was added directly to DB, not via migration)
ALTER TABLE grammar_deck_points
  ADD COLUMN IF NOT EXISTS category text;

-- Drop legacy content columns from grammar_bank.
-- Under Option B, all content is read live from grammar_deck_points at query time.
-- grammar_bank is now a pure progress tracker: mastery_level + next_review only.
ALTER TABLE grammar_bank
  DROP COLUMN IF EXISTS explanation,
  DROP COLUMN IF EXISTS examples,
  DROP COLUMN IF EXISTS sentence_with_blank,
  DROP COLUMN IF EXISTS answer,
  DROP COLUMN IF EXISTS hint_ja,
  DROP COLUMN IF EXISTS distractors,
  DROP COLUMN IF EXISTS category;
