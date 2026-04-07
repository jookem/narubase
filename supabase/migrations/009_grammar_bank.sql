CREATE TABLE IF NOT EXISTS grammar_bank (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id    uuid REFERENCES lessons(id) ON DELETE SET NULL,
  point        text NOT NULL,
  explanation  text NOT NULL,
  examples     text[] NOT NULL DEFAULT '{}',
  mastery_level int NOT NULL DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 3),
  next_review  date,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (student_id, point)
);

ALTER TABLE grammar_bank ENABLE ROW LEVEL SECURITY;

-- Teachers can fully manage grammar for their students
CREATE POLICY "Teachers manage grammar for their students"
  ON grammar_bank
  USING (
    teacher_id = auth.uid()
    OR are_related(auth.uid(), student_id)
  )
  WITH CHECK (teacher_id = auth.uid());

-- Students can read and update mastery on their own entries
CREATE POLICY "Students read their own grammar"
  ON grammar_bank
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students update mastery on their own grammar"
  ON grammar_bank
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_grammar_bank_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER grammar_bank_updated_at
  BEFORE UPDATE ON grammar_bank
  FOR EACH ROW EXECUTE FUNCTION update_grammar_bank_updated_at();
