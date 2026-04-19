-- Allow all teachers to read all lessons (shared calendar view)
CREATE POLICY "All teachers can read all lessons"
  ON lessons FOR SELECT
  USING (auth_user_role() = 'teacher');

-- Allow all teachers to read all booking requests (shared calendar)
CREATE POLICY "All teachers can read all booking requests"
  ON booking_requests FOR SELECT
  USING (auth_user_role() = 'teacher');

-- Allow teachers to read other teachers' profiles (for calendar toggle buttons)
CREATE POLICY "Teachers can read teacher profiles"
  ON profiles FOR SELECT
  USING (
    auth_user_role() = 'teacher'
    AND role = 'teacher'
  );

-- Allow teachers to read all teacher_student_relationships (shared student view)
CREATE POLICY "All teachers can read all relationships"
  ON teacher_student_relationships FOR SELECT
  USING (auth_user_role() = 'teacher');
