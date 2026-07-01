-- Phonics Quest: per-student level-map progress, keyed by a static unit id
-- defined in src/lib/phonicsContent.ts (no DB table for unit definitions —
-- content lives in code, only progress lives in the database).

CREATE TABLE IF NOT EXISTS phonics_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id      text NOT NULL,
  stars        smallint NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  attempts     integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, unit_id)
);

ALTER TABLE phonics_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own phonics progress"
  ON phonics_progress FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers read student phonics progress"
  ON phonics_progress FOR SELECT
  USING (
    auth_user_role() = 'teacher'
    AND EXISTS (
      SELECT 1 FROM teacher_student_relationships tsr
      WHERE tsr.student_id = phonics_progress.student_id
        AND tsr.teacher_id = auth.uid()
        AND tsr.status = 'active'
    )
  );

-- Marks vocabulary_bank rows auto-added by Phonics Quest, kept separate from
-- the teacher-facing `category` topic label so it isn't affected by the
-- vocab manager's AI auto-categorize feature or topic filters.
ALTER TABLE vocabulary_bank ADD COLUMN IF NOT EXISTS is_phonics boolean NOT NULL DEFAULT false;
