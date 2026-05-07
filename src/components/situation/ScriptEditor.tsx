import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronUp, ChevronDown, ArrowLeft, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  listNpcs,
  createNpc,
  listMySituations,
  createSituation,
  createDuoSituation,
  updateSituation,
  upsertSituationScript,
  getSituationScript,
  listBackgroundUrls,
  type SituationNpc,
  type Situation,
  type DialogueNode,
} from '@/lib/api/situations'

// ── Student list hook ──────────────────────────────────────────────────

interface StudentOption { id: string; name: string }

function useTeacherStudents(teacherId: string | undefined): StudentOption[] {
  const [students, setStudents] = useState<StudentOption[]>([])
  useEffect(() => {
    if (!teacherId) return
    supabase
      .from('teacher_student_relationships')
      .select('student:profiles!teacher_student_relationships_student_id_fkey(id, full_name, display_name)')
      .eq('teacher_id', teacherId)
      .eq('status', 'active')
      .then(({ data }) => {
        const list = (data ?? []).map((r: any) => ({
          id: r.student.id,
          name: (r.student.display_name || r.student.full_name) as string,
        }))
        setStudents(list)
      })
  }, [teacherId])
  return students
}

// ── Types ──────────────────────────────────────────────────────────────

type DialogueExpression = 'neutral' | 'speaking' | 'positive' | 'confused' | 'thinking'

type EditorLine = {
  id: string
  speaker: string  // 'npc' | 'student' | student name (duo)
  text: string
  expression: DialogueExpression
  options: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────

const EXPR_OPTIONS: { id: DialogueExpression; emoji: string; label: string }[] = [
  { id: 'neutral',  emoji: '😐', label: 'Neutral'  },
  { id: 'speaking', emoji: '💬', label: 'Speaking' },
  { id: 'positive', emoji: '😊', label: 'Happy'    },
  { id: 'confused', emoji: '😕', label: 'Confused' },
  { id: 'thinking', emoji: '🤔', label: 'Thinking' },
]

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function newLine(speaker: string, isDuo = false): EditorLine {
  const isStudent = speaker === 'student'
  return {
    id: uid(),
    speaker,
    text: '',
    expression: 'neutral',
    options: isStudent && !isDuo ? ['', ''] : [],
  }
}

function linesToNodes(lines: EditorLine[], isDuo = false): DialogueNode[] {
  const nodeIds = lines.map((_, i) => (i === 0 ? 'start' : `line_${i}`))
  return lines.map((line, i): DialogueNode => {
    const nextId = i < lines.length - 1 ? nodeIds[i + 1] : null
    if (line.speaker === 'npc') {
      return { id: nodeIds[i], speaker: 'npc', text: line.text, expression: line.expression as DialogueNode['expression'], next: nextId }
    }
    if (isDuo) {
      return { id: nodeIds[i], speaker: line.speaker, text: line.text, expression: line.expression as DialogueNode['expression'], next: nextId }
    }
    return {
      id: nodeIds[i],
      speaker: 'student',
      options: line.options.filter(Boolean).map(opt => ({ text: opt, next: nextId ?? '' })),
    }
  })
}

function nodesToLines(nodes: DialogueNode[]): EditorLine[] {
  return nodes.map(node => {
    const isChoices = node.speaker === 'student' && (node.options?.length ?? 0) > 0
    const rawOpts = isChoices ? (node.options?.map(o => o.text) ?? []) : []
    const options = rawOpts.length >= 2 ? rawOpts : [...rawOpts, ...Array(Math.max(0, 2 - rawOpts.length)).fill('')]
    return {
      id: node.id,
      speaker: node.speaker,
      text: node.text ?? '',
      expression: (node.expression as DialogueExpression) ?? 'neutral',
      options,
    }
  })
}

// ── NPC Picker panel ───────────────────────────────────────────────────

function NpcPickerPanel({
  npcs,
  selectedId,
  onSelect,
  onNpcsChange,
}: {
  npcs: SituationNpc[]
  selectedId: string | null
  onSelect: (npc: SituationNpc) => void
  onNpcsChange: (npcs: SituationNpc[]) => void
}) {
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [vrmFile, setVrmFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const vrmRef = useRef<HTMLInputElement>(null)

  async function handleCreate() {
    if (!name.trim() || !role.trim()) { toast.error('Name and role required'); return }
    setCreating(true)
    const { npc, error } = await createNpc(name.trim(), role.trim(), color)
    if (error || !npc) { toast.error(error ?? 'Create failed'); setCreating(false); return }

    let finalNpc = npc
    if (vrmFile) {
      const path = `npcs/${npc.id}/model_${Date.now()}.vrm`
      const { error: storErr } = await supabase.storage
        .from('situation-assets')
        .upload(path, vrmFile, { upsert: true, contentType: 'model/gltf-binary' })
      if (!storErr) {
        const { data } = supabase.storage.from('situation-assets').getPublicUrl(path)
        await supabase.from('situation_npcs').update({ vrm_url: data.publicUrl }).eq('id', npc.id)
        finalNpc = { ...npc, vrm_url: data.publicUrl }
      }
    }

    onNpcsChange([...npcs, finalNpc])
    onSelect(finalNpc)
    setCreating(false)
    toast.success(`${finalNpc.name} created`)
  }

  return (
    <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
      <div className="max-h-52 overflow-y-auto p-2 space-y-0.5">
        {npcs.map(npc => (
          <button
            key={npc.id}
            onClick={() => onSelect(npc)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              selectedId === npc.id ? 'bg-brand/10 ring-1 ring-brand/30' : 'hover:bg-gray-50'
            }`}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: npc.placeholder_color }}
            >
              {npc.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{npc.name}</p>
              <p className="text-xs text-gray-400 truncate">{npc.role}</p>
            </div>
            {npc.vrm_url && <span className="text-[10px] text-green-600 font-medium shrink-0">VRM</span>}
          </button>
        ))}
        {npcs.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">No characters yet</p>}
      </div>

      <div className="border-t border-gray-100">
        {!showNew ? (
          <button
            onClick={() => setShowNew(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-brand hover:bg-brand/5 transition-colors"
          >
            <Plus size={13} /> New character
          </button>
        ) : (
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New character</p>
            <input
              placeholder="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <input
              placeholder="Role (e.g. Shopkeeper)"
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500">Colour</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-7 rounded border border-gray-200 cursor-pointer" />
            </div>
            <button
              onClick={() => vrmRef.current?.click()}
              className="flex items-center gap-1.5 text-xs border border-dashed border-gray-300 hover:border-brand text-gray-500 hover:text-brand px-2.5 py-1.5 rounded-lg w-full transition-colors"
            >
              <Upload size={11} />
              {vrmFile ? vrmFile.name.slice(0, 20) + (vrmFile.name.length > 20 ? '…' : '') : 'Upload VRM (optional)'}
            </button>
            {vrmFile && (
              <button onClick={() => setVrmFile(null)} className="text-xs text-red-400 hover:text-red-600">Remove VRM</button>
            )}
            <input ref={vrmRef} type="file" accept=".vrm" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setVrmFile(f); e.target.value = '' }} />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowNew(false); setName(''); setRole(''); setVrmFile(null) }}
                className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >Cancel</button>
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim() || !role.trim()}
                className="flex-1 py-1.5 text-xs bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Background picker ─────────────────────────────────────────────────

function BackgroundPicker({
  color,
  imageUrl,
  onColorChange,
  onImageSelect,
}: {
  color: string
  imageUrl: string | null
  onColorChange: (c: string) => void
  onImageSelect: (url: string | null) => void
}) {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    listBackgroundUrls().then(setUrls)
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Colour</label>
          <input type="color" value={color} onChange={e => onColorChange(e.target.value)}
            className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer" />
          <span className="text-xs text-gray-400 font-mono">{color}</span>
        </div>
        {imageUrl && (
          <button onClick={() => onImageSelect(null)}
            className="text-xs text-red-400 hover:text-red-600 transition-colors">
            Remove image
          </button>
        )}
      </div>

      {urls.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {urls.map(url => (
            <button
              key={url}
              onClick={() => onImageSelect(imageUrl === url ? null : url)}
              className={`relative w-20 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                imageUrl === url ? 'border-brand ring-2 ring-brand/30' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              {imageUrl === url && (
                <div className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dialogue line row ──────────────────────────────────────────────────

function LineRow({
  line, index, total, duoRoles, onChange, onDelete, onMove,
}: {
  line: EditorLine
  index: number
  total: number
  duoRoles?: [string, string]
  onChange: (l: EditorLine) => void
  onDelete: () => void
  onMove: (dir: 'up' | 'down') => void
}) {
  const isNpc = line.speaker === 'npc'
  const isDuoLine = !!duoRoles && !isNpc

  const borderColor = isNpc
    ? 'border-indigo-100 bg-indigo-50/40'
    : duoRoles
    ? line.speaker === duoRoles[0]
      ? 'border-amber-100 bg-amber-50/40'
      : 'border-teal-100 bg-teal-50/40'
    : 'border-amber-100 bg-amber-50/40'

  return (
    <div className={`group border rounded-xl p-3 space-y-2 ${borderColor}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Speaker toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium shrink-0">
          <button
            onClick={() => onChange({ ...line, speaker: 'npc', options: [] })}
            className={`px-2.5 py-1 transition-colors ${isNpc ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >NPC</button>
          {duoRoles ? (
            <>
              <button
                onClick={() => onChange({ ...line, speaker: duoRoles[0], options: [] })}
                className={`px-2.5 py-1 transition-colors ${line.speaker === duoRoles[0] ? 'bg-amber-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >{duoRoles[0] || 'Role A'}</button>
              <button
                onClick={() => onChange({ ...line, speaker: duoRoles[1], options: [] })}
                className={`px-2.5 py-1 transition-colors ${line.speaker === duoRoles[1] ? 'bg-teal-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >{duoRoles[1] || 'Role B'}</button>
            </>
          ) : (
            <button
              onClick={() => onChange({ ...line, speaker: 'student', text: '', options: line.options.length >= 2 ? line.options : ['', ''] })}
              className={`px-2.5 py-1 transition-colors ${!isNpc ? 'bg-amber-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >Student</button>
          )}
        </div>

        {/* Expression picker — NPC only */}
        {isNpc && (
          <div className="flex gap-0.5">
            {EXPR_OPTIONS.map(ex => (
              <button
                key={ex.id}
                onClick={() => onChange({ ...line, expression: ex.id })}
                title={ex.label}
                className={`text-base px-1.5 py-0.5 rounded-lg transition-colors ${
                  line.expression === ex.id ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'hover:bg-gray-100'
                }`}
              >{ex.emoji}</button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Reorder + delete */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onMove('up')} disabled={index === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-25 transition-colors">
            <ChevronUp size={14} className="text-gray-500" />
          </button>
          <button onClick={() => onMove('down')} disabled={index === total - 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-25 transition-colors">
            <ChevronDown size={14} className="text-gray-500" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 transition-colors">
            <Trash2 size={14} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Text input — NPC or duo student line */}
      {(isNpc || isDuoLine) && (
        <textarea
          placeholder={isNpc ? 'What the NPC says…' : `What ${line.speaker} says (student will speak this aloud)…`}
          value={line.text}
          onChange={e => onChange({ ...line, text: e.target.value })}
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none bg-white"
        />
      )}

      {/* Student choice options (non-duo only) */}
      {!isNpc && !isDuoLine && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400 font-medium">Response options shown to student:</p>
          {line.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4 shrink-0">{oi + 1}.</span>
              <input
                placeholder={`Option ${oi + 1}…`}
                value={opt}
                onChange={e => {
                  const opts = [...line.options]
                  opts[oi] = e.target.value
                  onChange({ ...line, options: opts })
                }}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
              />
              {line.options.length > 2 && (
                <button onClick={() => onChange({ ...line, options: line.options.filter((_, i) => i !== oi) })}
                  className="text-red-300 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => onChange({ ...line, options: [...line.options, ''] })}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand transition-colors ml-6"
          >
            <Plus size={11} /> Add option
          </button>
        </div>
      )}
    </div>
  )
}

// ── Line editor (for one situation) ───────────────────────────────────

function LineEditorView({
  situation, npcs, onNpcsChange, onBack, onSaved,
}: {
  situation: Situation
  npcs: SituationNpc[]
  onNpcsChange: (npcs: SituationNpc[]) => void
  onBack: () => void
  onSaved: (updated: Situation) => void
}) {
  const { user } = useAuth()
  const students = useTeacherStudents(user?.id)
  const isDuo = situation.mode === 'duo'
  const [lines, setLines] = useState<EditorLine[]>([])
  const [duoRoles, setDuoRoles] = useState<[string, string]>(['', ''])
  const [title, setTitle] = useState(situation.title)
  const [npcId, setNpcId] = useState<string | null>(situation.npc_id)
  const [difficulty, setDifficulty] = useState(situation.difficulty)
  const [bgColor, setBgColor] = useState(situation.background_color)
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(situation.background_image_url ?? null)
  const [showNpcPicker, setShowNpcPicker] = useState(false)
  const [loadingScript, setLoadingScript] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSituationScript(situation.id).then(({ script }) => {
      if (script?.script.duo_roles) setDuoRoles(script.script.duo_roles)
      if (script && script.script.nodes.length > 0) {
        setLines(nodesToLines(script.script.nodes))
      } else {
        setLines([newLine(isDuo ? '' : 'npc', isDuo)])
      }
      setLoadingScript(false)
    })
  }, [situation.id])

  const selectedNpc = npcs.find(n => n.id === npcId) ?? null

  async function handleSave() {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (isDuo && (!duoRoles[0].trim() || !duoRoles[1].trim())) {
      toast.error('Both student names are required for a duo situation')
      return
    }
    setSaving(true)

    const validLines = lines.filter(l =>
      l.speaker === 'npc' ? l.text.trim().length > 0 : isDuo ? l.text.trim().length > 0 : l.options.some(Boolean),
    )
    const nodes = linesToNodes(validLines, isDuo)

    const scriptPayload = isDuo
      ? { nodes, duo_roles: duoRoles as [string, string] }
      : { nodes }

    const [situationResult, scriptResult] = await Promise.all([
      updateSituation(situation.id, { title: title.trim(), npc_id: npcId, difficulty, background_color: bgColor, background_image_url: bgImageUrl }),
      upsertSituationScript(situation.id, scriptPayload),
    ])

    if (situationResult.error) { toast.error(situationResult.error); setSaving(false); return }
    if (scriptResult.error)   { toast.error(scriptResult.error);   setSaving(false); return }

    const updated: Situation = { ...situation, title: title.trim(), npc_id: npcId, difficulty, background_color: bgColor, npc: selectedNpc ?? undefined }
    toast.success('Saved')
    onSaved(updated)
    setSaving(false)
  }

  function moveLine(index: number, dir: 'up' | 'down') {
    setLines(prev => {
      const arr = [...prev]
      const j = dir === 'up' ? index - 1 : index + 1
      ;[arr[index], arr[j]] = [arr[j], arr[index]]
      return arr
    })
  }

  if (loadingScript) return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Situation title…"
          className="flex-1 text-lg font-semibold bg-transparent focus:outline-none focus:ring-2 focus:ring-brand/30 rounded-lg px-2 py-1 min-w-0"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors shrink-0"
        >
          {saving && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
          Save
        </button>
      </div>

      {/* Duo role names */}
      {isDuo && (
        <div className="flex gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="flex-1">
            <label className="text-xs text-purple-600 font-medium block mb-1">Student A</label>
            <select
              value={duoRoles[0]}
              onChange={e => setDuoRoles([e.target.value, duoRoles[1]])}
              className="w-full text-sm border border-purple-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
            >
              <option value="">Pick student…</option>
              {students.filter(s => s.name !== duoRoles[1]).map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-teal-600 font-medium block mb-1">Student B</label>
            <select
              value={duoRoles[1]}
              onChange={e => setDuoRoles([duoRoles[0], e.target.value])}
              className="w-full text-sm border border-teal-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
            >
              <option value="">Pick student…</option>
              {students.filter(s => s.name !== duoRoles[0]).map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-4 p-4 bg-white border border-gray-200 rounded-xl">
        {/* NPC picker — hidden for duo */}
        {!isDuo && (
          <div className="relative">
            <p className="text-xs text-gray-500 mb-1">Character</p>
            <button
              onClick={() => setShowNpcPicker(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg hover:border-brand text-sm transition-colors"
            >
              {selectedNpc ? (
                <>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: selectedNpc.placeholder_color }}>
                    {selectedNpc.name[0]}
                  </div>
                  {selectedNpc.name}
                </>
              ) : (
                <span className="text-gray-400">Pick character…</span>
              )}
              <span className="text-gray-300 text-xs ml-1">▾</span>
            </button>
            {showNpcPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNpcPicker(false)} />
                <NpcPickerPanel
                  npcs={npcs}
                  selectedId={npcId}
                  onSelect={npc => { setNpcId(npc.id); setShowNpcPicker(false) }}
                  onNpcsChange={onNpcsChange}
                />
              </>
            )}
          </div>
        )}

        {/* Difficulty */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Difficulty</p>
          <div className="flex gap-1">
            {(['beginner', 'intermediate', 'advanced'] as const).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`px-2.5 py-1 text-xs rounded-lg capitalize transition-colors ${
                  difficulty === d ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{d}</button>
            ))}
          </div>
        </div>

        {/* Background */}
        <div className="w-full">
          <p className="text-xs text-gray-500 mb-1">Background</p>
          <BackgroundPicker
            color={bgColor}
            imageUrl={bgImageUrl}
            onColorChange={setBgColor}
            onImageSelect={setBgImageUrl}
          />
        </div>
      </div>

      {/* Dialogue lines */}
      <div className="space-y-2">
        {lines.map((line, i) => (
          <LineRow
            key={line.id}
            line={line}
            index={i}
            total={lines.length}
            duoRoles={isDuo ? duoRoles : undefined}
            onChange={updated => setLines(prev => prev.map(l => l.id === line.id ? updated : l))}
            onDelete={() => setLines(prev => prev.filter(l => l.id !== line.id))}
            onMove={dir => moveLine(i, dir)}
          />
        ))}
      </div>

      {/* Add line buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setLines(prev => [...prev, newLine('npc', isDuo)])}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <Plus size={14} /> NPC line
        </button>
        {!isDuo && (
          <button
            onClick={() => setLines(prev => [...prev, newLine('student')])}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
          >
            <Plus size={14} /> Student choices
          </button>
        )}
        {isDuo && (
          <>
            <button
              onClick={() => setLines(prev => [...prev, newLine(duoRoles[0] || 'Student A', true)])}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <Plus size={14} /> {duoRoles[0] || 'Student A'} line
            </button>
            <button
              onClick={() => setLines(prev => [...prev, newLine(duoRoles[1] || 'Student B', true)])}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-teal-300 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
            >
              <Plus size={14} /> {duoRoles[1] || 'Student B'} line
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── New situation form ─────────────────────────────────────────────────

function NewSituationForm({
  npcs,
  onNpcsChange,
  onCreated,
  onCancel,
  teacherId,
}: {
  npcs: SituationNpc[]
  onNpcsChange: (npcs: SituationNpc[]) => void
  onCreated: (situation: Situation) => void
  onCancel: () => void
  teacherId: string
}) {
  const { user } = useAuth()
  const students = useTeacherStudents(user?.id)
  const [isDuo, setIsDuo] = useState(false)
  const [duoRoleA, setDuoRoleA] = useState('')
  const [duoRoleB, setDuoRoleB] = useState('')
  const [title, setTitle] = useState('')
  const [npcId, setNpcId] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [bgColor, setBgColor] = useState('#e0f2fe')
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null)
  const [showNpcPicker, setShowNpcPicker] = useState(false)
  const [creating, setCreating] = useState(false)

  const selectedNpc = npcs.find(n => n.id === npcId) ?? null

  async function handleCreate() {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (isDuo && (!duoRoleA.trim() || !duoRoleB.trim())) {
      toast.error('Both student names are required for a duo situation')
      return
    }
    setCreating(true)

    let situation: Situation | undefined
    let error: string | undefined

    if (isDuo) {
      const result = await createDuoSituation(
        teacherId,
        { title: title.trim(), background_color: bgColor, difficulty, age_groups: ['children', 'teens', 'adults'] },
        [duoRoleA.trim(), duoRoleB.trim()],
      )
      situation = result.situation
      error = result.error
    } else {
      const result = await createSituation(teacherId, {
        title: title.trim(),
        description: '',
        npc_id: npcId,
        background_color: bgColor,
        difficulty,
        age_groups: ['children', 'teens', 'adults'],
      })
      situation = result.situation
      error = result.error
    }

    if (!error && situation && bgImageUrl) {
      await updateSituation(situation.id, { background_image_url: bgImageUrl })
    }
    if (error || !situation) { toast.error(error ?? 'Failed to create'); setCreating(false); return }
    onCreated(situation)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <p className="text-sm font-semibold text-gray-800">New Situation</p>

      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium w-fit">
        <button
          onClick={() => setIsDuo(false)}
          className={`px-3 py-1.5 transition-colors ${!isDuo ? 'bg-brand text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >Standard</button>
        <button
          onClick={() => setIsDuo(true)}
          className={`px-3 py-1.5 transition-colors ${isDuo ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >🎭 Duo (karaoke speaking)</button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Title</label>
          <input
            placeholder="e.g. At the Convenience Store"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {/* Duo student pickers */}
        {isDuo && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-purple-600 font-medium block mb-1">Student A</label>
              <select
                value={duoRoleA}
                onChange={e => setDuoRoleA(e.target.value)}
                className="w-full text-sm border border-purple-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
              >
                <option value="">Pick student…</option>
                {students.filter(s => s.name !== duoRoleB).map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-teal-600 font-medium block mb-1">Student B</label>
              <select
                value={duoRoleB}
                onChange={e => setDuoRoleB(e.target.value)}
                className="w-full text-sm border border-teal-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
              >
                <option value="">Pick student…</option>
                {students.filter(s => s.name !== duoRoleA).map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          {/* NPC — hidden for duo */}
          {!isDuo && (
            <div className="relative">
              <p className="text-xs text-gray-500 mb-1">Character</p>
              <button
                onClick={() => setShowNpcPicker(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg hover:border-brand text-sm transition-colors"
              >
                {selectedNpc ? (
                  <>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: selectedNpc.placeholder_color }}>{selectedNpc.name[0]}</div>
                    {selectedNpc.name}
                  </>
                ) : <span className="text-gray-400">Pick character…</span>}
                <span className="text-gray-300 text-xs ml-1">▾</span>
              </button>
              {showNpcPicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowNpcPicker(false)} />
                  <NpcPickerPanel
                    npcs={npcs}
                    selectedId={npcId}
                    onSelect={npc => { setNpcId(npc.id); setShowNpcPicker(false) }}
                    onNpcsChange={onNpcsChange}
                  />
                </>
              )}
            </div>
          )}

          {/* Difficulty */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Difficulty</p>
            <div className="flex gap-1">
              {(['beginner', 'intermediate', 'advanced'] as const).map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`px-2.5 py-1 text-xs rounded-lg capitalize transition-colors ${
                    difficulty === d ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{d}</button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div className="w-full">
            <p className="text-xs text-gray-500 mb-1">Background</p>
            <BackgroundPicker
              color={bgColor}
              imageUrl={bgImageUrl}
              onColorChange={setBgColor}
              onImageSelect={setBgImageUrl}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={creating || !title.trim()}
          className="flex-1 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors font-medium"
        >
          {creating ? 'Creating…' : 'Create & Edit Dialogue'}
        </button>
      </div>
    </div>
  )
}

// ── Main section (exported) ────────────────────────────────────────────

export function ScriptEditorSection() {
  const { user } = useAuth()
  const [situations, setSituations] = useState<Situation[]>([])
  const [npcs, setNpcs] = useState<SituationNpc[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSituation, setEditingSituation] = useState<Situation | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([listMySituations(user.id), listNpcs()]).then(([sits, ns]) => {
      setSituations(sits)
      setNpcs(ns)
      setLoading(false)
    })
  }, [user])

  if (!user) return null
  if (loading) return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />

  // ── Edit view ──
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

  // ── List view ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Custom scripted conversations</p>
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
          >
            <Plus size={14} /> New Situation
          </button>
        )}
      </div>

      {showNewForm && (
        <NewSituationForm
          npcs={npcs}
          onNpcsChange={setNpcs}
          teacherId={user.id}
          onCreated={situation => {
            setSituations(prev => [situation, ...prev])
            setShowNewForm(false)
            setEditingSituation(situation)
          }}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {situations.length === 0 && !showNewForm ? (
        <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <p className="text-4xl mb-2">✏️</p>
          <p className="text-sm">No custom situations yet.</p>
          <p className="text-xs mt-1 text-gray-300">Click "New Situation" to write your first dialogue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {situations.map(sit => {
            const npc = npcs.find(n => n.id === sit.npc_id)
            return (
              <div key={sit.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                {npc ? (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: npc.placeholder_color }}>{npc.name[0]}</div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 text-xl shrink-0">?</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{sit.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{npc?.name ?? 'No character'} · {sit.difficulty}</p>
                </div>
                <button
                  onClick={() => setEditingSituation(sit)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-brand hover:text-brand transition-colors shrink-0"
                >
                  Edit
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
