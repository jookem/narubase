import { supabase } from '@/lib/supabase'

export type Classmate = { id: string; full_name: string | null }

export async function getClassmates(userId: string): Promise<Classmate[]> {
  const { data, error } = await supabase.rpc('get_classmates', { requesting_student_id: userId })
  if (error) return []
  return (data as Classmate[]) ?? []
}

export async function saveKidSession(params: {
  player1Id: string
  player2Id?: string | null
  game: string
  score: number
  wordsCorrect: number
  wordsAttempted: number
  streakBest: number
}): Promise<void> {
  await supabase.from('kid_sessions').insert({
    player1_id: params.player1Id,
    player2_id: params.player2Id ?? null,
    game: params.game,
    score: params.score,
    words_correct: params.wordsCorrect,
    words_attempted: params.wordsAttempted,
    streak_best: params.streakBest,
  })
}
