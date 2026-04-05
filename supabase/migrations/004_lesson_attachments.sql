-- ============================================================
-- LESSON ATTACHMENTS
-- File/photo attachments for lesson notes
-- Requires 'lesson-attachments' bucket created in Supabase
-- Storage dashboard (set to private/restricted access)
-- ============================================================

CREATE TABLE lesson_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  uploader_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  file_name    TEXT NOT NULL,
  file_size    BIGINT NOT NULL,
  mime_type    TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lesson_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage attachments for their lessons"
  ON lesson_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lessons l
      WHERE l.id = lesson_attachments.lesson_id AND l.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can read attachments for their lessons"
  ON lesson_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lessons l
      WHERE l.id = lesson_attachments.lesson_id AND l.student_id = auth.uid()
    )
  );

-- ============================================================
-- STORAGE POLICIES
-- These require the 'lesson-attachments' bucket to exist.
-- Files are stored at path: {lessonId}/{timestamp_filename}
-- ============================================================

CREATE POLICY "Teachers can upload to their lesson folders"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-attachments'
    AND EXISTS (
      SELECT 1 FROM lessons
      WHERE id::text = (storage.foldername(name))[1]
        AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Lesson participants can read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lesson-attachments'
    AND EXISTS (
      SELECT 1 FROM lessons
      WHERE id::text = (storage.foldername(name))[1]
        AND (teacher_id = auth.uid() OR student_id = auth.uid())
    )
  );

CREATE POLICY "Teachers can delete their lesson attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lesson-attachments'
    AND EXISTS (
      SELECT 1 FROM lessons
      WHERE id::text = (storage.foldername(name))[1]
        AND teacher_id = auth.uid()
    )
  );
