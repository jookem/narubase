import { supabase } from '@/lib/supabase'

export interface PuzzlePart {
  text: string
  label: string
}

export interface Puzzle {
  id: string
  deck_id: string
  japanese_sentence: string
  hint: string | null
  parts: PuzzlePart[]
  created_at: string
}

export interface PuzzleDeck {
  id: string
  teacher_id: string
  name: string
  folder: string | null
  created_at: string
  puzzle_count?: number
  puzzles?: Puzzle[]
}

export interface PuzzleProgress {
  puzzle_id: string
  completed: boolean
  attempts: number
}

// ── Decks ─────────────────────────────────────────────────────

export async function listPuzzleDecks(): Promise<{ decks?: PuzzleDeck[]; error?: string }> {
  const { data, error } = await supabase
    .from('puzzle_decks')
    .select('*, puzzles(count)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const decks = (data ?? []).map((d: any) => ({
    ...d,
    puzzle_count: d.puzzles?.[0]?.count ?? 0,
    puzzles: undefined,
  }))

  return { decks }
}

export async function getPuzzleDeckWithPuzzles(
  deckId: string,
): Promise<{ deck?: PuzzleDeck; error?: string }> {
  const { data, error } = await supabase
    .from('puzzle_decks')
    .select('*, puzzles(*)')
    .eq('id', deckId)
    .single()

  if (error) return { error: error.message }
  return { deck: data as PuzzleDeck }
}

export async function createPuzzleDeck(
  name: string,
): Promise<{ deck?: PuzzleDeck; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase
    .from('puzzle_decks')
    .insert({ name, teacher_id: session.user.id })
    .select()
    .single()

  if (error) return { error: error.message }
  return { deck: data as PuzzleDeck }
}

export async function renamePuzzleDeck(
  deckId: string,
  name: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('puzzle_decks')
    .update({ name })
    .eq('id', deckId)

  return error ? { error: error.message } : {}
}

export async function deletePuzzleDeck(
  deckId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('puzzle_decks')
    .delete()
    .eq('id', deckId)

  return error ? { error: error.message } : {}
}

// ── Puzzles ───────────────────────────────────────────────────

export async function createPuzzle(
  deckId: string,
  data: { japanese_sentence: string; hint?: string; parts: PuzzlePart[] },
): Promise<{ puzzle?: Puzzle; error?: string }> {
  const { data: row, error } = await supabase
    .from('puzzles')
    .insert({ deck_id: deckId, ...data })
    .select()
    .single()

  if (error) return { error: error.message }
  return { puzzle: row as Puzzle }
}

export async function updatePuzzle(
  puzzleId: string,
  data: { japanese_sentence?: string; hint?: string; parts?: PuzzlePart[] },
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('puzzles')
    .update(data)
    .eq('id', puzzleId)

  return error ? { error: error.message } : {}
}

export async function deletePuzzle(
  puzzleId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('puzzles')
    .delete()
    .eq('id', puzzleId)

  return error ? { error: error.message } : {}
}

export async function deletePuzzles(puzzleIds: string[]): Promise<{ error?: string }> {
  if (puzzleIds.length === 0) return {}
  const { error } = await supabase.from('puzzles').delete().in('id', puzzleIds)
  return error ? { error: error.message } : {}
}

// ── Assignments ───────────────────────────────────────────────

export async function assignPuzzleDeckToStudent(
  deckId: string,
  studentId: string,
): Promise<{ error?: string }> {
  // Fetch teacher_id from the deck so we can store it on the assignment
  // (required for non-recursive RLS on puzzle_deck_assignments)
  const { data: deck, error: deckErr } = await supabase
    .from('puzzle_decks')
    .select('teacher_id')
    .eq('id', deckId)
    .single()

  if (deckErr || !deck) return { error: deckErr?.message ?? 'Deck not found.' }

  const { error } = await supabase
    .from('puzzle_deck_assignments')
    .upsert(
      { deck_id: deckId, student_id: studentId, teacher_id: deck.teacher_id },
      { ignoreDuplicates: true },
    )

  return error ? { error: error.message } : {}
}

export async function removePuzzleDeckFromStudent(
  deckId: string,
  studentId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('puzzle_deck_assignments')
    .delete()
    .eq('deck_id', deckId)
    .eq('student_id', studentId)

  return error ? { error: error.message } : {}
}

export async function getAssignedDeckIds(
  studentId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('puzzle_deck_assignments')
    .select('deck_id')
    .eq('student_id', studentId)

  return (data ?? []).map((r: any) => r.deck_id)
}

// ── Progress ──────────────────────────────────────────────────

export async function getStudentProgress(
  studentId: string,
  deckId: string,
): Promise<{ progress?: PuzzleProgress[]; error?: string }> {
  const { data: puzzleIds } = await supabase
    .from('puzzles')
    .select('id')
    .eq('deck_id', deckId)

  if (!puzzleIds?.length) return { progress: [] }

  const { data, error } = await supabase
    .from('puzzle_progress')
    .select('puzzle_id, completed, attempts')
    .eq('student_id', studentId)
    .in('puzzle_id', puzzleIds.map((p: any) => p.id))

  return error ? { error: error.message } : { progress: data as PuzzleProgress[] }
}

export async function recordPuzzleAttempt(
  puzzleId: string,
  completed: boolean,
): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  const { data: existing } = await supabase
    .from('puzzle_progress')
    .select('id, attempts, completed')
    .eq('student_id', session.user.id)
    .eq('puzzle_id', puzzleId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('puzzle_progress')
      .update({
        attempts: existing.attempts + 1,
        completed: existing.completed || completed,
      })
      .eq('id', existing.id)
    return error ? { error: error.message } : {}
  }

  const { error } = await supabase
    .from('puzzle_progress')
    .insert({
      student_id: session.user.id,
      puzzle_id: puzzleId,
      completed,
      attempts: 1,
    })

  return error ? { error: error.message } : {}
}

// ── Student view ──────────────────────────────────────────────

export async function getAssignedDecksWithPuzzles(
  studentId: string,
): Promise<{ decks?: (PuzzleDeck & { puzzles: Puzzle[] })[]; error?: string }> {
  const assignedIds = await getAssignedDeckIds(studentId)
  if (!assignedIds.length) return { decks: [] }

  const { data, error } = await supabase
    .from('puzzle_decks')
    .select('*, puzzles(*)')
    .in('id', assignedIds)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { decks: data as (PuzzleDeck & { puzzles: Puzzle[] })[] }
}

export async function reorderPuzzleDecks(
  ids: string[],
): Promise<{ error?: string }> {
  const updates = ids.map((id, i) =>
    supabase.from('puzzle_decks').update({ sort_order: i }).eq('id', id)
  )
  const results = await Promise.all(updates)
  const err = results.find(r => r.error)
  return err?.error ? { error: err.error.message } : {}
}

export async function updatePuzzleDeckFolder(
  deckId: string,
  folder: string | null,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('puzzle_decks')
    .update({ folder })
    .eq('id', deckId)
  return error ? { error: error.message } : {}
}
