'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

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

export async function addStudentByEmail(
  email: string,
  details?: StudentDetailsInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: student } = await admin
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
    if (existing.status === 'active') {
      // Still update details if provided
      if (details) {
        await admin.from('student_details').upsert({ student_id: student.id, ...cleanDetails(details) })
      }
      revalidatePath('/students')
      return {}
    }
    const { error } = await supabase
      .from('teacher_student_relationships')
      .update({ status: 'active', ended_at: null })
      .eq('id', existing.id)
    if (error) return { error: 'Failed to re-activate relationship.' }
  } else {
    const { error } = await supabase
      .from('teacher_student_relationships')
      .insert({ teacher_id: user.id, student_id: student.id })
    if (error) return { error: 'Failed to add student.' }
  }

  // Save extended details using admin client (relationship may not be committed yet for RLS)
  if (details) {
    await admin.from('student_details').upsert({ student_id: student.id, ...cleanDetails(details) })
  }

  revalidatePath('/students')
  return {}
}

export async function updateStudentDetails(
  studentId: string,
  details: StudentDetailsInput,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('student_details')
    .upsert({ student_id: studentId, ...cleanDetails(details) })
  if (error) return { error: 'Failed to save student details.' }
  revalidatePath(`/students/${studentId}`)
  return {}
}

export async function removeStudent(studentId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('teacher_student_relationships')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('teacher_id', user.id)
    .eq('student_id', studentId)

  if (error) return { error: 'Failed to remove student.' }
  revalidatePath('/students')
  return {}
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
