-- Public RPC: returns students in a class by teacher invite code.
-- Used for the no-email student login flow (unauthenticated).
-- Returns the internal email so the client can call signInWithPassword.
CREATE OR REPLACE FUNCTION public.get_class_students(class_code TEXT)
RETURNS TABLE(id UUID, full_name TEXT, email TEXT)
LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT p.id, p.full_name, p.email
  FROM profiles p
  JOIN teacher_student_relationships tsr ON tsr.student_id = p.id
  JOIN profiles teacher ON teacher.id = tsr.teacher_id
  WHERE UPPER(teacher.invite_code) = UPPER(class_code)
    AND tsr.status = 'active'
    AND p.role = 'student'
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_students(TEXT) TO anon, authenticated;
