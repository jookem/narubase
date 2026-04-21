import { supabase } from '@/lib/supabase'

export interface SituationNpc {
  id: string
  name: string
  role: string
  placeholder_color: string
  sprites: Record<string, string>
  created_at: string
}

export interface AvatarPreset {
  id: string
  name: string
  age_group: 'children' | 'teens' | 'adults'
  placeholder_color: string
  image_url: string | null
  sort_order: number
}

export interface Situation {
  id: string
  title: string
  description: string
  age_groups: string[]
  category: string
  npc_id: string | null
  background_color: string
  background_image_url: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  mode: 'scripted' | 'hybrid' | 'llm'
  is_active: boolean
  created_by: string | null
  created_at: string
  npc?: SituationNpc
}

export interface DialogueNode {
  id: string
  speaker: 'npc' | 'student'
  text?: string
  expression?: 'neutral' | 'speaking' | 'positive' | 'confused' | 'thinking'
  next?: string | null
  options?: Array<{ text: string; next: string }>
}

export interface SituationScript {
  id: string
  situation_id: string
  script: { nodes: DialogueNode[] }
}

export async function listSituations(
  ageGroup?: string,
): Promise<{ situations?: Situation[]; error?: string }> {
  const { data, error } = await supabase
    .from('situations')
    .select('*, npc:situation_npcs(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  let situations = (data ?? []) as Situation[]
  if (ageGroup) {
    situations = situations.filter(s => s.age_groups.includes(ageGroup))
  }
  return { situations }
}

export async function getSituationScript(
  situationId: string,
): Promise<{ script?: SituationScript; error?: string }> {
  const { data, error } = await supabase
    .from('situation_scripts')
    .select('*')
    .eq('situation_id', situationId)
    .single()

  if (error) return { error: error.message }
  return { script: data as SituationScript }
}

export async function listAvatarPresets(
  ageGroup?: string,
): Promise<{ presets?: AvatarPreset[]; error?: string }> {
  let query = supabase
    .from('avatar_presets')
    .select('*')
    .order('sort_order', { ascending: true })

  if (ageGroup) {
    query = query.eq('age_group', ageGroup)
  }

  const { data, error } = await query
  if (error) return { error: error.message }
  return { presets: data as AvatarPreset[] }
}

export async function saveSituationSession(
  studentId: string,
  situationId: string,
  avatarPresetId: string | null,
  transcript: Array<{ speaker: string; text: string }>,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('student_situation_sessions')
    .insert({
      student_id: studentId,
      situation_id: situationId,
      avatar_preset_id: avatarPresetId,
      transcript,
      completed_at: new Date().toISOString(),
    })

  return error ? { error: error.message } : {}
}
