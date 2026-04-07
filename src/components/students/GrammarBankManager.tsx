import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  listGrammar,
  deleteGrammarEntry,
  listGrammarDecks,
  createGrammarDeck,
  deleteGrammarDeck,
  renameGrammarDeck,
  getGrammarDeckWithPoints,
  addPointToDeck,
  updateGrammarDeckPoint,
  removePointFromDeck,
  assignGrammarDeckToStudent,
  removeGrammarDeckFromStudent,
  type GrammarBankEntry,
  type GrammarDeck,
  type GrammarDeckPoint,
} from '@/lib/api/grammar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const MASTERY_COLORS = [
  'bg-gray-100 text-gray-500',
  'bg-yellow-100 text-yellow-700',
  'bg-brand-light text-brand-dark',
  'bg-green-100 text-green-700',
]
const MASTERY_LABELS = ['New', 'Seen', 'Familiar', 'Mastered']

// Render a sentence with _____ highlighted
function SentenceWithBlank({ sentence }: { sentence: string }) {
  const parts = sentence.split('_____')
  if (parts.length === 1) return <span>{sentence}</span>
  return (
    <span>
      {parts[0]}
      <span className="inline-block bg-brand-light text-brand-dark font-semibold px-1 rounded mx-0.5">_____</span>
      {parts[1]}
    </span>
  )
}

// ── Deck Editor Modal ─────────────────────────────────────────
function DeckEditor({
  deck,
  onClose,
  onUpdated,
  onDelete,
}: {
  deck: GrammarDeck
  onClose: () => void
  onUpdated: () => void
  onDelete: (deckId: string, deckName: string) => Promise<void>
}) {
  const [points, setPoints] = useState<GrammarDeckPoint[]>(deck.points ?? [])
  const [loading, setLoading] = useState(!deck.points)
  const [name, setName] = useState(deck.name)
  const [renamingName, setRenamingName] = useState(false)

  // Add form
  const [addSentence, setAddSentence] = useState('')
  const [addAnswer, setAddAnswer] = useState('')
  const [addHint, setAddHint] = useState('')
  const [addDistractors, setAddDistractors] = useState('')
  const [saving, setSaving] = useState(false)
  const addSentenceRef = useRef<HTMLInputElement>(null)
  const editSentenceRef = useRef<HTMLInputElement>(null)

  function insertBlank(
    ref: React.RefObject<HTMLInputElement | null>,
    value: string,
    setter: (v: string) => void,
  ) {
    const el = ref.current
    if (!el) { setter(value + '_____'); return }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + '_____' + value.slice(end)
    setter(next)
    // Restore cursor after the inserted blank
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + 5, start + 5)
    })
  }

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({ sentence: '', answer: '', hint: '', distractors: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    if (!deck.points) {
      getGrammarDeckWithPoints(deck.id).then(({ deck: d }) => {
        if (d?.points) setPoints(d.points)
        setLoading(false)
      })
    }
  }, [deck.id])

  async function handleSaveName() {
    if (!name.trim() || name.trim() === deck.name) { setRenamingName(false); return }
    await renameGrammarDeck(deck.id, name.trim())
    deck.name = name.trim()
    onUpdated()
    setRenamingName(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const sentence = addSentence.trim()
    const answer = addAnswer.trim()
    if (!sentence || !answer) return
    if (!sentence.includes('_____')) {
      toast.error('Sentence must contain _____ to mark the blank.')
      return
    }
    const distractors = addDistractors.split(',').map(s => s.trim()).filter(Boolean)
    setSaving(true)
    const { error } = await addPointToDeck(deck.id, {
      point: sentence, // sentence acts as the unique key
      explanation: answer,
      sentence_with_blank: sentence,
      answer,
      hint_ja: addHint.trim() || undefined,
      distractors,
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    const { deck: refreshed } = await getGrammarDeckWithPoints(deck.id)
    setPoints(refreshed?.points ?? points)
    setAddSentence(''); setAddAnswer(''); setAddHint(''); setAddDistractors('')
    onUpdated()
  }

  function startEdit(p: GrammarDeckPoint) {
    setEditingId(p.id)
    setEditFields({
      sentence: p.sentence_with_blank ?? p.point,
      answer: p.answer ?? p.explanation,
      hint: p.hint_ja ?? '',
      distractors: (p.distractors ?? []).join(', '),
    })
  }

  async function handleEditSave() {
    if (!editingId) return
    const sentence = editFields.sentence.trim()
    const answer = editFields.answer.trim()
    if (!sentence || !answer) return
    const distractors = editFields.distractors.split(',').map(s => s.trim()).filter(Boolean)
    setSavingEdit(true)
    const { error } = await updateGrammarDeckPoint(editingId, {
      point: sentence,
      explanation: answer,
      sentence_with_blank: sentence,
      answer,
      hint_ja: editFields.hint.trim() || undefined,
      distractors,
    })
    setSavingEdit(false)
    if (error) { toast.error(error); return }
    setPoints(prev => prev.map(p => p.id === editingId ? {
      ...p,
      point: sentence,
      explanation: answer,
      sentence_with_blank: sentence,
      answer,
      hint_ja: editFields.hint.trim() || null,
      distractors,
    } : p))
    setEditingId(null)
    onUpdated()
  }

  async function handleRemove(pointId: string) {
    setRemoving(pointId)
    const { error } = await removePointFromDeck(pointId)
    setRemoving(null)
    if (error) toast.error(error)
    else { setPoints(prev => prev.filter(p => p.id !== pointId)); onUpdated() }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit grammar deck" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          {renamingName ? (
            <input
              autoFocus value={name}
              onChange={e => setName(e.target.value)}
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
            <button onClick={async () => { await onDelete(deck.id, name); onClose() }} className="text-xs text-gray-300 hover:text-red-500 transition-colors">Delete deck</button>
            <button aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="px-6 py-4 border-b space-y-2 shrink-0 bg-gray-50">
          <div className="flex items-center gap-2">
            <Input
              ref={addSentenceRef}
              value={addSentence}
              onChange={e => setAddSentence(e.target.value)}
              placeholder='Sentence * e.g. "There _____ a park."'
              className="flex-1"
              required
            />
            <button
              type="button"
              onClick={() => insertBlank(addSentenceRef, addSentence, setAddSentence)}
              title="Insert blank (_____)"
              className="shrink-0 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors font-mono text-gray-600 hover:text-brand"
            >
              _____
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={addAnswer} onChange={e => setAddAnswer(e.target.value)} placeholder="Answer * e.g. is" required />
            <Input value={addHint} onChange={e => setAddHint(e.target.value)} placeholder="Japanese hint e.g. 「単数」です" />
          </div>
          <Input
            value={addDistractors}
            onChange={e => setAddDistractors(e.target.value)}
            placeholder="Wrong choices (comma-separated) e.g. am, are, were"
          />
          <button type="submit" disabled={saving || !addSentence.trim() || !addAnswer.trim()} className="px-4 py-1.5 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50">
            {saving ? 'Adding…' : '+ Add Question'}
          </button>
        </form>

        {/* Point list */}
        <div className="overflow-y-auto flex-1 px-6 py-3">
          {loading ? (
            <div className="space-y-2 py-4">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : points.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No questions yet. Add some above.</p>
          ) : (
            <div className="space-y-1">
              {points.map(p => (
                <div key={p.id} className="border-b border-gray-100 last:border-0">
                  {editingId === p.id ? (
                    <div className="py-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Input ref={editSentenceRef} value={editFields.sentence} onChange={e => setEditFields(f => ({ ...f, sentence: e.target.value }))} placeholder='Sentence with blank *' className="h-7 text-xs flex-1" />
                        <button type="button" onClick={() => insertBlank(editSentenceRef, editFields.sentence, v => setEditFields(f => ({ ...f, sentence: v })))} title="Insert blank" className="shrink-0 px-2 h-7 text-xs border border-gray-300 rounded hover:bg-gray-100 font-mono text-gray-500 hover:text-brand transition-colors">_____</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={editFields.answer} onChange={e => setEditFields(f => ({ ...f, answer: e.target.value }))} placeholder="Answer *" className="h-7 text-xs" />
                        <Input value={editFields.hint} onChange={e => setEditFields(f => ({ ...f, hint: e.target.value }))} placeholder="Japanese hint" className="h-7 text-xs" />
                      </div>
                      <Input value={editFields.distractors} onChange={e => setEditFields(f => ({ ...f, distractors: e.target.value }))} placeholder="Wrong choices, comma-separated" className="h-7 text-xs" />
                      <div className="flex gap-2">
                        <button onClick={handleEditSave} disabled={savingEdit} className="px-3 py-1 bg-brand text-white text-xs rounded-md disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save'}</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <SentenceWithBlank sentence={p.sentence_with_blank ?? p.point} />
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                            ✓ {p.answer ?? p.explanation}
                          </span>
                          {p.hint_ja && <span className="text-xs text-gray-500">{p.hint_ja}</span>}
                          {(p.distractors ?? []).length > 0 && (
                            <span className="text-xs text-gray-400">
                              wrong: {p.distractors!.join(' | ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => startEdit(p)} className="text-xs text-gray-400 hover:text-brand transition-colors">Edit</button>
                        <button onClick={() => handleRemove(p.id)} disabled={removing === p.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                          {removing === p.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t text-xs text-gray-400 shrink-0">
          {points.length} question{points.length !== 1 ? 's' : ''} in this deck
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export function GrammarBankManager({ studentId }: { studentId: string }) {
  const [entries, setEntries] = useState<GrammarBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [decks, setDecks] = useState<GrammarDeck[]>([])
  const [decksLoading, setDecksLoading] = useState(true)
  const [editingDeck, setEditingDeck] = useState<GrammarDeck | null>(null)
  const [creatingDeck, setCreatingDeck] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)
  const [removingDeck, setRemovingDeck] = useState<string | null>(null)
  const [deletingDeck, setDeletingDeck] = useState<string | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null)

  async function loadEntries() {
    const { entries: e } = await listGrammar(studentId)
    setEntries(e ?? [])
    setLoading(false)
  }

  async function loadDecks() {
    const { decks: d } = await listGrammarDecks()
    setDecks(d ?? [])
    setDecksLoading(false)
  }

  useEffect(() => { loadEntries() }, [studentId])
  useEffect(() => { loadDecks() }, [])

  const assignedDeckIds = new Set(entries.map(e => e.deck_id).filter(Boolean) as string[])

  async function handleCreateDeck(ev: React.FormEvent) {
    ev.preventDefault()
    if (!newDeckName.trim()) return
    const { deck, error } = await createGrammarDeck(newDeckName.trim())
    if (error) { toast.error(error); return }
    setDecks(prev => [deck!, ...prev])
    setNewDeckName('')
    setCreatingDeck(false)
    toast.success(`Deck "${deck!.name}" created`)
  }

  async function handleDeleteDeck(deckId: string, deckName: string) {
    if (!confirm(`Delete deck "${deckName}"? This will remove these grammar points from every student it was assigned to.`)) return
    setDeletingDeck(deckId)
    const { error } = await deleteGrammarDeck(deckId)
    setDeletingDeck(null)
    if (error) toast.error(error)
    else {
      setDecks(prev => prev.filter(d => d.id !== deckId))
      await loadEntries()
      toast.success('Deck deleted')
    }
  }

  async function handleAssign(deckId: string) {
    setAssigning(deckId)
    const { count, error } = await assignGrammarDeckToStudent(deckId, studentId)
    setAssigning(null)
    if (error) toast.error(error)
    else {
      toast.success(`${count} grammar point${count !== 1 ? 's' : ''} assigned`)
      loadEntries()
    }
  }

  async function handleRemoveDeck(deckId: string, deckName: string) {
    if (!confirm(`Remove all points from deck "${deckName}" from this student?`)) return
    setRemovingDeck(deckId)
    const { error } = await removeGrammarDeckFromStudent(deckId, studentId)
    setRemovingDeck(null)
    if (error) toast.error(error)
    else {
      toast.success(`Deck "${deckName}" removed from student`)
      loadEntries()
    }
  }

  async function handleDeleteEntry(id: string) {
    setDeletingEntry(id)
    const { error } = await deleteGrammarEntry(id)
    setDeletingEntry(null)
    if (error) toast.error(error)
    else setEntries(prev => prev.filter(e => e.id !== id))
  }

  // Group by deck
  const deckGroups: { deckId: string | null; deckName: string; items: GrammarBankEntry[] }[] = []
  const seen = new Set<string | null>()
  for (const e of entries) {
    const dId = e.deck_id ?? null
    if (!seen.has(dId)) {
      seen.add(dId)
      const deckName = dId ? (decks.find(d => d.id === dId)?.name ?? 'Assigned Deck') : 'Ungrouped'
      deckGroups.push({ deckId: dId, deckName, items: [] })
    }
    deckGroups.find(g => g.deckId === dId)!.items.push(e)
  }

  return (
    <>
      {editingDeck && (
        <DeckEditor
          deck={editingDeck}
          onClose={() => setEditingDeck(null)}
          onUpdated={() => { loadDecks(); loadEntries() }}
          onDelete={async (id, name) => { await handleDeleteDeck(id, name); setEditingDeck(null) }}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Grammar Bank
            {!loading && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {entries.length} point{entries.length !== 1 ? 's' : ''}
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Deck Library */}
          <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Decks</span>
              {!creatingDeck && (
                <button onClick={() => setCreatingDeck(true)} className="text-xs text-brand hover:text-brand/80 transition-colors">
                  + New Deck
                </button>
              )}
            </div>

            {creatingDeck && (
              <form onSubmit={handleCreateDeck} className="flex gap-2">
                <Input autoFocus value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="Deck name…" className="flex-1 text-sm h-8" />
                <button type="submit" disabled={!newDeckName.trim()} className="px-3 py-1 bg-brand text-white text-sm rounded-md disabled:opacity-50">Create</button>
                <button type="button" onClick={() => { setCreatingDeck(false); setNewDeckName('') }} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              </form>
            )}

            {decksLoading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />)}</div>
            ) : decks.length === 0 ? (
              <p className="text-xs text-gray-400">No decks yet. Create one to get started.</p>
            ) : (
              <div className="space-y-2">
                {decks.map(deck => {
                  const isAssigned = assignedDeckIds.has(deck.id)
                  return (
                    <div key={deck.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900">{deck.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{deck.point_count ?? 0} points</span>
                        {isAssigned && <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Assigned</span>}
                      </div>
                      <button onClick={() => setEditingDeck(deck)} className="text-xs text-gray-400 hover:text-brand transition-colors">Edit</button>
                      {isAssigned ? (
                        <button onClick={() => handleRemoveDeck(deck.id, deck.name)} disabled={removingDeck === deck.id} className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                          {removingDeck === deck.id ? '…' : 'Remove'}
                        </button>
                      ) : (
                        <button onClick={() => handleAssign(deck.id)} disabled={assigning === deck.id} className="text-xs text-brand hover:text-brand/80 transition-colors disabled:opacity-50">
                          {assigning === deck.id ? '…' : 'Assign'}
                        </button>
                      )}
                      <button onClick={() => handleDeleteDeck(deck.id, deck.name)} disabled={deletingDeck === deck.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                        {deletingDeck === deck.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Entry list grouped by deck */}
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-400">No grammar points assigned yet. Create a deck, add points, then assign it to this student.</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {deckGroups.map(({ deckId, deckName, items }) => (
                <div key={deckId ?? '__ungrouped__'}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {deckName} <span className="font-normal">({items.length})</span>
                    </span>
                    {deckId && (
                      <button onClick={() => handleRemoveDeck(deckId, deckName)} disabled={removingDeck === deckId} className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                        {removingDeck === deckId ? '…' : 'Remove deck'}
                      </button>
                    )}
                  </div>
                  {items.map(e => (
                    <div key={e.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">
                            <SentenceWithBlank sentence={e.sentence_with_blank ?? e.point} />
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${MASTERY_COLORS[e.mastery_level]}`}>
                            {MASTERY_LABELS[e.mastery_level]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                            ✓ {e.answer ?? e.explanation}
                          </span>
                          {e.hint_ja && <span className="text-xs text-gray-400">{e.hint_ja}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteEntry(e.id)} disabled={deletingEntry === e.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50">
                        {deletingEntry === e.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
