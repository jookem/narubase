import { supabase } from '@/lib/supabase'
import { convertToWebP } from '@/lib/utils/imageUtils'

export async function saveLessonNotes(data: {
  lesson_id: string
  summary?: string
  vocabulary?: { word: string; definition: string; example?: string; mastered?: boolean }[]
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

  const { error } = await supabase.from('lesson_notes').upsert(
    {
      lesson_id: data.lesson_id,
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
    },
    { onConflict: 'lesson_id' },
  )

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

export async function createLesson(data: {
  student_id: string
  student_ids?: string[]
  scheduled_start: string
  scheduled_end: string
  lesson_type: 'trial' | 'regular' | 'intensive'
}): Promise<{ error?: string; success?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { error: 'Not authenticated.' }

  const allStudents = data.student_ids?.length ? data.student_ids : [data.student_id]
  const isGroup = allStudents.length > 1

  const { data: lesson, error } = await supabase.from('lessons').insert({
    teacher_id: user.id,
    student_id: allStudents[0],
    scheduled_start: data.scheduled_start,
    scheduled_end: data.scheduled_end,
    lesson_type: data.lesson_type,
    status: 'completed',
    is_group: isGroup,
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

    const { data: lesson, error } = await supabase.from('lessons').insert({
      teacher_id: user.id,
      student_id: allStudents[0],
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
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

const INTERVALS = [1, 3, 7, 14] // days per mastery level

export async function rateVocabCard(
  vocabId: string,
  currentMastery: 0 | 1 | 2 | 3,
  rating: 'again' | 'hard' | 'good' | 'easy',
): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { error: 'Not authenticated.' }

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
    .from('vocabulary_bank')
    .update({
      mastery_level: newMastery,
      next_review: nextReview.toISOString().split('T')[0],
    })
    .eq('id', vocabId)
    .eq('student_id', user.id)

  return error ? { error: error.message } : {}
}

export async function deleteVocabEntry(
  vocabId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('vocabulary_bank')
    .delete()
    .eq('id', vocabId)

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
