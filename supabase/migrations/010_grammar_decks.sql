-- Grammar deck templates (teacher-owned, reusable across students)
CREATE TABLE IF NOT EXISTS grammar_decks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Points inside grammar deck templates
CREATE TABLE IF NOT EXISTS grammar_deck_points (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id     uuid NOT NULL REFERENCES grammar_decks(id) ON DELETE CASCADE,
  point       text NOT NULL,
  explanation text NOT NULL,
  examples    text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  UNIQUE (deck_id, point)
);

-- Track which deck each grammar_bank entry came from
ALTER TABLE grammar_bank
  ADD COLUMN IF NOT EXISTS deck_id uuid REFERENCES grammar_decks(id) ON DELETE CASCADE;

-- RLS for grammar_decks
ALTER TABLE grammar_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their own grammar decks"
  ON grammar_decks
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Students view grammar decks assigned to them"
  ON grammar_decks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM grammar_bank gb
      WHERE gb.deck_id = id AND gb.student_id = auth.uid()
    )
  );

-- RLS for grammar_deck_points
ALTER TABLE grammar_deck_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage points in their grammar decks"
  ON grammar_deck_points
  USING (
    EXISTS (
      SELECT 1 FROM grammar_decks d
      WHERE d.id = deck_id AND d.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grammar_decks d
      WHERE d.id = deck_id AND d.teacher_id = auth.uid()
    )
  );
