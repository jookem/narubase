import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { SituationNpc, AvatarPreset, Situation } from '@/lib/api/situations'
import { listSituations, listAvatarPresets } from '@/lib/api/situations'
import { Upload, ImageIcon } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

const EXPRESSIONS = ['neutral', 'speaking', 'positive', 'confused', 'thinking'] as const
type Expression = typeof EXPRESSIONS[number]

const EXPRESSION_LABELS: Record<Expression, string> = {
  neutral:  'Neutral',
  speaking: 'Speaking',
  positive: 'Positive',
  confused: 'Confused',
  thinking: 'Thinking',
}

// ── Storage helpers ────────────────────────────────────────────────

async function uploadToStorage(file: File, path: string): Promise<string | null> {
  const { error } = await supabase.storage
    .from('situation-assets')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) { toast.error(error.message); return null }

  const { data } = supabase.storage.from('situation-assets').getPublicUrl(path)
  return data.publicUrl
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
    // Optimistic local preview
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

function NpcSection() {
  const [npcs, setNpcs] = useState<SituationNpc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('situation_npcs').select('*').order('name').then(({ data }) => {
      setNpcs((data ?? []) as SituationNpc[])
      setLoading(false)
    })
  }, [])

  async function handleExpressionUpload(npc: SituationNpc, expression: Expression, file: File) {
    const path = `npcs/${npc.id}/${expression}.png`
    const url = await uploadToStorage(file, path)
    if (!url) return

    const newSprites = { ...npc.sprites, [expression]: url }
    const { error } = await supabase
      .from('situation_npcs')
      .update({ sprites: newSprites })
      .eq('id', npc.id)

    if (error) { toast.error(error.message); return }

    setNpcs(prev => prev.map(n => n.id === npc.id ? { ...n, sprites: newSprites } : n))
    toast.success(`${npc.name} · ${EXPRESSION_LABELS[expression]} uploaded`)
  }

  if (loading) return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload a transparent PNG for each expression. 512×512px recommended.
      </p>
      {npcs.map(npc => (
        <div key={npc.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: npc.placeholder_color }}
            >
              {npc.name[0]}
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">{npc.name}</p>
              <p className="text-xs text-gray-400">{npc.role}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {EXPRESSIONS.map(expr => (
              <ImageSlot
                key={expr}
                label={EXPRESSION_LABELS[expr]}
                currentUrl={npc.sprites?.[expr] ?? null}
                placeholderColor={npc.placeholder_color}
                onUpload={file => handleExpressionUpload(npc, expr, file)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Avatar section ─────────────────────────────────────────────────

function AvatarSection() {
  const [presets, setPresets] = useState<AvatarPreset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listAvatarPresets().then(({ presets: p }) => {
      setPresets(p ?? [])
      setLoading(false)
    })
  }, [])

  async function handleExpressionUpload(preset: AvatarPreset, expression: Expression, file: File) {
    const path = `avatars/${preset.id}/${expression}.png`
    const url = await uploadToStorage(file, path)
    if (!url) return

    const newSprites = { ...preset.sprites, [expression]: url }
    const { error } = await supabase
      .from('avatar_presets')
      .update({ sprites: newSprites })
      .eq('id', preset.id)

    if (error) { toast.error(error.message); return }

    setPresets(prev => prev.map(p => p.id === preset.id ? { ...p, sprites: newSprites } : p))
    toast.success(`${preset.name} · ${EXPRESSION_LABELS[expression]} uploaded`)
  }

  if (loading) return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />

  const groups = ['children', 'teens', 'adults'] as const

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Upload a transparent PNG for each expression. 512×512px, waist-up framing. Avatars are mirrored automatically to face the NPC.
      </p>
      {groups.map(group => {
        const groupPresets = presets.filter(p => p.age_group === group)
        return (
          <div key={group}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 capitalize">{group}</p>
            <div className="space-y-4">
              {groupPresets.map(preset => (
                <div key={preset.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: preset.placeholder_color }}
                    >
                      {preset.name[0]}
                    </div>
                    <p className="font-semibold text-sm text-gray-900">{preset.name}</p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {EXPRESSIONS.map(expr => (
                      <ImageSlot
                        key={expr}
                        label={EXPRESSION_LABELS[expr]}
                        currentUrl={preset.sprites?.[expr] ?? null}
                        placeholderColor={preset.placeholder_color}
                        onUpload={file => handleExpressionUpload(preset, expr, file)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
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
  const [tab, setTab] = useState<'npcs' | 'avatars' | 'backgrounds'>('npcs')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-xl p-1">
        <Tab label="🎭 Characters" active={tab === 'npcs'}        onClick={() => setTab('npcs')} />
        <Tab label="👤 Avatars"    active={tab === 'avatars'}     onClick={() => setTab('avatars')} />
        <Tab label="🖼️ Backgrounds" active={tab === 'backgrounds'} onClick={() => setTab('backgrounds')} />
      </div>

      {tab === 'npcs'        && <NpcSection />}
      {tab === 'avatars'     && <AvatarSection />}
      {tab === 'backgrounds' && <BackgroundSection />}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────

export function SituationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Situation Assets</h1>
        <p className="text-gray-500 text-sm mt-1">Upload character sprites and scene backgrounds for the Situation Simulator</p>
      </div>
      <SituationsManager />
    </div>
  )
}
