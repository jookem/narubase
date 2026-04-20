import { supabase } from '@/lib/supabase'
import { convertToWebP } from '@/lib/utils/imageUtils'

export async function saveLessonNotes(data: {
  lesson_id: string
  student_id?: string | null   // null/undefined = group note; string = individual note
  summary?: string
  vocabulary?: { word: string; definition_ja: string; definition_en?: string; definition?: string; example?: string; mastered?: boolean }[]
  grammar_points?: { point: string; explanation: string; examples?: string[] }[]
  homework?: string
  strengths?: string
  areas_to_focus?: string
  teacher_notes?: string
  goal_ids?: string[]
  is_visible_to_student?: boolean
}): Promise<{ error?: string; success?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }
  const user = session.user

  const noteData = {
    lesson_id: data.lesson_id,
    student_id: data.student_id ?? null,
    author_id: user.id,
    summary: data.summary ?? null,
    vocabulary: data.vocabulary ?? [],
    grammar_points: data.grammar_points ?? [],
    homework: data.homework ?? null,
    strengths: data.strengths ?? null,
    areas_to_focus: data.areas_to_focus ?? null,
    teacher_notes: data.teacher_notes ?? null,
    goal_ids: data.goal_ids ?? null,
    is_visible_to_student: data.is_visible_to_student ?? true,
  }

  // Partial unique indexes mean we can't use a simple upsert — select then update/insert
  let existingQuery = supabase.from('lesson_notes').select('id').eq('lesson_id', data.lesson_id)
  existingQuery = data.student_id
    ? existingQuery.eq('student_id', data.student_id)
    : existingQuery.is('student_id', null)
  const { data: existing } = await existingQuery.maybeSingle()

  const { error } = existing
    ? await supabase.from('lesson_notes').update(noteData).eq('id', existing.id)
    : await supabase.from('lesson_notes').insert(noteData)

  if (error) return { error: error.message }
  return { success: true }
}

export async function markLessonComplete(
  lessonId: string,
): Promise<{ error?: string; success?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('lessons')
    .update({ status: 'completed' })
    .eq('id', lessonId)
    .eq('teacher_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateGroupName(
  lessonId: string,
  groupName: string,
): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('lessons')
    .update({ group_name: groupName })
    .eq('id', lessonId)
    .eq('teacher_id', session.user.id)

  return error ? { error: error.message } : {}
}

export async function createLesson(data: {
  student_id: string
  student_ids?: string[]
  scheduled_start: string
  scheduled_end: string
  lesson_type: 'trial' | 'regular' | 'intensive'
  group_name?: string
}): Promise<{ error?: string; success?: boolean; grouped?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { error: 'Not authenticated.' }

  const allStudents = data.student_ids?.length ? data.student_ids : [data.student_id]
  const isGroup = allStudents.length > 1

  // If a lesson already exists at this exact slot, add the new students to it as a group
  const { data: existing } = await supabase
    .from('lessons')
    .select('id, student_id')
    .eq('teacher_id', user.id)
    .eq('scheduled_start', data.scheduled_start)
    .eq('scheduled_end', data.scheduled_end)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing) {
    const { data: existingParts } = await supabase
      .from('lesson_participants')
      .select('student_id')
      .eq('lesson_id', existing.id)

    const taken = new Set([existing.student_id, ...((existingParts ?? []).map((p: any) => p.student_id))])
    const newParticipants = allStudents.filter(id => !taken.has(id))

    if (newParticipants.length) {
      await supabase.from('lesson_participants').insert(
        newParticipants.map(sid => ({ lesson_id: existing.id, student_id: sid }))
      )

      // Build group name from all participants (existing + new)
      const allParticipantIds = [...taken, ...newParticipants]
      const { data: nameProfiles } = await supabase
        .from('profiles')
        .select('full_name')
        .in('id', allParticipantIds)
      const resolvedName = nameProfiles?.map(p => p.full_name.split(' ')[0]).join(' & ') ?? null

      await supabase.from('lessons').update({
        is_group: true,
        group_name: data.group_name ?? resolvedName,
      }).eq('id', existing.id)
    }

    return { success: true, grouped: true }
  }

  let groupName = data.group_name ?? null
  if (isGroup && !groupName) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('full_name')
      .in('id', allStudents)
    if (profiles?.length) {
      groupName = profiles.map(p => p.full_name.split(' ')[0]).join(' & ')
    }
  }

  const { data: lesson, error } = await supabase.from('lessons').insert({
    teacher_id: user.id,
    student_id: allStudents[0],
    scheduled_start: data.scheduled_start,
    scheduled_end: data.scheduled_end,
    lesson_type: data.lesson_type,
    status: new Date(data.scheduled_end) <= new Date() ? 'completed' : 'scheduled',
    is_group: isGroup,
    group_name: groupName,
  }).select('id').single()

  if (error) return { error: error.message }

  if (isGroup && lesson) {
    await supabase.from('lesson_participants').insert(
      allStudents.map(sid => ({ lesson_id: lesson.id, student_id: sid }))
    )
  }

  return { success: true }
}

export async function createRecurringLessons(data: {
  student_id: string
  student_ids?: string[]
  scheduled_start: string
  scheduled_end: string
  lesson_type: 'trial' | 'regular' | 'intensive'
  weeks: number
}): Promise<{ created: number; skipped: number; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { created: 0, skipped: 0, error: 'Not authenticated.' }

  const allStudents = data.student_ids?.length ? data.student_ids : [data.student_id]
  const isGroup = allStudents.length > 1
  const now = new Date()
  let created = 0
  let skipped = 0

  for (let i = 0; i < data.weeks; i++) {
    const start = new Date(data.scheduled_start)
    const end = new Date(data.scheduled_end)
    start.setDate(start.getDate() + i * 7)
    end.setDate(end.getDate() + i * 7)

    const status = start > now ? 'scheduled' : 'completed'

    const startISO = start.toISOString()
    const endISO = end.toISOString()

    // Check for existing lesson at this slot — merge as group instead of skipping
    const { data: existing } = await supabase
      .from('lessons')
      .select('id, student_id')
      .eq('teacher_id', user.id)
      .eq('scheduled_start', startISO)
      .eq('scheduled_end', endISO)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (existing) {
      const { data: existingParts } = await supabase
        .from('lesson_participants')
        .select('student_id')
        .eq('lesson_id', existing.id)

      const taken = new Set([existing.student_id, ...((existingParts ?? []).map((p: any) => p.student_id))])
      const newParticipants = allStudents.filter(id => !taken.has(id))

      if (newParticipants.length) {
        await supabase.from('lesson_participants').insert(
          newParticipants.map(sid => ({ lesson_id: existing.id, student_id: sid }))
        )
        await supabase.from('lessons').update({ is_group: true }).eq('id', existing.id)
      }

      created++
      continue
    }

    const { data: lesson, error } = await supabase.from('lessons').insert({
      teacher_id: user.id,
      student_id: allStudents[0],
      scheduled_start: startISO,
      scheduled_end: endISO,
      lesson_type: data.lesson_type,
      status,
      is_group: isGroup,
    }).select('id').single()

    if (error) {
      skipped++
    } else {
      created++
      if (isGroup && lesson) {
        await supabase.from('lesson_participants').insert(
          allStudents.map(sid => ({ lesson_id: lesson.id, student_id: sid }))
        )
      }
    }
  }

  return { created, skipped }
}

export async function addVocabularyToBank(
  entries: {
    student_id: string
    word: string
    reading?: string
    definition_en?: string
    definition_ja?: string
    example?: string
    lesson_id?: string
  }[],
): Promise<{ error?: string; success?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('vocabulary_bank')
    .upsert(
      entries.map(e => ({ ...e, teacher_id: session.user.id })),
      { onConflict: 'student_id,word', ignoreDuplicates: true },
    )

  if (error) return { error: error.message }
  return { success: true }
}

export async function rateVocabCard(
  vocabId: string,
  currentMastery: 0 | 1 | 2 | 3,
  rating: 'again' | 'hard' | 'good' | 'easy',
  intervalDays: number | null = null,
  easeFactor: number | null = null,
): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { error: 'Not authenticated.' }

  const { computeSRS } = await import('@/lib/srs')
  const result = computeSRS(intervalDays, currentMastery, easeFactor, rating)

  const { error } = await supabase
    .from('vocabulary_bank')
    .update({
      mastery_level: result.masteryLevel,
      next_review: result.nextReview,
      interval_days: result.intervalDays,
      ease_factor: result.easeFactor,
    })
    .eq('id', vocabId)
    .eq('student_id', user.id)

  return error ? { error: error.message } : {}
}

export async function deleteVocabEntry(
  vocabId: string,
  studentId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('vocabulary_bank')
    .delete()
    .eq('id', vocabId)
    .eq('student_id', studentId)

  return error ? { error: error.message } : {}
}

export async function updateVocabMastery(
  vocabId: string,
  masteryLevel: 0 | 1 | 2 | 3,
): Promise<{ error?: string; success?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { error: 'Not authenticated.' }

  const daysUntilReview = [1, 3, 7, 14][masteryLevel]
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + daysUntilReview)

  const { error } = await supabase
    .from('vocabulary_bank')
    .update({
      mastery_level: masteryLevel,
      next_review: nextReview.toISOString().split('T')[0],
    })
    .eq('id', vocabId)
    .eq('student_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}


export async function uploadVocabImage(
  entryId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const webpFile = await convertToWebP(file)
  const path = `${entryId}.webp`

  const { error: uploadError } = await supabase.storage
    .from('vocab-images')
    .upload(path, webpFile, { upsert: true, contentType: 'image/webp' })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = await supabase.storage
    .from('vocab-images')
    .getPublicUrl(path)

  const url = `${urlData.publicUrl}?t=${Date.now()}`

  const { error: dbError } = await supabase
    .from('vocabulary_bank')
    .update({ image_url: url })
    .eq('id', entryId)

  if (dbError) return { error: dbError.message }
  return { url }
}

export async function removeVocabImage(
  entryId: string,
): Promise<{ error?: string }> {
  await supabase.storage.from('vocab-images').remove([`${entryId}.webp`])

  const { error } = await supabase
    .from('vocabulary_bank')
    .update({ image_url: null })
    .eq('id', entryId)

  if (error) return { error: error.message }
  return {}
}

// ── Vocabulary Decks ─────────────────────────────────────────

export interface DeckWord {
  id: string
  deck_id: string
  word: string
  reading: string | null
  definition_ja: string | null
  definition_en: string | null
  example: string | null
  category: string | null
  quiz_sentence: string | null
  quiz_answer: string | null
  quiz_distractors: string[]
  inflections: string[] | null
  created_at: string
}

export interface Deck {
  id: string
  teacher_id: string
  name: string
  created_at: string
  word_count?: number
  words?: DeckWord[]
}

export async function listDecks(): Promise<{ decks?: Deck[]; error?: string }> {
  const { data, error } = await supabase
    .from('vocabulary_decks')
    .select('*, vocabulary_deck_words(count)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const decks = (data ?? []).map((d: any) => ({
    ...d,
    word_count: d.vocabulary_deck_words?.[0]?.count ?? 0,
    vocabulary_deck_words: undefined,
  }))

  return { decks }
}

export async function getDeckWithWords(deckId: string): Promise<{ deck?: Deck; error?: string }> {
  const { data: deck, error: deckErr } = await supabase
    .from('vocabulary_decks').select('*').eq('id', deckId).single()
  if (deckErr) return { error: deckErr.message }

  // Paginate in chunks of 1000 to bypass PostgREST max_rows cap
  const allWords: DeckWord[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: pageErr } = await supabase
      .from('vocabulary_deck_words')
      .select('*')
      .eq('deck_id', deckId)
      .order('word', { ascending: true })
      .range(from, from + PAGE - 1)
    if (pageErr) return { error: pageErr.message }
    allWords.push(...(page ?? []))
    if (!page || page.length < PAGE) break
  }

  return { deck: { ...deck, words: allWords } as Deck }
}

export async function createDeck(name: string): Promise<{ deck?: Deck; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase
    .from('vocabulary_decks')
    .insert({ name, teacher_id: session.user.id })
    .select()
    .single()

  if (error) return { error: error.message }
  return { deck: data as Deck }
}

export async function renameDeck(deckId: string, name: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('vocabulary_decks')
    .update({ name })
    .eq('id', deckId)

  return error ? { error: error.message } : {}
}

export async function deleteDeck(deckId: string): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  // Delete deck first so it disappears from the UI immediately.
  // Bank row cleanup follows — if it fails, orphaned rows are invisible
  // to users (no deck reference) and can be cleaned up manually.
  const { error } = await supabase
    .from('vocabulary_decks')
    .delete()
    .eq('id', deckId)
    .eq('teacher_id', session.user.id)

  if (error) return { error: error.message }

  // Best-effort cleanup of student bank rows — not transactional
  await supabase.from('vocabulary_bank').delete().eq('deck_id', deckId)
  await supabase.from('vocabulary_deck_words').delete().eq('deck_id', deckId)

  return {}
}

export async function addWordToDeck(
  deckId: string,
  word: { word: string; reading?: string; definition_ja?: string; definition_en?: string; example?: string; category?: string },
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('vocabulary_deck_words')
    .upsert({ deck_id: deckId, ...word }, { onConflict: 'deck_id,word', ignoreDuplicates: false })

  return error ? { error: error.message } : {}
}

export async function bulkAddWordsToDeck(
  deckId: string,
  words: { word: string; reading?: string; definition_ja?: string; definition_en?: string; example?: string }[],
): Promise<{ count?: number; error?: string }> {
  if (!words.length) return { count: 0 }

  const rows = words.map(w => ({ deck_id: deckId, ...w }))

  // Supabase upsert in batches of 500 to stay within payload limits
  let total = 0
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('vocabulary_deck_words')
      .upsert(batch, { onConflict: 'deck_id,word', ignoreDuplicates: true })
    if (error) return { error: error.message }
    total += batch.length
  }

  return { count: total }
}

export async function removeWordFromDeck(wordId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('vocabulary_deck_words')
    .delete()
    .eq('id', wordId)

  return error ? { error: error.message } : {}
}

export async function updateDeckWord(
  wordId: string,
  word: { word: string; reading?: string; definition_ja?: string; definition_en?: string; example?: string; category?: string },
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('vocabulary_deck_words')
    .update(word)
    .eq('id', wordId)

  return error ? { error: error.message } : {}
}

export async function assignDeckToStudent(
  deckId: string,
  studentId: string,
): Promise<{ count?: number; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated.' }

  // Fetch word list from template (canonical source)
  const wordTexts: string[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: fetchErr } = await supabase
      .from('vocabulary_deck_words')
      .select('word')
      .eq('deck_id', deckId)
      .order('word', { ascending: true })
      .range(from, from + PAGE - 1)
    if (fetchErr) return { error: fetchErr.message }
    wordTexts.push(...(page ?? []).map((w: any) => w.word))
    if (!page || page.length < PAGE) break
  }
  if (!wordTexts.length) return { count: 0 }

  // Fetch ALL existing bank rows for this student matching these words,
  // regardless of which deck they belong to — needed to avoid unique constraint
  // violations on (student_id, word) when a word exists from another deck.
  const existingRows: { id: string; word: string; deck_id: string | null; is_active: boolean }[] = []
  for (let i = 0; i < wordTexts.length; i += 500) {
    const chunk = wordTexts.slice(i, i + 500)
    const { data: page } = await supabase
      .from('vocabulary_bank')
      .select('id, word, deck_id, is_active')
      .eq('student_id', studentId)
      .in('word', chunk)
    existingRows.push(...(page ?? []))
  }

  const existingWordSet = new Set(existingRows.map(r => r.word))

  // Update rows that exist but belong to a different deck or are inactive:
  // point them at this deck and activate, preserving mastery/next_review.
  const toUpdate = existingRows.filter(r => r.deck_id !== deckId || !r.is_active)
  for (let i = 0; i < toUpdate.length; i += 50) {
    await supabase
      .from('vocabulary_bank')
      .update({ deck_id: deckId, is_active: true })
      .in('id', toUpdate.slice(i, i + 50).map(r => r.id))
  }

  // Insert only rows for words that don't exist in the bank at all
  const newEntries = wordTexts
    .filter(w => !existingWordSet.has(w))
    .map(w => ({
      student_id: studentId,
      teacher_id: session.user.id,
      deck_id: deckId,
      word: w,
      is_active: true,
    }))

  let inserted = 0
  let failed = 0
  for (let i = 0; i < newEntries.length; i += 500) {
    const { error: insertErr } = await supabase
      .from('vocabulary_bank')
      .insert(newEntries.slice(i, i + 500))
    if (insertErr) {
      failed += newEntries.slice(i, i + 500).length
      console.error('Batch insert failed:', insertErr.message)
    } else {
      inserted += newEntries.slice(i, i + 500).length
    }
  }

  if (failed > 0) {
    return { count: inserted + toUpdate.length, error: `${failed} word${failed !== 1 ? 's' : ''} failed to assign` }
  }
  return { count: wordTexts.length }
}

/**
 * Fetch student vocabulary bank and merge content from vocabulary_deck_words.
 * Words assigned from a deck always show live template content.
 * Words added from lesson notes retain their own stored content.
 */
export async function getStudentVocab(
  studentId: string,
): Promise<{ entries: import('@/lib/types/database').VocabularyBankEntry[]; error?: string }> {
  const allEntries: any[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('vocabulary_bank')
      .select('*')
      .eq('student_id', studentId)
      .eq('is_active', true)
      .order('word', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return { entries: [], error: error.message }
    allEntries.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }

  // Collect distinct deck IDs for deck-assigned words
  const deckIds = [...new Set(allEntries.filter(e => e.deck_id).map(e => e.deck_id as string))]

  if (deckIds.length > 0) {
    // Fetch template content for all relevant decks
    const deckWords: any[] = []
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from('vocabulary_deck_words')
        .select('deck_id, word, reading, definition_en, definition_ja, example, category, quiz_sentence, quiz_distractors')
        .in('deck_id', deckIds)
        .order('word', { ascending: true })
        .range(from, from + PAGE - 1)
      deckWords.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }

    // Build lookup map
    const templateMap = new Map<string, any>()
    for (const dw of deckWords) templateMap.set(`${dw.deck_id}:${dw.word}`, dw)

    // Overlay template content on bank entries
    for (const entry of allEntries) {
      if (!entry.deck_id) continue
      const t = templateMap.get(`${entry.deck_id}:${entry.word}`)
      if (!t) continue
      entry.reading = t.reading
      entry.definition_en = t.definition_en
      entry.definition_ja = t.definition_ja
      entry.example = t.example
      entry.category = t.category ?? entry.category
      entry.quiz_sentence = t.quiz_sentence
      entry.quiz_answer = t.quiz_answer ?? null
      entry.quiz_distractors = t.quiz_distractors ?? []
      entry.inflections = t.inflections ?? null
    }
  }

  return { entries: allEntries }
}

export async function removeDeckFromStudent(
  deckId: string,
  studentId: string,
): Promise<{ error?: string }> {
  // Mark rows as inactive so they disappear from the student's view.
  // deck_id is intentionally kept so assignDeckToStudent can find and
  // re-activate them later, restoring mastery/next_review intact.
  const { error } = await supabase
    .from('vocabulary_bank')
    .update({ is_active: false })
    .eq('deck_id', deckId)
    .eq('student_id', studentId)

  return error ? { error: error.message } : {}
}

export async function reorderVocabDecks(
  ids: string[],
): Promise<{ error?: string }> {
  const updates = ids.map((id, i) =>
    supabase.from('vocabulary_decks').update({ sort_order: i }).eq('id', id)
  )
  const results = await Promise.all(updates)
  const err = results.find(r => r.error)
  return err?.error ? { error: err.error.message } : {}
}
