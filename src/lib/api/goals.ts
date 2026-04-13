import { supabase } from '@/lib/supabase'

export async function createGoal(data: {
  student_id: string
  title: string
  description?: string
  target_date?: string
}): Promise<{ error?: string; success?: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase.from('student_goals').insert({
    student_id: data.student_id,
    teacher_id: user.id,
    title: data.title,
    description: data.description ?? null,
    target_date: data.target_date || null,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateGoal(
  goalId: string,
  data: { title: string; description?: string; target_date?: string; status: string },
): Promise<{ error?: string; success?: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('student_goals')
    .update({
      title: data.title,
      description: data.description || null,
      target_date: data.target_date || null,
      status: data.status,
    })
    .eq('id', goalId)
    .eq('teacher_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateGoalStatus(
  goalId: string,
  status: string,
): Promise<{ error?: string; success?: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('student_goals')
    .update({ status })
    .eq('id', goalId)
    .eq('teacher_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function createProgressSnapshot(data: {
  student_id: string
  cefr_level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  speaking_score?: number
  listening_score?: number
  reading_score?: number
  writing_score?: number
  notes?: string
}): Promise<{ error?: string; success?: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase.from('progress_snapshots').insert({
    student_id: data.student_id,
    teacher_id: user.id,
    cefr_level: data.cefr_level ?? null,
    speaking_score: data.speaking_score ?? null,
    listening_score: data.listening_score ?? null,
    reading_score: data.reading_score ?? null,
    writing_score: data.writing_score ?? null,
    notes: data.notes ?? null,
  })

  if (error) return { error: error.message }
  return { success: true }
}
