import { supabase } from '@/lib/supabase'

export async function createGoal(data: {
  student_id: string
  title: string
  description?: string
  target_date?: string
}): Promise<{ error?: string; success?: boolean; goalId?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: row, error } = await supabase.from('student_goals').insert({
    student_id: data.student_id,
    teacher_id: user.id,
    title: data.title,
    description: data.description ?? null,
    target_date: data.target_date || null,
  }).select('id').single()

  if (error) return { error: error.message }
  return { success: true, goalId: row.id }
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

// ── Milestones ────────────────────────────────────────────────

export async function listMilestones(goalId: string): Promise<{ milestones?: any[]; error?: string }> {
  const { data, error } = await supabase
    .from('goal_milestones')
    .select('*')
    .eq('goal_id', goalId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return error ? { error: error.message } : { milestones: data ?? [] }
}

export async function addMilestone(goalId: string, studentId: string, title: string, sortOrder = 0): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('goal_milestones')
    .insert({ goal_id: goalId, student_id: studentId, title, sort_order: sortOrder })
  return error ? { error: error.message } : {}
}

export async function toggleMilestone(milestoneId: string, completed: boolean): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('goal_milestones')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', milestoneId)
  return error ? { error: error.message } : {}
}

export async function deleteMilestone(milestoneId: string): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Verify ownership through the parent goal's teacher_id
  const { data: milestone } = await supabase
    .from('goal_milestones').select('goal_id').eq('id', milestoneId).single()
  if (!milestone) return { error: 'Milestone not found.' }

  const { data: goal } = await supabase
    .from('student_goals').select('teacher_id').eq('id', milestone.goal_id).single()
  if (goal?.teacher_id !== user.id) return { error: 'Unauthorized.' }

  const { error } = await supabase.from('goal_milestones').delete().eq('id', milestoneId)
  return error ? { error: error.message } : {}
}

// ── Study streak ──────────────────────────────────────────────

export async function getStudyStreak(studentId: string): Promise<number> {
  const { data } = await supabase
    .from('study_logs')
    .select('studied_date')
    .eq('student_id', studentId)
    .order('studied_date', { ascending: false })
    .limit(90)

  if (!data?.length) return 0

  const dates = new Set(data.map(r => r.studied_date))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (dates.has(key)) streak++
    else if (i > 0) break // gap found — stop (allow today to be missing)
  }
  return streak
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
