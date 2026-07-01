import { supabase } from '@/lib/supabase'
import { addVocabularyToBank } from '@/lib/api/lessons'

export interface PhonicsProgressRow {
  unit_id: string
  stars: number
  attempts: number
  completed_at: string | null
}

export async function getPhonicsProgress(
  studentId: string,
): Promise<{ progress: Record<string, PhonicsProgressRow>; error?: string }> {
  const { data, error } = await supabase
    .from('phonics_progress')
    .select('unit_id, stars, attempts, completed_at')
    .eq('student_id', studentId)

  if (error) return { progress: {}, error: error.message }

  const progress: Record<string, PhonicsProgressRow> = {}
  for (const row of data ?? []) progress[row.unit_id] = row as PhonicsProgressRow
  return { progress }
}

export async function recordPhonicsLevelComplete(
  unitId: string,
  stars: 1 | 2 | 3,
): Promise<{ stars?: number; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  const { data: existing } = await supabase
    .from('phonics_progress')
    .select('id, stars, attempts, completed_at')
    .eq('student_id', session.user.id)
    .eq('unit_id', unitId)
    .maybeSingle()

  if (existing) {
    const finalStars = Math.max(existing.stars, stars)
    const { error } = await supabase
      .from('phonics_progress')
      .update({
        stars: finalStars,
        attempts: existing.attempts + 1,
        completed_at: existing.completed_at ?? new Date().toISOString(),
      })
      .eq('id', existing.id)
    return error ? { error: error.message } : { stars: finalStars }
  }

  // upsert (not insert) so a genuine race on first completion — e.g. two
  // tabs, or an effect firing twice — degrades to an overwrite instead of a
  // unique-constraint error.
  const { error } = await supabase
    .from('phonics_progress')
    .upsert({
      student_id: session.user.id,
      unit_id: unitId,
      stars,
      attempts: 1,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'student_id,unit_id' })

  return error ? { error: error.message } : { stars }
}

export async function addPhonicsWordsToBank(
  studentId: string,
  words: { word: string; definition_ja: string; definition_en?: string }[],
): Promise<{ error?: string }> {
  return addVocabularyToBank(
    words.map(w => ({ student_id: studentId, is_phonics: true, ...w })),
  )
}

export interface PhonicsBankRow {
  id: string
  word: string
  mastery_level: 0 | 1 | 2 | 3
  interval_days: number | null
  ease_factor: number
}

export async function getPhonicsWordBankRows(
  studentId: string,
  words: string[],
): Promise<{ rows: PhonicsBankRow[]; error?: string }> {
  if (words.length === 0) return { rows: [] }
  const { data, error } = await supabase
    .from('vocabulary_bank')
    .select('id, word, mastery_level, interval_days, ease_factor')
    .eq('student_id', studentId)
    .in('word', words)

  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as PhonicsBankRow[] }
}
