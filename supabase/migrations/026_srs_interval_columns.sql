-- Add per-card interval tracking for proper SM-2 spaced repetition.
-- interval_days: the current review interval in days (null = card is new, never graduated)
-- ease_factor: per-card multiplier, starts at 2.5, drifts based on rating performance

ALTER TABLE vocabulary_bank
  ADD COLUMN IF NOT EXISTS interval_days  INTEGER,
  ADD COLUMN IF NOT EXISTS ease_factor    REAL NOT NULL DEFAULT 2.5;

ALTER TABLE grammar_bank
  ADD COLUMN IF NOT EXISTS interval_days  INTEGER,
  ADD COLUMN IF NOT EXISTS ease_factor    REAL NOT NULL DEFAULT 2.5;
