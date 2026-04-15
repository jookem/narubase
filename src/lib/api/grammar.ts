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
  sentence_with_blank: string | null
  sentence_ja: string | null
  answer: string | null
  hint_ja: string | null
  distractors: string[]
  category: string | null
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
  sentence_with_blank: string | null
  sentence_ja: string | null
  answer: string | null
  hint_ja: string | null
  distractors: string[]
  category: string | null
  created_at: string
}

export interface GrammarLessonSlide {
  id: string
  deck_id: string
  sort_order: number
  title: string
  explanation: string
  examples: string[]
  hint_ja: string | null
  created_at: string
}

export interface GrammarDeck {
  id: string
  teacher_id: string
  name: string
  created_at: string
  point_count?: number
  points?: GrammarDeckPoint[]
  slides?: GrammarLessonSlide[]
}

const INTERVALS = [1, 3, 7, 14]

// ── Grammar Bank ──────────────────────────────────────────────

export async function listGrammar(
  studentId: string,
): Promise<{ entries?: GrammarBankEntry[]; error?: string }> {
  const { data, error } = await supabase
    .from('grammar_bank')
    .select('id, student_id, teacher_id, lesson_id, deck_id, point, mastery_level, next_review, created_at, updated_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  const allEntries: any[] = data ?? []

  // Merge content from grammar_deck_points for deck-assigned entries
  const deckIds = [...new Set(allEntries.filter(e => e.deck_id).map(e => e.deck_id as string))]
  if (deckIds.length > 0) {
    const { data: points } = await supabase
      .from('grammar_deck_points')
      .select('deck_id, point, explanation, examples, sentence_with_blank, sentence_ja, answer, hint_ja, distractors, category')
      .in('deck_id', deckIds)

    const templateMap = new Map<string, any>()
    for (const p of points ?? []) templateMap.set(`${p.deck_id}:${p.point}`, p)

    for (const entry of allEntries) {
      if (!entry.deck_id) continue
      const t = templateMap.get(`${entry.deck_id}:${entry.point}`)
      if (!t) continue
      entry.explanation = t.explanation
      entry.examples = t.examples ?? []
      entry.sentence_with_blank = t.sentence_with_blank
      entry.sentence_ja = t.sentence_ja
      entry.answer = t.answer
      entry.hint_ja = t.hint_ja
      entry.distractors = t.distractors ?? []
      entry.category = t.category
    }
  }

  return { entries: allEntries as GrammarBankEntry[] }
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
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

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

export type GrammarPointFields = {
  point: string
  explanation: string
  examples?: string[]
  sentence_with_blank?: string
  sentence_ja?: string
  answer?: string
  hint_ja?: string
  distractors?: string[]
  category?: string
}

export async function addPointToDeck(
  deckId: string,
  point: GrammarPointFields,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_deck_points')
    .upsert(
      {
        deck_id: deckId,
        ...point,
        examples: point.examples ?? [],
        distractors: point.distractors ?? [],
      },
      { onConflict: 'deck_id,point', ignoreDuplicates: false },
    )

  return error ? { error: error.message } : {}
}

export async function updateGrammarDeckPoint(
  pointId: string,
  fields: GrammarPointFields,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_deck_points')
    .update({
      ...fields,
      examples: fields.examples ?? [],
      distractors: fields.distractors ?? [],
    })
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

  const points: GrammarDeckPoint[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: fetchErr } = await supabase
      .from('grammar_deck_points')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (fetchErr) return { error: fetchErr.message }
    points.push(...(page ?? []))
    if (!page || page.length < PAGE) break
  }
  if (!points.length) return { count: 0 }

  // Insert only progress rows — content is always read live from grammar_deck_points
  const entries = points.map((p: GrammarDeckPoint) => ({
    student_id: studentId,
    teacher_id: session.user.id,
    deck_id: deckId,
    point: p.point,
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

export async function reorderGrammarDecks(
  ids: string[],
): Promise<{ error?: string }> {
  const updates = ids.map((id, i) =>
    supabase.from('grammar_decks').update({ sort_order: i }).eq('id', id)
  )
  const results = await Promise.all(updates)
  const err = results.find(r => r.error)
  return err?.error ? { error: err.error.message } : {}
}

// ── Grammar Lesson Slides ──────────────────────────────────────

export async function listLessonSlides(
  deckId: string,
): Promise<{ slides?: GrammarLessonSlide[]; error?: string }> {
  const { data, error } = await supabase
    .from('grammar_lesson_slides')
    .select('*')
    .eq('deck_id', deckId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return error ? { error: error.message } : { slides: data as GrammarLessonSlide[] }
}

export async function addLessonSlide(
  deckId: string,
  fields: { title: string; explanation: string; examples: string[]; hint_ja?: string },
): Promise<{ slide?: GrammarLessonSlide; error?: string }> {
  // Place at end of current list
  const { data: existing } = await supabase
    .from('grammar_lesson_slides')
    .select('sort_order')
    .eq('deck_id', deckId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('grammar_lesson_slides')
    .insert({ deck_id: deckId, sort_order, ...fields, hint_ja: fields.hint_ja ?? null })
    .select()
    .single()

  return error ? { error: error.message } : { slide: data as GrammarLessonSlide }
}

export async function updateLessonSlide(
  slideId: string,
  fields: { title: string; explanation: string; examples: string[]; hint_ja?: string },
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_lesson_slides')
    .update({ ...fields, hint_ja: fields.hint_ja ?? null })
    .eq('id', slideId)

  return error ? { error: error.message } : {}
}

export async function removeLessonSlide(
  slideId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('grammar_lesson_slides')
    .delete()
    .eq('id', slideId)

  return error ? { error: error.message } : {}
}

export async function reorderLessonSlides(
  slideIds: string[],
): Promise<{ error?: string }> {
  const updates = slideIds.map((id, i) =>
    supabase.from('grammar_lesson_slides').update({ sort_order: i }).eq('id', id)
  )
  const results = await Promise.all(updates)
  const err = results.find(r => r.error)
  return err?.error ? { error: err.error.message } : {}
}
