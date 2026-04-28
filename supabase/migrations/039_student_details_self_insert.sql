-- Students can insert their own details row (needed when no row exists yet
-- and they try to save their VRM avatar URL via upsert)
CREATE POLICY "Students insert own details"
  ON student_details FOR INSERT
  WITH CHECK (student_id = auth.uid());
