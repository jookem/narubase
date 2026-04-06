import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { addVocabularyToBank } from '@/lib/api/lessons'
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

const SQLITE_MAGIC = 'SQLite format 3\0'

function isSQLite(buf: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buf, 0, 16)
  for (let i = 0; i < 16; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false
  }
  return true
}

async function parseApkg(file: File): Promise<ParseResult> {
  const JSZip = (await import('jszip')).default
  // @ts-ignore - sql.js lacks perfect types for dynamic import
  const initSqlJs = (await import('sql.js')).default

  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  })

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

  // Read field names from the first note model in col
  let fieldNames: string[] = []
  try {
    const colRes = db.exec('SELECT models FROM col LIMIT 1')
    if (colRes[0]?.values?.[0]?.[0]) {
      const models = JSON.parse(colRes[0].values[0][0] as string)
      const firstModel = Object.values(models)[0] as any
      fieldNames = (firstModel?.flds ?? []).map((f: any) => f.name as string)
    }
  } catch {
    // col table may use different schema in newer Anki versions — fall back to positional
  }

  // If col didn't yield field names, try notetypes table (Anki 2.1.50+)
  if (fieldNames.length === 0) {
    try {
      const ntRes = db.exec(
        'SELECT config FROM notetypes ORDER BY id LIMIT 1'
      )
      if (ntRes[0]?.values?.[0]?.[0]) {
        // config is a protobuf blob — skip, fall back to positional names
      }
      // Try fields table if it exists
      const fRes = db.exec(
        'SELECT name FROM fields ORDER BY ntid, ord'
      )
      if (fRes[0]?.values?.length) {
        fieldNames = fRes[0].values.map((r: any) => r[0] as string)
      }
    } catch {
      // Not all Anki versions have these tables
    }
  }

  // Read all notes
  const notesRes = db.exec('SELECT flds FROM notes')
  db.close()

  if (!notesRes[0]?.values?.length) {
    throw new Error('No cards found in this deck.')
  }

  const cards: ParsedCard[] = notesRes[0].values.map((row: any) => ({
    fields: (row[0] as string).split('\x1f'),
  }))

  // Ensure fieldNames covers all fields we found
  const maxFields = Math.max(...cards.map(c => c.fields.length))
  while (fieldNames.length < maxFields) {
    fieldNames.push(`Field ${fieldNames.length + 1}`)
  }

  return { cards, fieldNames }
}

function guessFieldMap(fieldNames: string[]): FieldMap {
  const lower = fieldNames.map(n => n.toLowerCase())
  const find = (...terms: string[]) => {
    for (const term of terms) {
      const i = lower.findIndex(n => n.includes(term))
      if (i !== -1) return i
    }
    return -1
  }
  return {
    word: find('word', 'front', 'expression', 'vocab', 'english', 'term') ?? 0,
    definition_en: find('definition', 'meaning', 'back', 'english def', 'gloss') ?? 1,
    definition_ja: find('japanese', 'ja', '日本語', 'translation', 'kana', 'reading'),
    example: find('example', 'sentence', 'usage', 'context'),
  }
}

const SEL_CLASS = 'px-2 py-1.5 rounded border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand'

export function AnkiImporter({ studentId, onImported }: { studentId: string; onImported: () => void }) {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [fieldMap, setFieldMap] = useState<FieldMap>({ word: 0, definition_en: 1, definition_ja: -1, example: -1 })
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    if (!file.name.endsWith('.apkg')) {
      setError('Please select an Anki .apkg file.')
      return
    }
    setParsing(true)
    setError('')
    setResult(null)
    try {
      const parsed = await parseApkg(file)
      setResult(parsed)
      setFieldMap(guessFieldMap(parsed.fieldNames))
    } catch (e: any) {
      setError(e.message ?? 'Failed to parse the deck.')
    } finally {
      setParsing(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  async function handleImport() {
    if (!result) return
    setImporting(true)
    const entries = result.cards
      .map(c => ({
        student_id: studentId,
        word: c.fields[fieldMap.word]?.trim() ?? '',
        definition_en: fieldMap.definition_en >= 0 ? (c.fields[fieldMap.definition_en]?.trim() ?? '') : '',
        definition_ja: fieldMap.definition_ja >= 0 ? (c.fields[fieldMap.definition_ja]?.trim() || undefined) : undefined,
        example: fieldMap.example >= 0 ? (c.fields[fieldMap.example]?.trim() || undefined) : undefined,
      }))
      .filter(e => e.word && e.definition_en)

    if (!entries.length) {
      setError('No valid cards found with the current field mapping.')
      setImporting(false)
      return
    }

    // Import in batches of 50 to avoid request limits
    let total = 0
    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50)
      const res = await addVocabularyToBank(batch)
      if (!res.error) total += batch.length
    }

    setImporting(false)
    setOpen(false)
    setResult(null)
    toast.success(`Imported ${total} words from Anki deck`)
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

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Import Anki Deck
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Import Anki Deck</CardTitle>
          <button onClick={() => { setOpen(false); setResult(null); setError('') }} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
              accept=".apkg"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {parsing ? (
              <p className="text-sm text-gray-500">Parsing deck…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">Drop an Anki .apkg file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
              </>
            )}
          </div>
        )}

        {result && (
          <>
            <p className="text-sm text-gray-600">
              Found <strong>{result.cards.length}</strong> cards. Map the Anki fields to vocabulary columns:
            </p>

            <div className="space-y-2">
              <FieldSelect label="Word *" value={fieldMap.word} onChange={v => setFieldMap(m => ({ ...m, word: v }))} />
              <FieldSelect label="Definition (EN) *" value={fieldMap.definition_en} onChange={v => setFieldMap(m => ({ ...m, definition_en: v }))} />
              <FieldSelect label="Definition (JA)" value={fieldMap.definition_ja} onChange={v => setFieldMap(m => ({ ...m, definition_ja: v }))} />
              <FieldSelect label="Example" value={fieldMap.example} onChange={v => setFieldMap(m => ({ ...m, example: v }))} />
            </div>

            {/* Preview of first 3 cards */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Preview (first 3 cards)
              </div>
              {result.cards.slice(0, 3).map((card, i) => (
                <div key={i} className="px-3 py-2 border-t text-sm">
                  <span className="font-medium text-brand-dark">{card.fields[fieldMap.word] || '—'}</span>
                  {fieldMap.definition_en >= 0 && card.fields[fieldMap.definition_en] && (
                    <span className="text-gray-500 mx-2">—</span>
                  )}
                  {fieldMap.definition_en >= 0 && (
                    <span className="text-gray-700">{card.fields[fieldMap.definition_en] || '—'}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Importing…' : `Import ${result.cards.length} Cards`}
              </Button>
              <Button variant="outline" onClick={() => { setResult(null); setError('') }}>
                Choose Different File
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
