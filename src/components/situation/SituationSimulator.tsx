import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  listSituations,
  getSituationScript,
  saveSituationSession,
  listVrmAnimations,
  type Situation,
  type DialogueNode,
  type VrmGender,
} from '@/lib/api/situations'
import { SituationList } from './SituationList'
import { RPGDialogueBox } from './RPGDialogueBox'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'
import { VRMViewer, type VRMExpression } from '@/components/vrm/VRMViewer'

function deriveAgeGroup(age: number | null): 'children' | 'teens' | 'adults' | undefined {
  if (!age) return undefined
  if (age < 13) return 'children'
  if (age < 18) return 'teens'
  return 'adults'
}

async function uploadVrm(file: File, userId: string): Promise<string | null> {
  const path = `students/${userId}/avatar.vrm`
  const { error } = await supabase.storage
    .from('situation-assets')
    .upload(path, file, { upsert: true, contentType: 'model/gltf-binary' })

  if (error) return null
  const { data } = supabase.storage.from('situation-assets').getPublicUrl(path)
  return data.publicUrl
}

const PREVIEW_EXPRESSIONS: { id: VRMExpression; emoji: string; label: string }[] = [
  { id: 'neutral',   emoji: '😐', label: 'Neutral' },
  { id: 'happy',     emoji: '😊', label: 'Happy' },
  { id: 'surprised', emoji: '😲', label: 'Surprised' },
  { id: 'relaxed',   emoji: '😌', label: 'Relaxed' },
  { id: 'sad',       emoji: '😢', label: 'Sad' },
  { id: 'angry',     emoji: '😠', label: 'Angry' },
]

export function SituationSimulator() {
  const { user, profile } = useAuth()

  const [situations, setSituations] = useState<Situation[]>([])
  const [loading, setLoading] = useState(true)

  const [studentVrmUrl, setStudentVrmUrl] = useState<string | null>(null)
  const [studentVrmGender, setStudentVrmGender] = useState<VrmGender>('neutral')
  const [uploading, setUploading] = useState(false)
  const [previewExpr, setPreviewExpr] = useState<VRMExpression>('neutral')
  const vrmFileRef = useRef<HTMLInputElement>(null)

  const [npcAnimationMap, setNpcAnimationMap] = useState<Record<string, string>>({})
  const [studentAnimationMap, setStudentAnimationMap] = useState<Record<string, string>>({})

  const [activeSituation, setActiveSituation] = useState<Situation | null>(null)
  const [scriptNodes, setScriptNodes] = useState<DialogueNode[]>([])
  const [currentNodeId, setCurrentNodeId] = useState('start')
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([])
  const [phase, setPhase] = useState<'playing' | 'complete' | null>(null)
  const [scriptLoading, setScriptLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return

    const { data: details } = await supabase
      .from('student_details')
      .select('age, vrm_url, vrm_gender')
      .eq('student_id', user.id)
      .maybeSingle()

    const group = deriveAgeGroup(details?.age ?? null)
    if (details?.vrm_url) setStudentVrmUrl(details.vrm_url)
    const sGender: VrmGender = (details?.vrm_gender as VrmGender) ?? 'neutral'
    setStudentVrmGender(sGender)
    listVrmAnimations(sGender).then(setStudentAnimationMap)

    const { situations: s } = await listSituations(group)
    setSituations(s ?? [])
    setLoading(false)
  }

  async function persistVrmUrl(url: string | null) {
    if (!user) return
    await supabase
      .from('student_details')
      .upsert({ student_id: user.id, vrm_url: url }, { onConflict: 'student_id' })
  }

  async function handleVrmFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    const url = await uploadVrm(file, user.id)
    if (url) {
      setStudentVrmUrl(url)
      persistVrmUrl(url)
    }
    setUploading(false)
    e.target.value = ''
  }

  function handleVrmClear() {
    setStudentVrmUrl(null)
    persistVrmUrl(null)
  }

  async function handleSituationSelect(situation: Situation) {
    setScriptLoading(true)
    const [{ script, error }, npcMap] = await Promise.all([
      getSituationScript(situation.id),
      listVrmAnimations((situation.npc?.gender as VrmGender) ?? 'neutral'),
    ])
    if (error || !script) { setScriptLoading(false); return }

    setNpcAnimationMap(npcMap)
    setActiveSituation(situation)
    setScriptNodes(script.script.nodes)
    setCurrentNodeId('start')
    setTranscript([])
    setPhase('playing')
    setScriptLoading(false)
  }

  function currentNode(): DialogueNode | null {
    return scriptNodes.find(n => n.id === currentNodeId) ?? null
  }

  function handleContinue() {
    const node = currentNode()
    if (!node || node.speaker !== 'npc' || !node.next) return
    if (node.text) setTranscript(prev => [...prev, { speaker: 'npc', text: node.text! }])
    setCurrentNodeId(node.next)
  }

  function handleSelectOption(i: number) {
    const node = currentNode()
    if (!node || node.speaker !== 'student' || !node.options) return
    const opt = node.options[i]
    if (!opt) return
    setTranscript(prev => [...prev, { speaker: 'student', text: opt.text }])
    setCurrentNodeId(opt.next)
  }

  async function handleComplete() {
    const node = currentNode()
    const finalTranscript = node?.text
      ? [...transcript, { speaker: 'npc', text: node.text }]
      : transcript
    setPhase('complete')
    if (user && activeSituation) {
      await saveSituationSession(user.id, activeSituation.id, null, finalTranscript)
    }
  }

  function handleClose() {
    setActiveSituation(null)
    setScriptNodes([])
    setCurrentNodeId('start')
    setTranscript([])
    setPhase(null)
  }

  // ── Full-screen: playing ──────────────────────────────────────

  const node = currentNode()

  if (phase === 'playing' && activeSituation && node) {
    const isEnd = node.speaker === 'npc' && !node.next
    return (
      <RPGDialogueBox
        npc={activeSituation.npc ?? null}
        studentVrmUrl={studentVrmUrl}
        studentName={profile?.display_name ?? profile?.full_name ?? 'You'}
        currentNode={node}
        background={{ color: activeSituation.background_color, imageUrl: activeSituation.background_image_url }}
        npcAnimationMap={npcAnimationMap}
        studentAnimationMap={studentAnimationMap}
        onExit={handleClose}
        onContinue={handleContinue}
        onSelectOption={handleSelectOption}
        isEnd={isEnd}
        onComplete={handleComplete}
      />
    )
  }

  // ── Full-screen: complete ─────────────────────────────────────

  if (phase === 'complete' && activeSituation) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title="Scene Complete!"
          subtitle={`Great job in "${activeSituation.title}"!`}
          onClose={handleClose}
          closeLabel="Back to Situations"
        />
      </div>
    )
  }

  // ── Inline: character setup + situation selection ─────────────

  if (loading) return <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />

  return (
    <div className="space-y-4">
      {/* VRM character section */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-800">Your character</p>
            {studentVrmUrl
              ? <p className="text-xs text-green-600 mt-0.5">VRM loaded — orbit &amp; zoom to preview</p>
              : <p className="text-xs text-gray-400 mt-0.5">Upload a VRM file to use your own avatar</p>}
          </div>
          <div className="flex gap-2">
            {studentVrmUrl && (
              <button onClick={handleVrmClear} className="text-xs text-red-400 hover:text-red-600">
                Remove
              </button>
            )}
            <button
              onClick={() => vrmFileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs rounded-lg disabled:opacity-50 transition-colors hover:bg-brand/90"
            >
              {uploading && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
              {studentVrmUrl ? 'Replace VRM' : 'Upload VRM'}
            </button>
            <input ref={vrmFileRef} type="file" accept=".vrm" className="hidden" onChange={handleVrmFile} />
          </div>
        </div>

        {studentVrmUrl ? (
          <>
            <VRMViewer
              url={studentVrmUrl}
              expression={previewExpr}
              autoBlink
              orbitControls
              showGrid={false}
              framing="bust"
              className="w-full h-72"
            />
            <div className="flex justify-center gap-2 px-4 py-2 bg-slate-50 border-t border-gray-100">
              {PREVIEW_EXPRESSIONS.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setPreviewExpr(ex.id)}
                  title={ex.label}
                  className={`text-xl px-2 py-1 rounded-lg transition-colors ${previewExpr === ex.id ? 'bg-brand/20 ring-2 ring-brand/40' : 'hover:bg-gray-200'}`}
                >
                  {ex.emoji}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div
            className="w-full h-40 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
            onClick={() => vrmFileRef.current?.click()}
          >
            <span className="text-4xl">🧍</span>
            <p className="text-sm text-gray-400">Click to upload a .vrm file</p>
            <p className="text-xs text-gray-300">or start without one — an NPC character will still appear</p>
          </div>
        )}
      </div>

      {/* Situation list */}
      <SituationList
        situations={situations}
        onSelect={handleSituationSelect}
        loading={scriptLoading}
      />
    </div>
  )
}
