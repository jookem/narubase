import { useEffect, useState } from 'react'
import {
  listPuzzleDecks, createPuzzleDeck, deletePuzzleDeck, renamePuzzleDeck,
  getPuzzleDeckWithPuzzles, createPuzzle, updatePuzzle, deletePuzzle,
  assignPuzzleDeckToStudent, removePuzzleDeckFromStudent, getAssignedDeckIds,
  type PuzzleDeck, type Puzzle, type PuzzlePart,
} from '@/lib/api/puzzles'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

// ── Source picker types ───────────────────────────────────────
interface SourceItem {
  sentence: string   // the Japanese / example sentence to use as prompt
  hint: string       // the grammar point / word as a hint
  source: string     // deck name for display
}

async function loadSourceItems(): Promise<SourceItem[]> {
  const items: SourceItem[] = []

  // Grammar decks — each point may have example sentences
  const { data: grammarDecks } = await supabase
    .from('grammar_decks')
    .select('name, grammar_deck_points(point, explanation, examples)')
    .order('created_at', { ascending: false })

  for (const deck of grammarDecks ?? []) {
    for (const pt of (deck as any).grammar_deck_points ?? []) {
      for (const ex of pt.examples ?? []) {
        if (ex?.trim()) {
          items.push({ sentence: ex.trim(), hint: pt.point, source: `Grammar: ${deck.name}` })
        }
      }
    }
  }

  // Vocabulary decks — each word may have an example sentence
  const { data: vocabDecks } = await supabase
    .from('vocabulary_decks')
    .select('name, vocabulary_deck_words(word, example)')
    .order('created_at', { ascending: false })

  for (const deck of vocabDecks ?? []) {
    for (const w of (deck as any).vocabulary_deck_words ?? []) {
      if (w.example?.trim()) {
        items.push({ sentence: w.example.trim(), hint: w.word, source: `Vocab: ${deck.name}` })
      }
    }
  }

  return items
}

// ── Source Picker Modal ───────────────────────────────────────
function SourcePicker({
  onSelect,
  onClose,
}: {
  onSelect: (sentence: string, hint: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<SourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    loadSourceItems().then(i => { setItems(i); setLoading(false) })
  }, [])

  const filtered = filter.trim()
    ? items.filter(i =>
        i.sentence.toLowerCase().includes(filter.toLowerCase()) ||
        i.hint.toLowerCase().includes(filter.toLowerCase()) ||
        i.source.toLowerCase().includes(filter.toLowerCase())
      )
    : items

  // Group by source deck
  const groups = filtered.reduce<Record<string, SourceItem[]>>((acc, item) => {
    ;(acc[item.source] ??= []).push(item)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <span className="font-semibold text-gray-900">Source from Deck</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-6 py-3 border-b shrink-0">
          <Input
            autoFocus
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by sentence, word, or deck…"
            className="h-8 text-sm"
          />
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-3 space-y-4">
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : Object.keys(groups).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {items.length === 0
                ? 'No examples found in your grammar or vocabulary decks yet.'
                : 'No matches for that filter.'}
            </p>
          ) : (
            Object.entries(groups).map(([source, groupItems]) => (
              <div key={source}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{source}</p>
                <div className="space-y-1">
                  {groupItems.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => { onSelect(item.sentence, item.hint); onClose() }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-brand-light border border-transparent hover:border-brand/20 transition-colors"
                    >
                      <p className="text-sm text-gray-900">{item.sentence}</p>
                      <p className="text-xs text-gray-400 mt-0.5">hint: {item.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

const LABELS = ['Subject', 'Verb', 'Object', 'Adjective', 'Adverb', 'Complement', 'Other']

const LABEL_COLORS: Record<string, string> = {
  Subject:    'bg-blue-100 text-blue-700',
  Verb:       'bg-red-100 text-red-700',
  Object:     'bg-green-100 text-green-700',
  Adjective:  'bg-purple-100 text-purple-700',
  Adverb:     'bg-orange-100 text-orange-700',
  Complement: 'bg-pink-100 text-pink-700',
  Other:      'bg-gray-100 text-gray-600',
}

// ── Puzzle Editor Modal ───────────────────────────────────────
function PuzzleEditor({
  deck,
  onClose,
  onUpdated,
  onDelete,
}: {
  deck: PuzzleDeck
  onClose: () => void
  onUpdated: () => void
  onDelete: (id: string, name: string) => Promise<void>
}) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>(deck.puzzles ?? [])
  const [loading, setLoading] = useState(!deck.puzzles)
  const [name, setName] = useState(deck.name)
  const [renamingName, setRenamingName] = useState(false)

  // New puzzle form
  const [japanese, setJapanese] = useState('')
  const [hint, setHint] = useState('')
  const [parts, setParts] = useState<PuzzlePart[]>([{ text: '', label: 'Subject' }])
  const [saving, setSaving] = useState(false)
  const [showSourcePicker, setShowSourcePicker] = useState(false)

  // Editing existing puzzle
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editJapanese, setEditJapanese] = useState('')
  const [editHint, setEditHint] = useState('')
  const [editParts, setEditParts] = useState<PuzzlePart[]>([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!deck.puzzles) {
      getPuzzleDeckWithPuzzles(deck.id).then(({ deck: d }) => {
        setPuzzles(d?.puzzles ?? [])
        setLoading(false)
      })
    }
  }, [deck.id])

  async function handleSaveName() {
    if (!name.trim() || name.trim() === deck.name) { setRenamingName(false); return }
    await renamePuzzleDeck(deck.id, name.trim())
    deck.name = name.trim()
    onUpdated()
    setRenamingName(false)
  }

  function addPart() { setParts(p => [...p, { text: '', label: 'Subject' }]) }
  function removePart(i: number) { setParts(p => p.filter((_, idx) => idx !== i)) }
  function updatePart(i: number, field: keyof PuzzlePart, val: string) {
    setParts(p => p.map((part, idx) => idx === i ? { ...part, [field]: val } : part))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const validParts = parts.filter(p => p.text.trim())
    if (!japanese.trim() || validParts.length < 2) return
    setSaving(true)
    const { puzzle, error } = await createPuzzle(deck.id, {
      japanese_sentence: japanese.trim(),
      hint: hint.trim() || undefined,
      parts: validParts.map(p => ({ text: p.text.trim(), label: p.label })),
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    setPuzzles(prev => [...prev, puzzle!])
    setJapanese(''); setHint(''); setParts([{ text: '', label: 'Subject' }])
    onUpdated()
  }

  function startEdit(p: Puzzle) {
    setEditingId(p.id)
    setEditJapanese(p.japanese_sentence)
    setEditHint(p.hint ?? '')
    setEditParts([...p.parts])
  }

  async function handleEditSave() {
    if (!editingId) return
    const validParts = editParts.filter(p => p.text.trim())
    if (!editJapanese.trim() || validParts.length < 2) return
    setSavingEdit(true)
    const { error } = await updatePuzzle(editingId, {
      japanese_sentence: editJapanese.trim(),
      hint: editHint.trim() || undefined,
      parts: validParts.map(p => ({ text: p.text.trim(), label: p.label })),
    })
    setSavingEdit(false)
    if (error) { toast.error(error); return }
    setPuzzles(prev => prev.map(p => p.id === editingId ? {
      ...p, japanese_sentence: editJapanese.trim(), hint: editHint.trim() || null,
      parts: validParts,
    } : p))
    setEditingId(null)
    onUpdated()
  }

  async function handleDelete(puzzleId: string) {
    setDeleting(puzzleId)
    const { error } = await deletePuzzle(puzzleId)
    setDeleting(null)
    if (error) toast.error(error)
    else { setPuzzles(prev => prev.filter(p => p.id !== puzzleId)); onUpdated() }
  }

  function PartsForm({
    parts: pts,
    onChange,
    onAdd,
    onRemove,
  }: {
    parts: PuzzlePart[]
    onChange: (i: number, f: keyof PuzzlePart, v: string) => void
    onAdd: () => void
    onRemove: (i: number) => void
  }) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-gray-500 font-medium">Parts — in correct order:</p>
        {pts.map((part, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
            <Input
              value={part.text}
              onChange={e => onChange(i, 'text', e.target.value)}
              placeholder="English text"
              className="h-7 text-xs flex-1"
            />
            <select
              value={part.label}
              onChange={e => onChange(i, 'label', e.target.value)}
              className="h-7 text-xs border border-gray-200 rounded px-1 bg-white"
            >
              {LABELS.map(l => <option key={l}>{l}</option>)}
            </select>
            {pts.length > 2 && (
              <button type="button" onClick={() => onRemove(i)} className="text-gray-300 hover:text-red-500 text-xs transition-colors">✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={onAdd} className="text-xs text-brand hover:text-brand/80 transition-colors">
          + Add part
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          {renamingName ? (
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setRenamingName(false) }}
              className="text-lg font-semibold border-b-2 border-brand outline-none flex-1"
            />
          ) : (
            <button onClick={() => setRenamingName(true)} className="text-lg font-semibold text-gray-900 hover:text-brand transition-colors text-left">
              {name} <span className="text-xs text-gray-400 font-normal">✏️</span>
            </button>
          )}
          <div className="flex items-center gap-3 ml-4">
            <button onClick={async () => { await onDelete(deck.id, name); onClose() }} className="text-xs text-gray-300 hover:text-red-500 transition-colors">
              Delete deck
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        {showSourcePicker && (
          <SourcePicker
            onSelect={(sentence, hint) => { setJapanese(sentence); setHint(hint) }}
            onClose={() => setShowSourcePicker(false)}
          />
        )}

        {/* Add puzzle form */}
        <form onSubmit={handleCreate} className="px-6 py-4 border-b space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-2 gap-2 flex-1">
              <Input value={japanese} onChange={e => setJapanese(e.target.value)} placeholder="Japanese sentence *" required />
              <Input value={hint} onChange={e => setHint(e.target.value)} placeholder="Hint / explanation (optional)" />
            </div>
            <button
              type="button"
              onClick={() => setShowSourcePicker(true)}
              className="shrink-0 px-3 py-1.5 text-xs border border-brand/30 text-brand rounded-md hover:bg-brand-light transition-colors"
              title="Pick from grammar or vocabulary deck"
            >
              Source from Deck
            </button>
          </div>
          <PartsForm
            parts={parts}
            onChange={(i, f, v) => updatePart(i, f, v)}
            onAdd={addPart}
            onRemove={removePart}
          />
          <button type="submit" disabled={saving || !japanese.trim() || parts.filter(p => p.text.trim()).length < 2}
            className="px-4 py-1.5 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50">
            {saving ? 'Adding…' : '+ Add Puzzle'}
          </button>
        </form>

        {/* Puzzle list */}
        <div className="overflow-y-auto flex-1 px-6 py-3">
          {loading ? (
            <div className="space-y-2 py-4">{[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : puzzles.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No puzzles yet. Add one above.</p>
          ) : (
            <div className="space-y-2">
              {puzzles.map(p => (
                <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {editingId === p.id ? (
                    <div className="p-3 space-y-2 bg-gray-50">
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={editJapanese} onChange={e => setEditJapanese(e.target.value)} placeholder="Japanese sentence *" className="h-7 text-xs" />
                        <Input value={editHint} onChange={e => setEditHint(e.target.value)} placeholder="Hint" className="h-7 text-xs" />
                      </div>
                      <PartsForm
                        parts={editParts}
                        onChange={(i, f, v) => setEditParts(ps => ps.map((pt, idx) => idx === i ? { ...pt, [f]: v } : pt))}
                        onAdd={() => setEditParts(ps => [...ps, { text: '', label: 'Subject' }])}
                        onRemove={i => setEditParts(ps => ps.filter((_, idx) => idx !== i))}
                      />
                      <div className="flex gap-2">
                        <button onClick={handleEditSave} disabled={savingEdit} className="px-3 py-1 bg-brand text-white text-xs rounded-md disabled:opacity-50">
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-gray-900">{p.japanese_sentence}</p>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => startEdit(p)} className="text-xs text-gray-400 hover:text-brand transition-colors">Edit</button>
                          <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                            {deleting === p.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.parts.map((pt, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${LABEL_COLORS[pt.label] ?? LABEL_COLORS.Other}`}>
                            {pt.text}
                            <span className="opacity-60 ml-1">({pt.label})</span>
                          </span>
                        ))}
                      </div>
                      {p.hint && <p className="text-xs text-gray-400 italic mt-1">💡 {p.hint}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t text-xs text-gray-400 shrink-0">
          {puzzles.length} puzzle{puzzles.length !== 1 ? 's' : ''} in this deck
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export function PuzzleDeckManager({ studentId }: { studentId: string }) {
  const [decks, setDecks] = useState<PuzzleDeck[]>([])
  const [decksLoading, setDecksLoading] = useState(true)
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [editingDeck, setEditingDeck] = useState<PuzzleDeck | null>(null)
  const [creatingDeck, setCreatingDeck] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    const [{ decks: d }, ids] = await Promise.all([
      listPuzzleDecks(),
      getAssignedDeckIds(studentId),
    ])
    setDecks(d ?? [])
    setAssignedIds(new Set(ids))
    setDecksLoading(false)
  }

  useEffect(() => { load() }, [studentId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newDeckName.trim()) return
    const { deck, error } = await createPuzzleDeck(newDeckName.trim())
    if (error) { toast.error(error); return }
    setDecks(prev => [deck!, ...prev])
    setNewDeckName(''); setCreatingDeck(false)
    toast.success(`Deck "${deck!.name}" created`)
  }

  async function handleDelete(deckId: string, deckName: string) {
    if (!confirm(`Delete deck "${deckName}"? All puzzles inside will be removed.`)) return
    setDeleting(deckId)
    const { error } = await deletePuzzleDeck(deckId)
    setDeleting(null)
    if (error) toast.error(error)
    else { setDecks(prev => prev.filter(d => d.id !== deckId)); toast.success('Deck deleted') }
  }

  async function handleAssign(deckId: string) {
    setAssigning(deckId)
    const { error } = await assignPuzzleDeckToStudent(deckId, studentId)
    setAssigning(null)
    if (error) toast.error(error)
    else { setAssignedIds(prev => new Set([...prev, deckId])); toast.success('Deck assigned') }
  }

  async function handleRemove(deckId: string, deckName: string) {
    if (!confirm(`Remove deck "${deckName}" from this student?`)) return
    setRemoving(deckId)
    const { error } = await removePuzzleDeckFromStudent(deckId, studentId)
    setRemoving(null)
    if (error) toast.error(error)
    else { setAssignedIds(prev => { const s = new Set(prev); s.delete(deckId); return s }); toast.success('Deck removed') }
  }

  return (
    <>
      {editingDeck && (
        <PuzzleEditor
          deck={editingDeck}
          onClose={() => setEditingDeck(null)}
          onUpdated={load}
          onDelete={async (id, name) => { await handleDelete(id, name); setEditingDeck(null) }}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Train Puzzles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Puzzle Decks</span>
              {!creatingDeck && (
                <button onClick={() => setCreatingDeck(true)} className="text-xs text-brand hover:text-brand/80 transition-colors">
                  + New Deck
                </button>
              )}
            </div>

            {creatingDeck && (
              <form onSubmit={handleCreate} className="flex gap-2">
                <Input autoFocus value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="Deck name…" className="flex-1 text-sm h-8" />
                <button type="submit" disabled={!newDeckName.trim()} className="px-3 py-1 bg-brand text-white text-sm rounded-md disabled:opacity-50">Create</button>
                <button type="button" onClick={() => { setCreatingDeck(false); setNewDeckName('') }} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              </form>
            )}

            {decksLoading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />)}</div>
            ) : decks.length === 0 ? (
              <p className="text-xs text-gray-400">No puzzle decks yet. Create one to get started.</p>
            ) : (
              <div className="space-y-2">
                {decks.map(deck => {
                  const isAssigned = assignedIds.has(deck.id)
                  return (
                    <div key={deck.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900">{deck.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{deck.puzzle_count ?? 0} puzzles</span>
                        {isAssigned && <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Assigned</span>}
                      </div>
                      <button onClick={() => setEditingDeck(deck)} className="text-xs text-gray-400 hover:text-brand transition-colors">Edit</button>
                      {isAssigned ? (
                        <button onClick={() => handleRemove(deck.id, deck.name)} disabled={removing === deck.id} className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                          {removing === deck.id ? '…' : 'Remove'}
                        </button>
                      ) : (
                        <button onClick={() => handleAssign(deck.id)} disabled={assigning === deck.id} className="text-xs text-brand hover:text-brand/80 transition-colors disabled:opacity-50">
                          {assigning === deck.id ? '…' : 'Assign'}
                        </button>
                      )}
                      <button onClick={() => handleDelete(deck.id, deck.name)} disabled={deleting === deck.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                        {deleting === deck.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
