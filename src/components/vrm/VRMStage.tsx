import { useRef, useState } from 'react'
import { type VRM } from '@pixiv/three-vrm'
import { VRMViewer, type VRMExpression, type VRMViewerHandle } from './VRMViewer'

const EXPRESSIONS: { id: VRMExpression; label: string; emoji: string }[] = [
  { id: 'neutral',   label: 'Neutral',   emoji: '😐' },
  { id: 'happy',     label: 'Happy',     emoji: '😊' },
  { id: 'sad',       label: 'Sad',       emoji: '😢' },
  { id: 'angry',     label: 'Angry',     emoji: '😠' },
  { id: 'surprised', label: 'Surprised', emoji: '😲' },
  { id: 'relaxed',   label: 'Relaxed',   emoji: '😌' },
]

interface VRMMeta {
  name: string
  version: string
  author: string
  contactInfo: string
}

function extractMeta(vrm: VRM): VRMMeta {
  const m = vrm.meta as any
  if (!m) return { name: 'Unknown', version: '?', author: '—', contactInfo: '—' }
  // VRM 1.0
  if (m.metaVersion === '1') {
    return {
      name: m.name ?? 'Unnamed',
      version: '1.0',
      author: Array.isArray(m.authors) ? m.authors.join(', ') : (m.authors ?? '—'),
      contactInfo: m.contactInformation ?? '—',
    }
  }
  // VRM 0.x
  return {
    name: m.title ?? m.name ?? 'Unnamed',
    version: '0.x',
    author: m.author ?? '—',
    contactInfo: m.contactInformation ?? '—',
  }
}

export function VRMStage() {
  const [vrmUrl, setVrmUrl] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [expression, setExpression] = useState<VRMExpression>('neutral')
  const [meta, setMeta] = useState<VRMMeta | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const viewerRef = useRef<VRMViewerHandle | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  function loadFile(file: File) {
    if (!file.name.endsWith('.vrm')) {
      alert('Please select a .vrm file')
      return
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setVrmUrl(url)
    setMeta(null)
    setExpression('neutral')
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }

  function handleUrlLoad() {
    const url = urlInput.trim()
    if (!url) return
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
    setVrmUrl(url)
    setMeta(null)
    setExpression('neutral')
  }

  function handleLoad(vrm: VRM | null) {
    if (vrm) setMeta(extractMeta(vrm))
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-12rem)] min-h-[500px]">

      {/* ── Viewer ───────────────────────────────────────────── */}
      <div className="flex-1 rounded-2xl overflow-hidden min-h-[300px]"
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
      >
        {vrmUrl ? (
          <VRMViewer
            url={vrmUrl}
            expression={expression}
            autoBlink
            orbitControls
            showGrid
            className="w-full h-full"
            onLoad={handleLoad}
            viewerRef={viewerRef}
          />
        ) : (
          <div
            className={`w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-800 to-slate-900 cursor-pointer transition-all ${
              dragging ? 'ring-4 ring-brand' : ''
            }`}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-6xl">🧍</div>
            <p className="text-white/60 text-sm text-center px-8">
              Drop a <code className="text-brand">.vrm</code> file here, or click to browse
            </p>
            <p className="text-white/30 text-xs">Drag &amp; drop · File picker · URL</p>
          </div>
        )}
        {dragging && vrmUrl && (
          <div className="absolute inset-0 rounded-2xl ring-4 ring-brand pointer-events-none" />
        )}
      </div>

      {/* ── Controls ─────────────────────────────────────────── */}
      <div className="lg:w-64 flex flex-col gap-4 shrink-0">

        {/* Load VRM */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Load VRM</p>

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand hover:text-brand transition-colors"
          >
            📂 Choose .vrm file
          </button>
          <input ref={fileRef} type="file" accept=".vrm" className="hidden" onChange={handleFileInput} />

          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
              placeholder="Paste VRM URL…"
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-0"
            />
            <button
              onClick={handleUrlLoad}
              disabled={!urlInput.trim()}
              className="px-3 py-1.5 bg-brand text-white text-xs rounded-lg disabled:opacity-40"
            >
              Load
            </button>
          </div>
        </div>

        {/* Expressions */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expression</p>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPRESSIONS.map(ex => (
              <button
                key={ex.id}
                onClick={() => setExpression(ex.id)}
                disabled={!vrmUrl}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 ${
                  expression === ex.id
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="text-lg leading-none">{ex.emoji}</span>
                <span className="text-[10px]">{ex.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model info */}
        {meta && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Model Info</p>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-gray-400">Name</span>
                <p className="text-gray-900 font-medium">{meta.name}</p>
              </div>
              <div>
                <span className="text-gray-400">VRM version</span>
                <p className="text-gray-700">{meta.version}</p>
              </div>
              <div>
                <span className="text-gray-400">Author</span>
                <p className="text-gray-700 break-words">{meta.author}</p>
              </div>
              {meta.contactInfo !== '—' && (
                <div>
                  <span className="text-gray-400">Contact</span>
                  <p className="text-gray-700 break-all">{meta.contactInfo}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="text-xs text-gray-400 space-y-1 px-1">
          <p>🖱 Orbit — left drag</p>
          <p>🔍 Zoom — scroll</p>
          <p>✋ Pan — right drag</p>
        </div>
      </div>
    </div>
  )
}
