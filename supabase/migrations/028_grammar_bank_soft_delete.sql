-- Add is_active flag to grammar_bank so unassigning a deck preserves mastery history
ALTER TABLE grammar_bank ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
