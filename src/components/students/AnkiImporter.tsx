import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { addVocabularyToBank, bulkAddWordsToDeck } from '@/lib/api/lessons'
import { toast } from 'sonner'

type ParsedCard = {
  fields: string[]
}

type FieldMap = {
  word: number
  definition_en: number
  definition_ja: number
  example: number
}

type ParseResult = {
  cards: ParsedCard[]
  fieldNames: string[]
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

const SQLITE_MAGIC = 'SQLite format 3\0'

function isSQLite(buf: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buf, 0, 16)
  for (let i = 0; i < 16; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false
  }
  return true
}

// ── TSV parser (Anki "Notes in Plain Text" export) ───────────
async function parseTsv(file: File): Promise<ParseResult> {
  const text = await file.text()
  const lines = text.split('\n')

  // Collect metadata lines (start with #)
  let separator = '\t'
  let fieldNames: string[] = []
  const dataLines: string[] = []

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line) continue
    if (line.startsWith('#')) {
      const m = line.match(/^#separator:(.*)/i)
      if (m) separator = m[1].toLowerCase() === 'tab' ? '\t' : m[1]
      const f = line.match(/^#columns:(.*)/i) ?? line.match(/^#fields:(.*)/i)
      if (f) fieldNames = f[1].split(separator)
      continue
    }
    dataLines.push(line)
  }

  if (!dataLines.length) throw new Error('No card data found in this file.')

  const cards: ParsedCard[] = dataLines.map(l => ({ fields: l.split(separator) }))

  const maxFields = Math.max(...cards.map(c => c.fields.length))
  while (fieldNames.length < maxFields) fieldNames.push(`Field ${fieldNames.length + 1}`)

  return { cards, fieldNames }
}

// ── APKG parser (Anki deck package) ──────────────────────────
async function parseApkg(file: File): Promise<ParseResult> {
  const JSZip = (await import('jszip')).default
  // @ts-ignore - sql.js lacks perfect types for dynamic import
  const initSqlJs = (await import('sql.js')).default

  const wasmBinary = await fetch('/sql-wasm.wasm').then(r => r.arrayBuffer())
  const SQL = await initSqlJs({ wasmBinary })

  const zip = await JSZip.loadAsync(file)

  // Prefer older formats — .anki21b is Anki's internal format, not standard SQLite
  const candidates = ['collection.anki21', 'collection.anki2', 'collection.anki21b']
  let dbBuffer: ArrayBuffer | null = null
  for (const name of candidates) {
    const entry = zip.file(name)
    if (!entry) continue
    const buf = await entry.async('arraybuffer')
    if (isSQLite(buf)) { dbBuffer = buf; break }
  }

  if (!dbBuffer) {
    const files = Object.keys(zip.files).join(', ')
    throw new Error(
      `Could not find a valid SQLite database inside this .apkg file.\n` +
      `Files found: ${files || 'none'}\n\n` +
      `Try exporting from Anki using File → Export → Anki Deck Package (.apkg).`
    )
  }

  const db = new SQL.Database(new Uint8Array(dbBuffer))

  // Discover what tables exist in this export
  const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  const tables = new Set((tablesRes[0]?.values ?? []).map((r: any) => r[0] as string))

  // ── Field names ──────────────────────────────────────────────
  let fieldNames: string[] = []

  // Try col.models JSON (Anki 2.0 / 2.1 schema)
  if (tables.has('col')) {
    try {
      const colRes = db.exec('SELECT models FROM col LIMIT 1')
      const raw = colRes[0]?.values?.[0]?.[0]
      if (raw) {
        const models = JSON.parse(raw as string)
        const firstModel = Object.values(models)[0] as any
        fieldNames = (firstModel?.flds ?? []).map((f: any) => f.name as string)
      }
    } catch { /* fall through */ }
  }

  // Try fields table (Anki 2.1.50+ schema)
  if (fieldNames.length === 0 && tables.has('fields')) {
    try {
      const fRes = db.exec('SELECT name FROM fields ORDER BY ntid, ord')
      if (fRes[0]?.values?.length) {
        fieldNames = fRes[0].values.map((r: any) => r[0] as string)
      }
    } catch { /* fall through */ }
  }

  // ── Notes ────────────────────────────────────────────────────
  // Use prepare+step to iterate all rows (avoids exec memory limits)
  const allFlds: string[] = []

  if (tables.has('notes')) {
    try {
      const stmt = db.prepare('SELECT flds FROM notes')
      while (stmt.step()) {
        const row = stmt.getAsObject() as any
        const flds = row.flds ?? row.FLDS ?? ''
        if (flds) allFlds.push(flds as string)
      }
      stmt.free()
    } catch { /* fall through */ }
  }

  // Some newer exports store content only in cards — try joining
  if (allFlds.length === 0 && tables.has('cards') && tables.has('notes')) {
    try {
      const stmt = db.prepare('SELECT n.flds FROM notes n INNER JOIN cards c ON c.nid = n.id')
      const seen = new Set<string>()
      while (stmt.step()) {
        const row = stmt.getAsObject() as any
        const flds = row.flds ?? row.FLDS ?? ''
        if (flds && !seen.has(flds as string)) {
          seen.add(flds as string)
          allFlds.push(flds as string)
        }
      }
      stmt.free()
    } catch { /* fall through */ }
  }

  db.close()

  if (allFlds.length === 0) {
    throw new Error(
      `Found 0 notes in this deck.\nTables present: ${[...tables].join(', ')}\n` +
      `Try exporting with File → Export → "Anki Deck Package (.apkg)" with "Include all decks" checked.`
    )
  }

  const cards: ParsedCard[] = allFlds.map(flds => ({
    fields: flds.split('\x1f'),
  }))

  // Ensure fieldNames covers all field positions found
  const maxFields = Math.max(...cards.map(c => c.fields.length))
  while (fieldNames.length < maxFields) {
    fieldNames.push(`Field ${fieldNames.length + 1}`)
  }

  return { cards, fieldNames }
}

function looksJapanese(samples: ParsedCard[], fieldIdx: number): boolean {
  return samples.some(c => /[\u3040-\u9fff\uff00-\uffef]/.test(c.fields[fieldIdx] ?? ''))
}

function guessFieldMap(fieldNames: string[], cards: ParsedCard[]): FieldMap {
  const lower = fieldNames.map(n => n.toLowerCase())
  const find = (...terms: string[]): number => {
    for (const term of terms) {
      const i = lower.findIndex(n => n.includes(term))
      if (i !== -1) return i
    }
    return -1
  }

  const wordIdx = find('word', 'front', 'expression', 'vocab', 'english', 'term')
  let defEnIdx = find('definition', 'meaning', 'back', 'english def', 'gloss')
  let defJaIdx = find('japanese', 'ja', '日本語', 'translation', 'kana', 'reading')

  // When field names are generic (e.g. "Field 1", "Field 2"), sample content
  // to detect if the fallback definition field actually contains Japanese
  const sample = cards.slice(0, 5)
  const resolvedWord = wordIdx >= 0 ? wordIdx : 0
  if (defEnIdx < 0 && defJaIdx < 0 && fieldNames.length > 1) {
    const candidateIdx = resolvedWord === 0 ? 1 : 0
    if (looksJapanese(sample, candidateIdx)) {
      defJaIdx = candidateIdx
    } else {
      defEnIdx = candidateIdx
    }
  } else if (defEnIdx >= 0 && defJaIdx < 0 && looksJapanese(sample, defEnIdx)) {
    // Named "definition" field but content is Japanese — reclassify
    defJaIdx = defEnIdx
    defEnIdx = -1
  }

  return {
    word: resolvedWord,
    definition_en: defEnIdx,
    definition_ja: defJaIdx,
    example: find('example', 'sentence', 'usage', 'context'),
  }
}

const SEL_CLASS = 'px-2 py-1.5 rounded border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand'

export function AnkiImporter({
  studentId,
  deckId,
  onImported,
}: {
  studentId?: string
  deckId?: string
  onImported: () => void
}) {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [fieldMap, setFieldMap] = useState<FieldMap>({ word: 0, definition_en: -1, definition_ja: -1, example: -1 })
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    const isTsv = file.name.endsWith('.txt') || file.name.endsWith('.tsv')
    const isApkg = file.name.endsWith('.apkg')
    if (!isTsv && !isApkg) {
      setError('Please select an Anki .apkg or .txt (Notes in Plain Text) file.')
      return
    }
    setParsing(true)
    setError('')
    setResult(null)
    try {
      const parsed = isTsv ? await parseTsv(file) : await parseApkg(file)
      setResult(parsed)
      setFieldMap(guessFieldMap(parsed.fieldNames, parsed.cards))
    } catch (e: any) {
      setError(e.message ?? 'Failed to parse the deck.')
    } finally {
      setParsing(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = Array.from(e.dataTransfer.files).find(f =>
      f.name.endsWith('.apkg') || f.name.endsWith('.txt') || f.name.endsWith('.tsv')
    )
    if (file) handleFile(file)
  }, [])

  async function handleImport() {
    if (!result) return
    setImporting(true)

    const words = result.cards
      .map(c => ({
        word: stripHtml(c.fields[fieldMap.word] ?? ''),
        definition_en: fieldMap.definition_en >= 0 ? (c.fields[fieldMap.definition_en]?.trim() || undefined) : undefined,
        definition_ja: fieldMap.definition_ja >= 0 ? (c.fields[fieldMap.definition_ja]?.trim() || undefined) : undefined,
        example: fieldMap.example >= 0 ? (c.fields[fieldMap.example]?.trim() || undefined) : undefined,
      }))
      .filter(w => w.word && (w.definition_en || w.definition_ja))

    if (!words.length) {
      setError('No valid cards found with the current field mapping.')
      setImporting(false)
      return
    }

    let total = 0

    if (deckId) {
      const { count, error } = await bulkAddWordsToDeck(deckId, words)
      if (error) { setError(error); setImporting(false); return }
      total = count ?? 0
    } else if (studentId) {
      // Import into student's vocabulary bank (batches of 50)
      for (let i = 0; i < words.length; i += 50) {
        const batch = words.slice(i, i + 50).map(w => ({ ...w, student_id: studentId }))
        const res = await addVocabularyToBank(batch)
        if (!res.error) total += batch.length
      }
    }

    setImporting(false)
    setOpen(false)
    setResult(null)
    toast.success(`Imported ${total} words`)
    onImported()
  }

  function FieldSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 w-28 shrink-0">{label}</span>
        <select className={SEL_CLASS} value={value} onChange={e => onChange(Number(e.target.value))}>
          <option value={-1}>— skip —</option>
          {result!.fieldNames.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Import Anki Deck
      </Button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Import Anki Deck" className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <span className="text-base font-semibold">Import Anki Deck</span>
              <button aria-label="Close" onClick={() => { setOpen(false); setResult(null); setError('') }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

              {!result && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => document.getElementById('anki-file-input')?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    dragging ? 'border-brand bg-brand-light' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    id="anki-file-input"
                    type="file"
                    accept=".apkg,.txt,.tsv"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  {parsing ? (
                    <p className="text-sm text-gray-500">Parsing deck…</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-700">Drop an Anki file here</p>
                      <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                      <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                        Supports <span className="font-medium text-gray-500">.apkg</span> and <span className="font-medium text-gray-500">.txt</span> (Notes in Plain Text)
                      </p>
                    </>
                  )}
                </div>
              )}

              {result && (
                <>
                  <p className="text-sm text-gray-600">
                    Found <strong>{result.cards.length}</strong> cards. Map the fields:
                  </p>

                  <div className="space-y-2">
                    <FieldSelect label="Word *" value={fieldMap.word} onChange={v => setFieldMap(m => ({ ...m, word: v }))} />
                    <FieldSelect label="意味 (JA)" value={fieldMap.definition_ja} onChange={v => setFieldMap(m => ({ ...m, definition_ja: v }))} />
                    <FieldSelect label="Definition (EN)" value={fieldMap.definition_en} onChange={v => setFieldMap(m => ({ ...m, definition_en: v }))} />
                    <FieldSelect label="Example" value={fieldMap.example} onChange={v => setFieldMap(m => ({ ...m, example: v }))} />
                  </div>

                  {/* Preview */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Preview (first 3 cards)
                    </div>
                    {result.cards.slice(0, 3).map((card, i) => (
                      <div key={i} className="px-3 py-2 border-t space-y-0.5">
                        <p className="text-sm font-medium text-brand-dark">{stripHtml(card.fields[fieldMap.word] ?? '') || '—'}</p>
                        {fieldMap.definition_ja >= 0 && (
                          <p className="text-xs text-gray-700" dangerouslySetInnerHTML={{ __html: card.fields[fieldMap.definition_ja] || '—' }} />
                        )}
                        {fieldMap.definition_en >= 0 && (
                          <p className="text-xs text-gray-400" dangerouslySetInnerHTML={{ __html: card.fields[fieldMap.definition_en] || '—' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {result && (
              <div className="flex gap-2 px-6 py-4 border-t shrink-0">
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? 'Importing…' : `Import ${result.cards.length} Cards`}
                </Button>
                <Button variant="outline" onClick={() => { setResult(null); setError('') }}>
                  Choose Different File
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
