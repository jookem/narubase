import { supabase } from '@/lib/supabase'

export interface SituationNpc {
  id: string
  name: string
  role: string
  placeholder_color: string
  sprites: Record<string, string>
  vrm_url?: string | null
  animation_url?: string | null
  gender?: 'male' | 'female' | 'neutral'
  created_at: string
}

export type VrmGender = 'male' | 'female' | 'neutral'

export interface VrmAnimation {
  id: string
  gender: VrmGender
  expression: string
  animation_url: string
}

export interface AvatarPreset {
  id: string
  name: string
  age_group: 'children' | 'teens' | 'adults'
  placeholder_color: string
  image_url: string | null
  sprites: Record<string, string>
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

export async function listVrmAnimations(
  gender: VrmGender,
): Promise<Record<string, string>> {
  const gendersToFetch = gender === 'neutral' ? ['neutral'] : [gender, 'neutral']
  const { data } = await supabase
    .from('vrm_animations')
    .select('gender, expression, animation_url, updated_at')
    .in('gender', gendersToFetch)

  if (!data) return {}

  function bustUrl(r: { animation_url: string; updated_at?: string | null }) {
    if (!r.updated_at) return r.animation_url
    return `${r.animation_url}?t=${new Date(r.updated_at).getTime()}`
  }

  const map: Record<string, string> = {}
  // neutral first, gender-specific overrides
  data.filter(r => r.gender === 'neutral').forEach(r => { map[r.expression] = bustUrl(r) })
  if (gender !== 'neutral') {
    data.filter(r => r.gender === gender).forEach(r => { map[r.expression] = bustUrl(r) })
  }
  return map
}

export interface LlmTurn {
  npc_text: string
  expression: string
  options: { text: string }[]
  is_end: boolean
}

export async function generateSituationTurn(
  situation: Situation,
  history: Array<{ speaker: string; text: string }>,
  studentName: string,
): Promise<LlmTurn | null> {
  const { data, error } = await supabase.functions.invoke('generate-situation-turn', {
    body: {
      situation: {
        title:      situation.title,
        description: situation.description,
        difficulty: situation.difficulty,
        npc_name:   situation.npc?.name ?? 'NPC',
        npc_role:   situation.npc?.role ?? '',
      },
      history,
      student_name: studentName,
    },
  })
  if (error) { console.error('[generateSituationTurn]', error); return null }
  return data as LlmTurn
}

export async function listNpcs(): Promise<SituationNpc[]> {
  const { data } = await supabase.from('situation_npcs').select('*').order('name')
  return (data ?? []) as SituationNpc[]
}

export async function createNpc(
  name: string,
  role: string,
  color: string,
): Promise<{ npc?: SituationNpc; error?: string }> {
  const { data, error } = await supabase
    .from('situation_npcs')
    .insert({ name, role, placeholder_color: color })
    .select()
    .single()
  if (error) return { error: error.message }
  return { npc: data as SituationNpc }
}

export async function listMySituations(teacherId: string): Promise<Situation[]> {
  const { data } = await supabase
    .from('situations')
    .select('*, npc:situation_npcs(*)')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Situation[]
}

export async function createSituation(
  teacherId: string,
  data: Pick<Situation, 'title' | 'description' | 'npc_id' | 'background_color' | 'difficulty' | 'age_groups'>,
): Promise<{ situation?: Situation; error?: string }> {
  const { data: row, error } = await supabase
    .from('situations')
    .insert({ ...data, created_by: teacherId, mode: 'scripted', is_active: true })
    .select('*, npc:situation_npcs(*)')
    .single()
  if (error) return { error: error.message }
  await supabase
    .from('situation_scripts')
    .insert({ situation_id: row.id, script: { nodes: [] } })
  return { situation: row as Situation }
}

export async function updateSituation(
  id: string,
  data: Partial<Pick<Situation, 'title' | 'description' | 'npc_id' | 'background_color' | 'difficulty' | 'age_groups' | 'is_active'>>,
): Promise<{ error?: string }> {
  const { error } = await supabase.from('situations').update(data).eq('id', id)
  return error ? { error: error.message } : {}
}

export async function upsertSituationScript(
  situationId: string,
  nodes: DialogueNode[],
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('situation_scripts')
    .select('id')
    .eq('situation_id', situationId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('situation_scripts')
      .update({ script: { nodes } })
      .eq('situation_id', situationId)
    return error ? { error: error.message } : {}
  }
  const { error } = await supabase
    .from('situation_scripts')
    .insert({ situation_id: situationId, script: { nodes } })
  return error ? { error: error.message } : {}
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
