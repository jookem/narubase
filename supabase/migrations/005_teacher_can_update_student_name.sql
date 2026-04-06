-- Allow teachers to update the full_name of students they are related to
CREATE POLICY "Teachers update student name"
  ON profiles FOR UPDATE
  USING (are_related(auth.uid(), id))
  WITH CHECK (are_related(auth.uid(), id));
