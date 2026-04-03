'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const goalSchema = z.object({
  student_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  target_date: z.string().optional(),
})

export async function createGoal(data: z.infer<typeof goalSchema>) {
  const result = goalSchema.safeParse(data)
  if (!result.success) return { error: 'Invalid goal data.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase.from('student_goals').insert({
    student_id: result.data.student_id,
    teacher_id: user.id,
    title: result.data.title,
    description: result.data.description ?? null,
    target_date: result.data.target_date || null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/students/${result.data.student_id}`)
  return { success: true }
}

export async function updateGoalStatus(goalId: string, status: string, studentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('student_goals')
    .update({ status })
    .eq('id', goalId)
    .eq('teacher_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/students/${studentId}`)
  return { success: true }
}

const snapshotSchema = z.object({
  student_id: z.string().uuid(),
  cefr_level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  speaking_score: z.number().min(1).max(10).optional(),
  listening_score: z.number().min(1).max(10).optional(),
  reading_score: z.number().min(1).max(10).optional(),
  writing_score: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
})

export async function createProgressSnapshot(data: z.infer<typeof snapshotSchema>) {
  const result = snapshotSchema.safeParse(data)
  if (!result.success) return { error: 'Invalid snapshot data.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase.from('progress_snapshots').insert({
    student_id: result.data.student_id,
    teacher_id: user.id,
    cefr_level: result.data.cefr_level ?? null,
    speaking_score: result.data.speaking_score ?? null,
    listening_score: result.data.listening_score ?? null,
    reading_score: result.data.reading_score ?? null,
    writing_score: result.data.writing_score ?? null,
    notes: result.data.notes ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/students/${result.data.student_id}`)
  return { success: true }
}
