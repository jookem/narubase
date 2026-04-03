-- ============================================================
-- Student Details
-- Extended profile info managed by the teacher
-- ============================================================

CREATE TABLE student_details (
  student_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  age             SMALLINT,
  grade           TEXT,          -- e.g. 'elementary_3', 'middle_2', 'high_1', 'university', 'adult'
  school_name     TEXT,
  occupation      TEXT,
  -- English proficiency
  eiken_grade     TEXT,          -- '5', '4', '3', 'pre-2', '2', 'pre-1', '1'
  toeic_score     SMALLINT CHECK (toeic_score BETWEEN 10 AND 990),
  ielts_score     NUMERIC(3,1)  CHECK (ielts_score BETWEEN 0 AND 9),
  toefl_score     SMALLINT      CHECK (toefl_score BETWEEN 0 AND 120),
  self_cefr       TEXT          CHECK (self_cefr IN ('A1','A2','B1','B2','C1','C2')),
  -- Personal
  hobbies         TEXT,
  likes           TEXT,
  dislikes        TEXT,
  learning_goals  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER student_details_updated_at BEFORE UPDATE ON student_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE student_details ENABLE ROW LEVEL SECURITY;

-- Students can read their own details
CREATE POLICY "Students read own details"
  ON student_details FOR SELECT
  USING (student_id = auth.uid());

-- Teachers can read details for students they are related to
CREATE POLICY "Teachers read their students details"
  ON student_details FOR SELECT
  USING (are_related(auth.uid(), student_id));

-- Teachers can insert details for their students
CREATE POLICY "Teachers insert student details"
  ON student_details FOR INSERT
  WITH CHECK (are_related(auth.uid(), student_id));

-- Teachers can update details for their students
CREATE POLICY "Teachers update student details"
  ON student_details FOR UPDATE
  USING (are_related(auth.uid(), student_id));
