import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { SituationNpc, Situation, VrmGender } from '@/lib/api/situations'
import { listSituations, listNpcs, listVrmAnimations } from '@/lib/api/situations'
import type { VRMExpression } from '@/components/vrm/VRMViewer'
import { Upload, ImageIcon } from 'lucide-react'
import { VRMViewer } from '@/components/vrm/VRMViewer'
import { ScriptEditorSection, LineEditorView } from '@/components/situation/ScriptEditor'

// ── Storage helpers ────────────────────────────────────────────────

async function uploadToStorage(file: File, path: string): Promise<string | null> {
  const { error } = await supabase.storage
    .from('situation-assets')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) { toast.error(error.message); return null }

  const { data } = supabase.storage.from('situation-assets').getPublicUrl(path)
  return data.publicUrl
}

function storagePathFromUrl(url: string): string | null {
  const marker = '/object/public/situation-assets/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
}

async function deleteFromStorage(url: string | null | undefined) {
  if (!url) return
  const path = storagePathFromUrl(url)
  if (path) await supabase.storage.from('situation-assets').remove([path])
}

// ── Image slot ─────────────────────────────────────────────────────

function ImageSlot({
  label,
  currentUrl,
  placeholderColor,
  onUpload,
  accept = 'image/png,image/webp',
}: {
  label: string
  currentUrl?: string | null
  placeholderColor?: string
  onUpload: (file: File) => Promise<void>
  accept?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setPreviewUrl(currentUrl) }, [currentUrl])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const local = URL.createObjectURL(file)
    setPreviewUrl(local)
    await onUpload(file)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 hover:border-brand transition-colors bg-gray-50 flex items-center justify-center group disabled:opacity-60"
        style={!previewUrl ? { backgroundColor: placeholderColor ? placeholderColor + '22' : undefined } : undefined}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload size={16} className="text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            {uploading
              ? <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              : <ImageIcon size={18} />}
          </div>
        )}
        {uploading && previewUrl && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>
      <span className="text-[10px] text-gray-500 font-medium">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}

// ── Tab button ─────────────────────────────────────────────────────

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-800'
      }`}
    >
      {label}
    </button>
  )
}

// ── NPC section ────────────────────────────────────────────────────

const NPC_EXPRESSIONS: { id: VRMExpression; emoji: string }[] = [
  { id: 'neutral',   emoji: '😐' },
  { id: 'happy',     emoji: '😊' },
  { id: 'sad',       emoji: '😢' },
  { id: 'angry',     emoji: '😠' },
  { id: 'surprised', emoji: '😲' },
  { id: 'confused',  emoji: '😕' },
  { id: 'relaxed',   emoji: '😌' },
  { id: 'thinking',  emoji: '🤔' },
]

function NpcCard({ npc, onUpdate }: { npc: SituationNpc; onUpdate: (updated: SituationNpc) => void }) {
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewExpr, setPreviewExpr] = useState<VRMExpression>('neutral')
  const [animationMap, setAnimationMap] = useState<Record<string, string>>({})
  const [savingGender, setSavingGender] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listVrmAnimations((npc.gender as VrmGender) ?? 'neutral').then(setAnimationMap)
  }, [npc.gender])

  async function handleGenderChange(gender: VrmGender) {
    setSavingGender(true)
    const { error } = await supabase
      .from('situation_npcs').update({ gender }).eq('id', npc.id)
    if (error) { toast.error(error.message); setSavingGender(false); return }
    onUpdate({ ...npc, gender })
    listVrmAnimations(gender).then(setAnimationMap)
    setSavingGender(false)
  }

  async function handleVrmFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const oldUrl = npc.vrm_url
    const path = `npcs/${npc.id}/model_${Date.now()}.vrm`
    const url = await uploadToStorage(file, path)
    if (!url) { setUploading(false); return }

    const { error } = await supabase
      .from('situation_npcs')
      .update({ vrm_url: url })
      .eq('id', npc.id)

    if (error) { toast.error(error.message); setUploading(false); return }

    await deleteFromStorage(oldUrl)
    onUpdate({ ...npc, vrm_url: url })
    setShowPreview(true)
    setUploading(false)
    toast.success(`${npc.name} VRM uploaded`)
    e.target.value = ''
  }

  async function handleVrmClear() {
    const { error } = await supabase
      .from('situation_npcs')
      .update({ vrm_url: null })
      .eq('id', npc.id)
    if (error) { toast.error(error.message); return }
    await deleteFromStorage(npc.vrm_url)
    onUpdate({ ...npc, vrm_url: null })
    setShowPreview(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: npc.placeholder_color }}
        >
          {npc.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900">{npc.name}</p>
          <p className="text-xs text-gray-400">{npc.role}</p>
        </div>

        {npc.vrm_url && (
          <>
            <button
              onClick={() => setShowPreview(v => !v)}
              className="text-xs text-gray-500 hover:text-brand border border-gray-200 rounded-lg px-2.5 py-1 transition-colors shrink-0"
            >
              {showPreview ? 'Hide' : 'Preview'}
            </button>
            <button onClick={handleVrmClear} className="text-xs text-red-400 hover:text-red-600 shrink-0">
              Remove
            </button>
          </>
        )}

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs rounded-lg disabled:opacity-50 shrink-0 transition-colors hover:bg-brand/90"
        >
          {uploading
            ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            : <Upload size={12} />}
          {npc.vrm_url ? 'Replace VRM' : 'Upload VRM'}
        </button>
        <input ref={fileRef} type="file" accept=".vrm" className="hidden" onChange={handleVrmFile} />
      </div>

      {/* Gender row */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <span className="text-xs text-gray-500 shrink-0">Animation gender</span>
        <div className="flex gap-1">
          {(['male','female','neutral'] as VrmGender[]).map(g => (
            <button
              key={g}
              onClick={() => handleGenderChange(g)}
              disabled={savingGender}
              className={`px-2.5 py-1 text-xs rounded-lg capitalize transition-colors ${
                (npc.gender ?? 'neutral') === g
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Inline preview */}
      {showPreview && npc.vrm_url && (
        <div className="border-t border-gray-100">
          <VRMViewer
            url={npc.vrm_url}
            expression={previewExpr}
            animationMap={animationMap}
            autoBlink
            orbitControls
            showGrid={false}
            framing="bust"
            className="w-full h-72"
          />
          <div className="flex justify-center gap-2 p-2 bg-slate-50 border-t border-gray-100">
            {NPC_EXPRESSIONS.map(ex => (
              <button
                key={ex.id}
                onClick={() => setPreviewExpr(ex.id)}
                title={ex.id}
                className={`text-xl px-2 py-1 rounded-lg transition-colors ${previewExpr === ex.id ? 'bg-brand/20 ring-2 ring-brand/40' : 'hover:bg-gray-200'}`}
              >
                {ex.emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NpcSection() {
  const [npcs, setNpcs] = useState<SituationNpc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('situation_npcs').select('*').order('name').then(({ data }) => {
      setNpcs((data ?? []) as SituationNpc[])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload a VRM model for each NPC. Models render live in the situation game.
      </p>
      {npcs.map(npc => (
        <NpcCard
          key={npc.id}
          npc={npc}
          onUpdate={updated => setNpcs(prev => prev.map(n => n.id === updated.id ? updated : n))}
        />
      ))}
    </div>
  )
}

// ── Animation section ──────────────────────────────────────────────

const ANIM_EXPRESSIONS = [
  { id: 'neutral',   label: 'Neutral',   emoji: '😐' },
  { id: 'happy',     label: 'Happy',     emoji: '😊' },
  { id: 'sad',       label: 'Sad',       emoji: '😢' },
  { id: 'angry',     label: 'Angry',     emoji: '😠' },
  { id: 'surprised', label: 'Surprised', emoji: '😲' },
  { id: 'confused',  label: 'Confused',  emoji: '😕' },
  { id: 'relaxed',   label: 'Relaxed',   emoji: '😌' },
  { id: 'thinking',  label: 'Thinking',  emoji: '🤔' },
] as const
const ANIM_GENDERS: VrmGender[] = ['male', 'female', 'neutral']

type AnimSlotKey = `${VrmGender}:${string}`

function AnimationSection() {
  const [slots, setSlots] = useState<Record<AnimSlotKey, string>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<AnimSlotKey | null>(null)
  const fileRefs = useRef<Record<AnimSlotKey, HTMLInputElement | null>>({})

  useEffect(() => {
    supabase.from('vrm_animations').select('gender, expression, animation_url')
      .then(({ data }) => {
        const map: Record<AnimSlotKey, string> = {}
        ;(data ?? []).forEach(r => {
          map[`${r.gender}:${r.expression}` as AnimSlotKey] = r.animation_url
        })
        setSlots(map)
        setLoading(false)
      })
  }, [])

  async function handleUpload(gender: VrmGender, expression: string, file: File) {
    const key: AnimSlotKey = `${gender}:${expression}`
    setUploading(key)

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'vrma'
    const path = `animations/${gender}/${expression}.${ext}`
    const url = await uploadToStorage(file, path)
    if (!url) { setUploading(null); return }

    const { error } = await supabase
      .from('vrm_animations')
      .upsert({ gender, expression, animation_url: url }, { onConflict: 'gender,expression' })

    if (error) { toast.error(error.message); setUploading(null); return }

    setSlots(prev => ({ ...prev, [key]: url }))
    setUploading(null)
    toast.success(`${expression} / ${gender} animation saved`)
  }

  async function handleClear(gender: VrmGender, expression: string) {
    const key: AnimSlotKey = `${gender}:${expression}`
    const { error } = await supabase
      .from('vrm_animations')
      .delete()
      .eq('gender', gender)
      .eq('expression', expression)
    if (error) { toast.error(error.message); return }
    setSlots(prev => { const next = { ...prev }; delete next[key]; return next })
    toast.success('Animation removed')
  }

  if (loading) return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload a <code className="text-xs bg-gray-100 px-1 rounded">.vrma</code> file per expression and gender.
        Gender-specific animations override neutral ones at runtime.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-4 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div className="px-4 py-2">Expression</div>
          {ANIM_GENDERS.map(g => (
            <div key={g} className="px-3 py-2 capitalize text-center">{g}</div>
          ))}
        </div>

        {ANIM_EXPRESSIONS.map(expr => (
          <div key={expr.id} className="grid grid-cols-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
            <div className="px-4 py-3 flex items-center gap-2 text-sm text-gray-700">
              <span className="text-lg leading-none">{expr.emoji}</span>
              {expr.label}
            </div>

            {ANIM_GENDERS.map(gender => {
              const key: AnimSlotKey = `${gender}:${expr.id}`
              const hasAnim = !!slots[key]
              const isUploading = uploading === key

              return (
                <div key={gender} className="px-3 py-3 flex flex-col items-center gap-1">
                  {hasAnim ? (
                    <>
                      <span className="text-xs text-green-600 font-medium">✓ Set</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => fileRefs.current[key]?.click()}
                          className="text-[10px] text-brand hover:underline"
                        >Replace</button>
                        <span className="text-gray-300">·</span>
                        <button
                          onClick={() => handleClear(gender, expr.id)}
                          className="text-[10px] text-red-400 hover:text-red-600"
                        >Remove</button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => fileRefs.current[key]?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand border border-dashed border-gray-200 hover:border-brand rounded-lg px-2 py-1 transition-colors disabled:opacity-40"
                    >
                      {isUploading
                        ? <span className="w-3 h-3 border border-brand border-t-transparent rounded-full animate-spin" />
                        : <Upload size={10} />}
                      Upload
                    </button>
                  )}
                  <input
                    ref={el => { fileRefs.current[key] = el }}
                    type="file"
                    accept=".vrma,.fbx"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(gender, expr.id, file)
                      e.target.value = ''
                    }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Situations section ────────────────────────────────────────────

type SituationMode = 'scripted' | 'hybrid' | 'llm' | 'duo'

function SituationsSection() {
  const [situations, setSituations] = useState<Situation[]>([])
  const [npcs, setNpcs] = useState<SituationNpc[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingSituation, setEditingSituation] = useState<Situation | null>(null)

  useEffect(() => {
    Promise.all([listSituations(), listNpcs()]).then(([{ situations: s }, ns]) => {
      setSituations(s ?? [])
      setNpcs(ns)
      setLoading(false)
    })
  }, [])

  async function handleModeChange(situation: Situation, mode: SituationMode) {
    setSaving(situation.id)
    const { error } = await supabase.from('situations').update({ mode }).eq('id', situation.id)
    if (error) { toast.error(error.message); setSaving(null); return }
    setSituations(prev => prev.map(s => s.id === situation.id ? { ...s, mode } : s))
    setSaving(null)
  }

  if (loading) return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />

  if (editingSituation) {
    return (
      <LineEditorView
        situation={editingSituation}
        npcs={npcs}
        onNpcsChange={setNpcs}
        onBack={() => setEditingSituation(null)}
        onSaved={updated => {
          setSituations(prev => prev.map(s => s.id === updated.id ? updated : s))
          setEditingSituation(updated)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Set the conversation mode for each situation. <strong>LLM</strong> uses Claude AI to generate responses in real time — no script needed.
      </p>
      {situations.map(situation => (
        <div key={situation.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-gray-900">{situation.title}</p>
              {situation.mode === 'duo' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium shrink-0">🎭 Duo</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{situation.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {situation.mode === 'duo' ? (
              <>
                <button
                  onClick={() => setEditingSituation(situation)}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors"
                >
                  Edit Dialogue
                </button>
                <Link
                  to={`/duo/${situation.id}`}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                >
                  Open Session
                </Link>
              </>
            ) : (
              <>
                {situation.mode === 'scripted' && (
                  <button
                    onClick={() => setEditingSituation(situation)}
                    className="px-3 py-1.5 text-xs rounded-lg font-medium border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors"
                  >
                    Edit Dialogue
                  </button>
                )}
                {(['scripted', 'llm'] as SituationMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(situation, mode)}
                    disabled={saving === situation.id}
                    className={`px-3 py-1.5 text-xs rounded-lg capitalize font-medium transition-colors ${
                      situation.mode === mode
                        ? mode === 'llm' ? 'bg-violet-600 text-white' : 'bg-brand text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {mode === 'llm' ? '✨ LLM' : 'Scripted'}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Background section ─────────────────────────────────────────────

function BackgroundSection() {
  const [situations, setSituations] = useState<Situation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listSituations().then(({ situations: s }) => {
      setSituations(s ?? [])
      setLoading(false)
    })
  }, [])

  async function handleBackgroundUpload(situation: Situation, file: File) {
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const path = `backgrounds/${situation.id}.${ext}`
    const url = await uploadToStorage(file, path)
    if (!url) return

    const { error } = await supabase
      .from('situations')
      .update({ background_image_url: url })
      .eq('id', situation.id)

    if (error) { toast.error(error.message); return }

    setSituations(prev => prev.map(s => s.id === situation.id ? { ...s, background_image_url: url } : s))
    toast.success(`"${situation.title}" background uploaded`)
  }

  if (loading) return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload a background scene for each situation. JPEG or PNG, 1920×1080px recommended.
      </p>
      {situations.map(situation => (
        <div key={situation.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
          <ImageSlot
            label="Background"
            currentUrl={situation.background_image_url}
            placeholderColor={situation.background_color}
            onUpload={file => handleBackgroundUpload(situation, file)}
            accept="image/jpeg,image/png,image/webp"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900">{situation.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{situation.description}</p>
            {situation.background_image_url
              ? <p className="text-xs text-green-600 mt-1">✓ Background set</p>
              : <p className="text-xs text-amber-500 mt-1">Using colour placeholder</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Shared manager (used by MaterialsPage) ────────────────────────

export function SituationsManager() {
  const [tab, setTab] = useState<'npcs' | 'animations' | 'backgrounds' | 'situations' | 'scripts'>('npcs')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        <Tab label="🎭 Characters"  active={tab === 'npcs'}        onClick={() => setTab('npcs')} />
        <Tab label="🎬 Animations"  active={tab === 'animations'}  onClick={() => setTab('animations')} />
        <Tab label="🖼️ Backgrounds" active={tab === 'backgrounds'} onClick={() => setTab('backgrounds')} />
        <Tab label="⚙️ Situations"  active={tab === 'situations'}  onClick={() => setTab('situations')} />
        <Tab label="✏️ Dialogues"   active={tab === 'scripts'}     onClick={() => setTab('scripts')} />
      </div>

      {tab === 'npcs'        && <NpcSection />}
      {tab === 'animations'  && <AnimationSection />}
      {tab === 'backgrounds' && <BackgroundSection />}
      {tab === 'situations'  && <SituationsSection />}
      {tab === 'scripts'     && <ScriptEditorSection />}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────

export function SituationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Situation Assets</h1>
        <p className="text-gray-500 text-sm mt-1">Assign VRM models and backgrounds for the Situation Simulator</p>
      </div>
      <SituationsManager />
    </div>
  )
}
