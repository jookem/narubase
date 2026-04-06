-- Allow per-student notes within a group lesson.
-- NULL student_id = shared group note (existing behaviour).
-- Non-null student_id = individual note for that student.

ALTER TABLE lesson_notes ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES profiles(id);

-- Drop the old single-column unique constraint (lesson_id only)
ALTER TABLE lesson_notes DROP CONSTRAINT IF EXISTS lesson_notes_lesson_id_key;

-- One group note per lesson
CREATE UNIQUE INDEX IF NOT EXISTS lesson_notes_group_unique
  ON lesson_notes(lesson_id) WHERE student_id IS NULL;

-- One individual note per student per lesson
CREATE UNIQUE INDEX IF NOT EXISTS lesson_notes_individual_unique
  ON lesson_notes(lesson_id, student_id) WHERE student_id IS NOT NULL;
