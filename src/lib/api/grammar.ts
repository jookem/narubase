import { supabase } from '@/lib/supabase'

export type MasteryLevel = 0 | 1 | 2 | 3
export type GrammarRating = 'again' | 'hard' | 'good' | 'easy'

export interface GrammarBankEntry {
  id: string
  student_id: string
  teacher_id: string
  lesson_id: string | null
  point: string
  explanation: string
  examples: string[]
  mastery_level: MasteryLevel
  next_review: string | null
  created_at: string
  updated_at: string
}

const INTERVALS = [1, 3, 7, 14] // days per mastery level — same as vocab

export async function addGrammarToBank(
  entries: {
    student_id: string
    point: string
    explanation: string
    examples?: string[]
    lesson_id?: string
  }[],
): Promise<{ error?: string; success?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('grammar_bank')
    .upsert(
      entries.map(e => ({
        ...e,
        teacher_id: session.user.id,
        examples: e.examples ?? [],
      })),
      { onConflict: 'student_id,point', ignoreDuplicates: true },
    )

  return error ? { error: error.message } : { success: true }
}

export async function listGrammar(
  studentId: string,
): Promise<{ entries?: GrammarBankEntry[]; error?: string }> {
  const { data, error } = await supabase
    .from('grammar_bank')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  return error ? { error: error.message } : { entries: data as GrammarBankEntry[] }
}

export async function deleteGrammarEntry(
  id: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_bank')
    .delete()
    .eq('id', id)

  return error ? { error: error.message } : {}
}

export async function rateGrammarCard(
  id: string,
  currentMastery: MasteryLevel,
  rating: GrammarRating,
): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  let newMastery: number
  let intervalDays: number

  switch (rating) {
    case 'again':
      newMastery = Math.max(0, currentMastery - 1)
      intervalDays = 1
      break
    case 'hard':
      newMastery = currentMastery
      intervalDays = INTERVALS[currentMastery]
      break
    case 'good':
      newMastery = Math.min(3, currentMastery + 1)
      intervalDays = INTERVALS[newMastery]
      break
    case 'easy':
      newMastery = Math.min(3, currentMastery + 2)
      intervalDays = INTERVALS[newMastery] * 2
      break
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + intervalDays)

  const { error } = await supabase
    .from('grammar_bank')
    .update({
      mastery_level: newMastery,
      next_review: nextReview.toISOString().split('T')[0],
    })
    .eq('id', id)

  return error ? { error: error.message } : {}
}
