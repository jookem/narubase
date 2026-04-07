import { supabase } from '@/lib/supabase'

export type MasteryLevel = 0 | 1 | 2 | 3
export type GrammarRating = 'again' | 'hard' | 'good' | 'easy'

export interface GrammarBankEntry {
  id: string
  student_id: string
  teacher_id: string
  lesson_id: string | null
  deck_id: string | null
  point: string
  explanation: string
  examples: string[]
  mastery_level: MasteryLevel
  next_review: string | null
  created_at: string
  updated_at: string
}

export interface GrammarDeckPoint {
  id: string
  deck_id: string
  point: string
  explanation: string
  examples: string[]
  created_at: string
}

export interface GrammarDeck {
  id: string
  teacher_id: string
  name: string
  created_at: string
  point_count?: number
  points?: GrammarDeckPoint[]
}

const INTERVALS = [1, 3, 7, 14]

// ── Grammar Bank ──────────────────────────────────────────────

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

// ── Grammar Decks ─────────────────────────────────────────────

export async function listGrammarDecks(): Promise<{ decks?: GrammarDeck[]; error?: string }> {
  const { data, error } = await supabase
    .from('grammar_decks')
    .select('*, grammar_deck_points(count)')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  const decks = (data ?? []).map((d: any) => ({
    ...d,
    point_count: d.grammar_deck_points?.[0]?.count ?? 0,
    grammar_deck_points: undefined,
  }))

  return { decks }
}

export async function getGrammarDeckWithPoints(
  deckId: string,
): Promise<{ deck?: GrammarDeck; error?: string }> {
  const { data, error } = await supabase
    .from('grammar_decks')
    .select('*, points:grammar_deck_points(*)')
    .eq('id', deckId)
    .single()

  if (error) return { error: error.message }
  return { deck: data as GrammarDeck }
}

export async function createGrammarDeck(
  name: string,
): Promise<{ deck?: GrammarDeck; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase
    .from('grammar_decks')
    .insert({ name, teacher_id: session.user.id })
    .select()
    .single()

  if (error) return { error: error.message }
  return { deck: data as GrammarDeck }
}

export async function renameGrammarDeck(
  deckId: string,
  name: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_decks')
    .update({ name })
    .eq('id', deckId)

  return error ? { error: error.message } : {}
}

export async function deleteGrammarDeck(
  deckId: string,
): Promise<{ error?: string }> {
  // Remove all student grammar_bank entries from this deck first
  const { error: bankErr } = await supabase
    .from('grammar_bank')
    .delete()
    .eq('deck_id', deckId)

  if (bankErr) return { error: bankErr.message }

  const { error } = await supabase
    .from('grammar_decks')
    .delete()
    .eq('id', deckId)

  return error ? { error: error.message } : {}
}

export async function addPointToDeck(
  deckId: string,
  point: { point: string; explanation: string; examples?: string[] },
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_deck_points')
    .upsert(
      { deck_id: deckId, ...point, examples: point.examples ?? [] },
      { onConflict: 'deck_id,point', ignoreDuplicates: false },
    )

  return error ? { error: error.message } : {}
}

export async function updateGrammarDeckPoint(
  pointId: string,
  fields: { point: string; explanation: string; examples?: string[] },
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_deck_points')
    .update({ ...fields, examples: fields.examples ?? [] })
    .eq('id', pointId)

  return error ? { error: error.message } : {}
}

export async function removePointFromDeck(
  pointId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_deck_points')
    .delete()
    .eq('id', pointId)

  return error ? { error: error.message } : {}
}

export async function assignGrammarDeckToStudent(
  deckId: string,
  studentId: string,
): Promise<{ count?: number; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  const { data: points, error: fetchErr } = await supabase
    .from('grammar_deck_points')
    .select('*')
    .eq('deck_id', deckId)

  if (fetchErr) return { error: fetchErr.message }
  if (!points?.length) return { count: 0 }

  const entries = points.map((p: GrammarDeckPoint) => ({
    student_id: studentId,
    teacher_id: session.user.id,
    deck_id: deckId,
    point: p.point,
    explanation: p.explanation,
    examples: p.examples,
  }))

  const { error } = await supabase
    .from('grammar_bank')
    .upsert(entries, { onConflict: 'student_id,point', ignoreDuplicates: true })

  if (error) return { error: error.message }
  return { count: entries.length }
}

export async function removeGrammarDeckFromStudent(
  deckId: string,
  studentId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_bank')
    .delete()
    .eq('deck_id', deckId)
    .eq('student_id', studentId)

  return error ? { error: error.message } : {}
}
