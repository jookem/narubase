-- Puzzle deck templates (teacher-owned)
CREATE TABLE IF NOT EXISTS puzzle_decks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Individual puzzles inside a deck
-- parts is stored in CORRECT order: [{text, label}]
-- The app scrambles client-side for the game
CREATE TABLE IF NOT EXISTS puzzles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id           uuid NOT NULL REFERENCES puzzle_decks(id) ON DELETE CASCADE,
  japanese_sentence text NOT NULL,
  hint              text,
  parts             jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz DEFAULT now()
);

-- Per-student completion tracking
CREATE TABLE IF NOT EXISTS puzzle_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id     uuid NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  completed     boolean NOT NULL DEFAULT false,
  attempts      int NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (student_id, puzzle_id)
);

-- Which decks are assigned to which students
CREATE TABLE IF NOT EXISTS puzzle_deck_assignments (
  deck_id    uuid NOT NULL REFERENCES puzzle_decks(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (deck_id, student_id)
);

-- RLS: puzzle_decks
ALTER TABLE puzzle_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their puzzle decks"
  ON puzzle_decks
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Students view assigned puzzle decks"
  ON puzzle_decks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puzzle_deck_assignments pda
      WHERE pda.deck_id = id AND pda.student_id = auth.uid()
    )
  );

-- RLS: puzzles
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage puzzles in their decks"
  ON puzzles
  USING (
    EXISTS (SELECT 1 FROM puzzle_decks d WHERE d.id = deck_id AND d.teacher_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM puzzle_decks d WHERE d.id = deck_id AND d.teacher_id = auth.uid())
  );

CREATE POLICY "Students view puzzles in assigned decks"
  ON puzzles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puzzle_deck_assignments pda
      WHERE pda.deck_id = deck_id AND pda.student_id = auth.uid()
    )
  );

-- RLS: puzzle_progress
ALTER TABLE puzzle_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own progress"
  ON puzzle_progress
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers view their students progress"
  ON puzzle_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM puzzles p
      JOIN puzzle_decks d ON d.id = p.deck_id
      WHERE p.id = puzzle_id AND d.teacher_id = auth.uid()
    )
  );

-- RLS: puzzle_deck_assignments
ALTER TABLE puzzle_deck_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage puzzle deck assignments"
  ON puzzle_deck_assignments
  USING (
    EXISTS (SELECT 1 FROM puzzle_decks d WHERE d.id = deck_id AND d.teacher_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM puzzle_decks d WHERE d.id = deck_id AND d.teacher_id = auth.uid())
  );

CREATE POLICY "Students view their own assignments"
  ON puzzle_deck_assignments FOR SELECT
  USING (student_id = auth.uid());

-- updated_at trigger for puzzle_progress
CREATE OR REPLACE FUNCTION update_puzzle_progress_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER puzzle_progress_updated_at
  BEFORE UPDATE ON puzzle_progress
  FOR EACH ROW EXECUTE FUNCTION update_puzzle_progress_updated_at();
