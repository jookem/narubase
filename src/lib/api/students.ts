import { supabase } from '@/lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export async function createPlaceholderStudent(
  name: string,
): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Not authenticated.' }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-placeholder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ name }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error ?? 'Failed to create student.' }
  }

  return {}
}

export async function linkPlaceholderToStudent(
  placeholderId: string,
  realStudentEmail: string,
): Promise<{ error?: string; realStudentName?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Not authenticated.' }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/link-placeholder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ placeholder_id: placeholderId, real_student_email: realStudentEmail }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { error: body.error ?? 'Failed to link account.' }
  return { realStudentName: body.real_student_name }
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
