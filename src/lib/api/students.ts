import { supabase } from '@/lib/supabase'

async function extractFnError(error: unknown, fallback: string): Promise<string> {
  try {
    const body = await (error as any).context?.json?.()
    if (body?.error) return body.error
  } catch {}
  return (error as any)?.message ?? fallback
}

export async function createPlaceholderStudent(
  name: string,
  initial_password: string,
): Promise<{ error?: string }> {
  const { data, error } = await supabase.functions.invoke('create-placeholder', {
    body: { name, initial_password },
  })
  if (error) return { error: await extractFnError(error, 'Failed to create student.') }
  return {}
}

export async function setStudentPassword(
  studentId: string,
  password: string,
): Promise<{ error?: string }> {
  const { data, error } = await supabase.functions.invoke('set-student-password', {
    body: { student_id: studentId, password },
  })
  if (error) return { error: await extractFnError(error, 'Failed to set password.') }
  return {}
}

export async function linkPlaceholderToStudent(
  placeholderId: string,
  realStudentEmail: string,
): Promise<{ error?: string; realStudentName?: string }> {
  const { data, error } = await supabase.functions.invoke('link-placeholder', {
    body: { placeholder_id: placeholderId, real_student_email: realStudentEmail },
  })
  if (error) return { error: await extractFnError(error, 'Failed to link account.') }
  return { realStudentName: data?.real_student_name }
}

export type StudentDetailsInput = {
  age?: number | null
  grade?: string | null
  school_name?: string | null
  occupation?: string | null
  eiken_grade?: string | null
  toeic_score?: number | null
  ielts_score?: number | null
  toefl_score?: number | null
  self_cefr?: string | null
  hobbies?: string | null
  likes?: string | null
  dislikes?: string | null
  learning_goals?: string | null
  notes?: string | null
}

function cleanDetails(d: StudentDetailsInput) {
  return {
    age: d.age || null,
    grade: d.grade || null,
    school_name: d.school_name?.trim() || null,
    occupation: d.occupation?.trim() || null,
    eiken_grade: d.eiken_grade || null,
    toeic_score: d.toeic_score || null,
    ielts_score: d.ielts_score || null,
    toefl_score: d.toefl_score || null,
    self_cefr: d.self_cefr || null,
    hobbies: d.hobbies?.trim() || null,
    likes: d.likes?.trim() || null,
    dislikes: d.dislikes?.trim() || null,
    learning_goals: d.learning_goals?.trim() || null,
    notes: d.notes?.trim() || null,
  }
}

// NOTE: Requires RLS policy on profiles: FOR SELECT TO authenticated USING (true)
// so teachers can look up student profiles by email.
export async function addStudentByEmail(
  email: string,
  details?: StudentDetailsInput,
): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: student } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!student) return { error: 'No account found with that email address.' }
  if (student.role !== 'student') return { error: 'That account is not a student.' }
  if (student.id === user.id) return { error: 'You cannot add yourself.' }

  const { data: existing } = await supabase
    .from('teacher_student_relationships')
    .select('id, status')
    .eq('teacher_id', user.id)
    .eq('student_id', student.id)
    .single()

  if (existing) {
    if (existing.status !== 'active') {
      const { error } = await supabase
        .from('teacher_student_relationships')
        .update({ status: 'active', ended_at: null })
        .eq('id', existing.id)
      if (error) return { error: 'Failed to re-activate relationship.' }
    }
  } else {
    const { error } = await supabase
      .from('teacher_student_relationships')
      .insert({ teacher_id: user.id, student_id: student.id })
    if (error) return { error: 'Failed to add student.' }
  }

  if (details) {
    await supabase
      .from('student_details')
      .upsert({ student_id: student.id, ...cleanDetails(details) })
  }

  return {}
}

export async function updateStudentDetails(
  studentId: string,
  details: StudentDetailsInput,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('student_details')
    .upsert({ student_id: studentId, ...cleanDetails(details) })
  if (error) return { error: 'Failed to save student details.' }
  return {}
}

export async function joinTeacherByCode(
  code: string,
): Promise<{ error?: string; teacherName?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: teacher } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('invite_code', code.trim().toUpperCase())
    .eq('role', 'teacher')
    .single()

  if (!teacher) return { error: 'Invalid code. Please check with your teacher.' }

  const { data: existing } = await supabase
    .from('teacher_student_relationships')
    .select('id, status')
    .eq('teacher_id', teacher.id)
    .eq('student_id', user.id)
    .single()

  if (existing) {
    if (existing.status === 'active') return { error: "You're already linked to this teacher." }
    const { error } = await supabase
      .from('teacher_student_relationships')
      .update({ status: 'active', ended_at: null })
      .eq('id', existing.id)
    if (error) return { error: 'Failed to join.' }
    return { teacherName: teacher.full_name }
  }

  const { error } = await supabase
    .from('teacher_student_relationships')
    .insert({ teacher_id: teacher.id, student_id: user.id })
  if (error) return { error: 'Failed to join.' }
  return { teacherName: teacher.full_name }
}

export async function removeStudent(studentId: string): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('teacher_student_relationships')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('teacher_id', user.id)
    .eq('student_id', studentId)

  if (error) return { error: 'Failed to remove student.' }
  return {}
}

export async function updateStudentName(
  studentId: string,
  fullName: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', studentId)

  if (error) return { error: error.message }
  return {}
}
