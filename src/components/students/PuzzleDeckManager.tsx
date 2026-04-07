import { useEffect, useState } from 'react'
import nlp from 'compromise'
import {
  listPuzzleDecks, createPuzzleDeck, deletePuzzleDeck, renamePuzzleDeck,
  getPuzzleDeckWithPuzzles, createPuzzle, deletePuzzle,
  assignPuzzleDeckToStudent, removePuzzleDeckFromStudent, getAssignedDeckIds,
  type PuzzleDeck, type Puzzle, type PuzzlePart,
} from '@/lib/api/puzzles'
import { listGrammarDecks, getGrammarDeckWithPoints, type GrammarDeck } from '@/lib/api/grammar'
import { listDecks, getDeckWithWords, type Deck } from '@/lib/api/lessons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

// ── Helpers ───────────────────────────────────────────────────

function stripHtml(html: string | null | undefined): string {
  return (html ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function sentenceToParts(sentence: string): PuzzlePart[] {
  return sentence
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(text => ({ text, label: 'Other' }))
}

function isJapanese(text: string): boolean {
  return /[\u3040-\u30FF\u4E00-\u9FFF]/.test(text)
}

function tagsToLabel(tags: Record<string, boolean>): string {
  if (tags.Pronoun) return 'Pronoun'
  if (tags.Verb || tags.Copula || tags.Auxiliary || tags.Modal) return 'Verb'
  if (tags.Adjective) return 'Adjective'
  if (tags.Adverb) return 'Adverb'
  if (tags.Preposition) return 'Preposition'
  if (tags.Conjunction) return 'Conjunction'
  if (tags.Noun || tags.ProperNoun) return 'Noun'
  return 'Other'
}

async function translateAndParse(
  text: string,
): Promise<{ english: string; parts: PuzzlePart[] }> {
  let english = text.trim()

  if (isJapanese(text)) {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ja|en`,
    )
    const json = await res.json()
    english = json.responseData?.translatedText ?? text
  }

  const doc = nlp(english)
  const terms = doc.terms().json() as Array<{ text: string; tags: Record<string, boolean> }>
  const parts: PuzzlePart[] = terms
    .map(t => ({ text: t.text.trim(), label: tagsToLabel(t.tags) }))
    .filter(p => p.text.length > 0)

  return { english, parts }
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

  // Source selection
  const [grammarDecks, setGrammarDecks] = useState<GrammarDeck[]>([])
  const [vocabDecks, setVocabDecks] = useState<Deck[]>([])
  const [selectedGrammar, setSelectedGrammar] = useState('')
  const [selectedVocab, setSelectedVocab] = useState('')
  const [generating, setGenerating] = useState(false)

  // Manual add
  const [manualSentence, setManualSentence] = useState('')
  const [manualHint, setManualHint] = useState('')
  const [addingManual, setAddingManual] = useState(false)
  const [translating, setTranslating] = useState(false)

  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!deck.puzzles) {
      getPuzzleDeckWithPuzzles(deck.id).then(({ deck: d }) => {
        setPuzzles(d?.puzzles ?? [])
        setLoading(false)
      })
    }
    // Load source deck options
    Promise.all([listGrammarDecks(), listDecks()]).then(([g, v]) => {
      setGrammarDecks(g.decks ?? [])
      setVocabDecks(v.decks ?? [])
    })
  }, [deck.id])

  async function handleSaveName() {
    if (!name.trim() || name.trim() === deck.name) { setRenamingName(false); return }
    await renamePuzzleDeck(deck.id, name.trim())
    deck.name = name.trim()
    onUpdated()
    setRenamingName(false)
  }

  async function handleGenerate() {
    if (!selectedGrammar && !selectedVocab) {
      toast.error('Pick at least one deck to generate from.')
      return
    }
    setGenerating(true)

    const sentences: { sentence: string; hint: string }[] = []

    // Collect from grammar deck
    if (selectedGrammar) {
      const { deck: gd } = await getGrammarDeckWithPoints(selectedGrammar)
      for (const pt of gd?.points ?? []) {
        for (const ex of pt.examples ?? []) {
          const s = ex.trim()
          if (s) sentences.push({ sentence: s, hint: pt.point })
        }
      }
    }

    // Collect from vocabulary deck
    if (selectedVocab) {
      const { deck: vd } = await getDeckWithWords(selectedVocab)
      for (const w of vd?.words ?? []) {
        const s = w.example?.trim() || stripHtml(w.definition_en) || stripHtml(w.definition_ja)
        if (s) sentences.push({ sentence: s, hint: w.word })
      }
    }

    if (sentences.length === 0) {
      toast.error('No example sentences found in the selected decks.')
      setGenerating(false)
      return
    }

    // Deduplicate against existing puzzles
    const existingSentences = new Set(puzzles.map(p => p.japanese_sentence.toLowerCase()))
    const toCreate = sentences.filter(s => !existingSentences.has(s.sentence.toLowerCase()))

    if (toCreate.length === 0) {
      toast.info('All sentences from those decks are already in this puzzle deck.')
      setGenerating(false)
      return
    }

    // Create puzzles — skip any sentence that splits into fewer than 2 parts
    let created = 0
    for (const { sentence, hint } of toCreate) {
      const parts = sentenceToParts(sentence)
      if (parts.length < 2) continue
      const { puzzle, error } = await createPuzzle(deck.id, {
        japanese_sentence: sentence,
        hint: hint || undefined,
        parts,
      })
      if (!error && puzzle) {
        setPuzzles(prev => [...prev, puzzle])
        created++
      }
    }

    setGenerating(false)
    onUpdated()
    if (created > 0) toast.success(`Generated ${created} puzzle${created !== 1 ? 's' : ''}`)
    else toast.error('No valid sentences found (need at least 2 words each).')
  }

  async function handleTranslateAndAdd() {
    const s = manualSentence.trim()
    if (!s) return
    setTranslating(true)
    try {
      const { english, parts } = await translateAndParse(s)
      if (parts.length < 2) { toast.error('Need at least 2 words after translation.'); return }
      const { puzzle, error } = await createPuzzle(deck.id, {
        japanese_sentence: isJapanese(s) ? s : english,
        hint: manualHint.trim() || (isJapanese(s) ? english : undefined),
        parts,
      })
      if (error) { toast.error(error); return }
      setPuzzles(prev => [...prev, puzzle!])
      setManualSentence(''); setManualHint('')
      onUpdated()
      toast.success(`Added: "${english}" (${parts.length} parts)`)
    } catch {
      toast.error('Translation failed. Check your connection.')
    } finally {
      setTranslating(false)
    }
  }

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault()
    const s = manualSentence.trim()
    if (!s) return
    const parts = sentenceToParts(s)
    if (parts.length < 2) { toast.error('Need at least 2 words.'); return }
    setAddingManual(true)
    const { puzzle, error } = await createPuzzle(deck.id, {
      japanese_sentence: s,
      hint: manualHint.trim() || undefined,
      parts,
    })
    setAddingManual(false)
    if (error) { toast.error(error); return }
    setPuzzles(prev => [...prev, puzzle!])
    setManualSentence(''); setManualHint('')
    onUpdated()
  }

  async function handleDelete(puzzleId: string) {
    setDeleting(puzzleId)
    const { error } = await deletePuzzle(puzzleId)
    setDeleting(null)
    if (error) toast.error(error)
    else { setPuzzles(prev => prev.filter(p => p.id !== puzzleId)); onUpdated() }
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

        {/* Auto-generate section */}
        <div className="px-6 py-4 border-b space-y-3 shrink-0 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Auto-generate puzzles from decks</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Grammar deck</label>
              <select
                value={selectedGrammar}
                onChange={e => setSelectedGrammar(e.target.value)}
                className="w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white"
              >
                <option value="">— none —</option>
                {grammarDecks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Vocabulary deck</label>
              <select
                value={selectedVocab}
                onChange={e => setSelectedVocab(e.target.value)}
                className="w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white"
              >
                <option value="">— none —</option>
                {vocabDecks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || (!selectedGrammar && !selectedVocab)}
            className="px-4 py-1.5 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating…' : '⚡ Generate Puzzles'}
          </button>
        </div>

        {/* Manual add with auto-translation */}
        <div className="px-6 py-3 border-b shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={manualSentence}
              onChange={e => setManualSentence(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleTranslateAndAdd() }}
              placeholder="Type Japanese or English sentence…"
              className="flex-1 h-8 text-sm"
            />
            <Input
              value={manualHint}
              onChange={e => setManualHint(e.target.value)}
              placeholder="Hint (optional)"
              className="w-36 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTranslateAndAdd}
              disabled={translating || !manualSentence.trim()}
              className="px-3 py-1.5 text-sm bg-brand text-white rounded-md disabled:opacity-50 whitespace-nowrap"
            >
              {translating ? 'Translating…' : isJapanese(manualSentence) ? '🔤 Translate & Add' : '+ Add with POS tags'}
            </button>
            <span className="text-xs text-gray-400">
              {isJapanese(manualSentence)
                ? 'Will translate to English and tag parts of speech'
                : 'Parts of speech tagged automatically'}
            </span>
          </div>
        </div>

        {/* Puzzle list */}
        <div className="overflow-y-auto flex-1 px-6 py-3">
          {loading ? (
            <div className="space-y-2 py-4">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : puzzles.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No puzzles yet. Generate from decks above or add one manually.</p>
          ) : (
            <div className="space-y-1.5">
              {puzzles.map(p => (
                <div key={p.id} className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg border border-gray-100 hover:border-gray-200 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{p.japanese_sentence}</p>
                    {p.hint && <p className="text-xs text-gray-400 italic mt-0.5">💡 {p.hint}</p>}
                    <p className="text-xs text-gray-300 mt-0.5">{p.parts.length} parts</p>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                    className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0 mt-0.5"
                  >
                    {deleting === p.id ? '…' : 'Delete'}
                  </button>
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
