import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  addVocabularyToBank,
  deleteVocabEntry,
  uploadVocabImage,
  removeVocabImage,
  listDecks,
  createDeck,
  deleteDeck,
  renameDeck,
  getDeckWithWords,
  addWordToDeck,
  removeWordFromDeck,
  assignDeckToStudent,
  removeDeckFromStudent,
  type Deck,
  type DeckWord,
} from '@/lib/api/lessons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnkiImporter } from './AnkiImporter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { VocabularyBankEntry } from '@/lib/types/database'

const MASTERY_COLORS = [
  'bg-gray-100 text-gray-500',
  'bg-yellow-100 text-yellow-700',
  'bg-brand-light text-brand-dark',
  'bg-green-100 text-green-700',
]
const MASTERY_LABELS = ['New', 'Seen', 'Familiar', 'Mastered']

interface Props {
  studentId: string
}

// ── Deck Editor Modal ─────────────────────────────────────────
function DeckEditor({
  deck,
  onClose,
  onUpdated,
  onDelete,
}: {
  deck: Deck
  onClose: () => void
  onUpdated: () => void
  onDelete: (deckId: string, deckName: string) => Promise<void>
}) {
  const [words, setWords] = useState<DeckWord[]>(deck.words ?? [])
  const [word, setWord] = useState('')
  const [defJa, setDefJa] = useState('')
  const [defEn, setDefEn] = useState('')
  const [example, setExample] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [loading, setLoading] = useState(!deck.words)
  const [name, setName] = useState(deck.name)
  const [renamingName, setRenamingName] = useState(false)

  useEffect(() => {
    if (!deck.words) {
      getDeckWithWords(deck.id).then(({ deck: d }) => {
        if (d?.words) setWords(d.words)
        setLoading(false)
      })
    }
  }, [deck.id])

  async function handleSaveName() {
    if (!name.trim() || name.trim() === deck.name) { setRenamingName(false); return }
    await renameDeck(deck.id, name.trim())
    deck.name = name.trim()
    onUpdated()
    setRenamingName(false)
  }

  async function handleAddWord(e: React.FormEvent) {
    e.preventDefault()
    if (!word.trim() || !defJa.trim()) return
    setSaving(true)
    const { error } = await addWordToDeck(deck.id, {
      word: word.trim(),
      definition_ja: defJa.trim(),
      definition_en: defEn.trim() || undefined,
      example: example.trim() || undefined,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
    } else {
      const { deck: refreshed } = await getDeckWithWords(deck.id)
      setWords(refreshed?.words ?? words)
      setWord(''); setDefJa(''); setDefEn(''); setExample('')
      onUpdated()
    }
  }

  async function handleRemoveWord(wordId: string) {
    setRemoving(wordId)
    const { error } = await removeWordFromDeck(wordId)
    setRemoving(null)
    if (error) toast.error(error)
    else { setWords(prev => prev.filter(w => w.id !== wordId)); onUpdated() }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          {renamingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setRenamingName(false) }}
                className="text-lg font-semibold border-b-2 border-brand outline-none flex-1"
              />
            </div>
          ) : (
            <button
              onClick={() => setRenamingName(true)}
              className="text-lg font-semibold text-gray-900 hover:text-brand transition-colors text-left"
              title="Click to rename"
            >
              {name}
              <span className="ml-2 text-xs text-gray-400 font-normal">✏️</span>
            </button>
          )}
          <div className="flex items-center gap-3 ml-4">
            <button
              onClick={async () => { await onDelete(deck.id, name); onClose() }}
              className="text-xs text-gray-300 hover:text-red-500 transition-colors"
              title="Delete this deck"
            >
              Delete deck
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        {/* Add word form */}
        <form onSubmit={handleAddWord} className="px-6 py-4 border-b space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Input value={word} onChange={e => setWord(e.target.value)} placeholder="Word *" required />
            <Input value={defJa} onChange={e => setDefJa(e.target.value)} placeholder="意味 (JA) *" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={defEn} onChange={e => setDefEn(e.target.value)} placeholder="Definition (EN)" />
            <Input value={example} onChange={e => setExample(e.target.value)} placeholder="Example sentence" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || !word.trim() || !defJa.trim()}
              className="px-4 py-1.5 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding…' : '+ Add Word'}
            </button>
            <AnkiImporter deckId={deck.id} onImported={async () => {
              const { deck: refreshed } = await getDeckWithWords(deck.id)
              if (refreshed?.words) setWords(refreshed.words)
              onUpdated()
            }} />
          </div>
        </form>

        {/* Word list */}
        <div className="overflow-y-auto flex-1 px-6 py-3">
          {loading ? (
            <div className="space-y-2 py-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : words.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No words yet. Add some above.</p>
          ) : (
            <div className="space-y-1">
              {words.map(w => (
                <div key={w.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-gray-900">{w.word}</span>
                    {w.reading && <span className="text-xs text-gray-400 ml-2">{w.reading}</span>}
                    {w.definition_ja && <p className="text-xs text-gray-700 mt-0.5">{w.definition_ja}</p>}
                    {w.definition_en && <p className="text-xs text-gray-400">{w.definition_en}</p>}
                    {w.example && <p className="text-xs text-gray-400 italic">"{w.example}"</p>}
                  </div>
                  <button
                    onClick={() => handleRemoveWord(w.id)}
                    disabled={removing === w.id}
                    className="text-xs text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {removing === w.id ? '…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t text-xs text-gray-400">
          {words.length} word{words.length !== 1 ? 's' : ''} in this deck
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export function StudentVocabManager({ studentId }: Props) {
  const [vocab, setVocab] = useState<VocabularyBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [decks, setDecks] = useState<Deck[]>([])
  const [decksLoading, setDecksLoading] = useState(true)
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null)
  const [creatingDeck, setCreatingDeck] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deletingVocab, setDeletingVocab] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)
  const [removingImage, setRemovingImage] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [imageTargetId, setImageTargetId] = useState<string | null>(null)
  const [showDecks, setShowDecks] = useState(false)

  // Add word form state
  const [word, setWord] = useState('')
  const [defJa, setDefJa] = useState('')
  const [defEn, setDefEn] = useState('')
  const [example, setExample] = useState('')
  const [selectedDeckId, setSelectedDeckId] = useState<string>('')

  async function loadVocab() {
    const { data, error } = await supabase
      .from('vocabulary_bank')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    if (error) console.error('VocabManager load error:', error.message)
    setVocab(data ?? [])
    setLoading(false)
  }

  async function loadDecks() {
    const { decks: d } = await listDecks()
    setDecks(d ?? [])
    setDecksLoading(false)
  }

  useEffect(() => { loadVocab() }, [studentId])
  useEffect(() => { loadDecks() }, [])

  // IDs of decks already assigned to this student
  const assignedDeckIds = new Set(vocab.map(v => v.deck_id).filter(Boolean) as string[])

  async function handleCreateDeck(e: React.FormEvent) {
    e.preventDefault()
    if (!newDeckName.trim()) return
    const { deck, error } = await createDeck(newDeckName.trim())
    if (error) { toast.error(error); return }
    setDecks(prev => [deck!, ...prev])
    setNewDeckName('')
    setCreatingDeck(false)
    toast.success(`Deck "${deck!.name}" created`)
  }

  async function handleDeleteDeck(deckId: string, deckName: string) {
    if (!confirm(`Delete deck "${deckName}"? This removes the deck template but does NOT remove words already assigned to students.`)) return
    setDeleting(deckId)
    const { error } = await deleteDeck(deckId)
    setDeleting(null)
    if (error) toast.error(error)
    else {
      setDecks(prev => prev.filter(d => d.id !== deckId))
      toast.success('Deck deleted')
    }
  }

  async function handleAssign(deckId: string) {
    setAssigning(deckId)
    const { count, error } = await assignDeckToStudent(deckId, studentId)
    setAssigning(null)
    if (error) toast.error(error)
    else {
      toast.success(`${count} word${count !== 1 ? 's' : ''} assigned from deck`)
      loadVocab()
    }
  }

  async function handleRemoveDeck(deckId: string, deckName: string) {
    if (!confirm(`Remove all words from deck "${deckName}" from this student's vocabulary bank?`)) return
    setRemoving(deckId)
    const { error } = await removeDeckFromStudent(deckId, studentId)
    setRemoving(null)
    if (error) toast.error(error)
    else {
      toast.success(`Deck "${deckName}" removed from student`)
      loadVocab()
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!word.trim() || !defJa.trim()) return
    setSaving(true)
    const result = await addVocabularyToBank([{
      student_id: studentId,
      word: word.trim(),
      definition_ja: defJa.trim(),
      definition_en: defEn.trim() || undefined,
      example: example.trim() || undefined,
    }])
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setWord(''); setDefJa(''); setDefEn(''); setExample('')
      await loadVocab()
      toast.success(`"${word.trim()}" added to vocab bank`)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !imageTargetId) return
    e.target.value = ''
    setUploadingImage(imageTargetId)
    const { url, error } = await uploadVocabImage(imageTargetId, file)
    setUploadingImage(null)
    setImageTargetId(null)
    if (error) toast.error(error)
    else setVocab(prev => prev.map(v => v.id === imageTargetId ? { ...v, image_url: url ?? null } : v))
  }

  function triggerImageUpload(entryId: string) {
    setImageTargetId(entryId)
    imageInputRef.current?.click()
  }

  async function handleRemoveImage(entryId: string) {
    setRemovingImage(entryId)
    const { error } = await removeVocabImage(entryId)
    setRemovingImage(null)
    if (error) toast.error(error)
    else setVocab(prev => prev.map(v => v.id === entryId ? { ...v, image_url: null } : v))
  }

  async function handleDeleteVocab(id: string) {
    setDeletingVocab(id)
    const { error } = await deleteVocabEntry(id)
    setDeletingVocab(null)
    if (error) toast.error(error)
    else setVocab(prev => prev.filter(v => v.id !== id))
  }

  // Group vocab by deck
  const deckGroups: { deckId: string | null; deckName: string; words: VocabularyBankEntry[] }[] = []
  const seenDeckIds = new Set<string | null>()
  for (const v of vocab) {
    const dId = v.deck_id ?? null
    if (!seenDeckIds.has(dId)) {
      seenDeckIds.add(dId)
      const deckName = dId ? (decks.find(d => d.id === dId)?.name ?? 'Assigned Deck') : 'Individual Words'
      deckGroups.push({ deckId: dId, deckName, words: [] })
    }
    deckGroups.find(g => g.deckId === dId)!.words.push(v)
  }

  function VocabRow({ v }: { v: VocabularyBankEntry }) {
    return (
      <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{v.word}</span>
            {v.reading && <span className="text-xs text-gray-400">{v.reading}</span>}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${MASTERY_COLORS[v.mastery_level]}`}>
              {MASTERY_LABELS[v.mastery_level]}
            </span>
          </div>
          {v.definition_ja && <p className="text-xs text-gray-800 mt-0.5" dangerouslySetInnerHTML={{ __html: v.definition_ja }} />}
          {v.definition_en && <p className="text-xs text-gray-400" dangerouslySetInnerHTML={{ __html: v.definition_en }} />}
          {v.example && <p className="text-xs text-gray-400 italic" dangerouslySetInnerHTML={{ __html: `"${v.example}"` }} />}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={() => handleDeleteVocab(v.id)}
            disabled={deletingVocab === v.id}
            className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {deletingVocab === v.id ? '…' : 'Remove'}
          </button>
          {v.image_url ? (
            <button
              onClick={() => handleRemoveImage(v.id)}
              disabled={removingImage === v.id}
              className="text-xs text-brand hover:text-red-500 transition-colors disabled:opacity-50"
            >
              {removingImage === v.id ? '…' : '🖼 Remove img'}
            </button>
          ) : (
            <button
              onClick={() => triggerImageUpload(v.id)}
              disabled={uploadingImage === v.id}
              className="text-xs text-gray-400 hover:text-brand transition-colors disabled:opacity-50"
            >
              {uploadingImage === v.id ? 'Uploading…' : '+ Image'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {editingDeck && (
        <DeckEditor
          deck={editingDeck}
          onClose={() => setEditingDeck(null)}
          onUpdated={() => { loadDecks(); loadVocab() }}
          onDelete={async (id, name) => { await handleDeleteDeck(id, name); setEditingDeck(null) }}
        />
      )}

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              Vocabulary Bank
              {!loading && (
                <span className="ml-2 text-xs font-normal text-gray-400">{vocab.length} word{vocab.length !== 1 ? 's' : ''}</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDecks(s => !s)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Decks {decksLoading ? '' : `(${decks.length})`}
              </button>
              <AnkiImporter studentId={studentId} onImported={loadVocab} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Deck Library Panel ── */}
          {showDecks && (
            <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Deck Library</span>
                {!creatingDeck && (
                  <button
                    onClick={() => setCreatingDeck(true)}
                    className="text-xs text-brand hover:text-brand/80 transition-colors"
                  >
                    + New Deck
                  </button>
                )}
              </div>

              {creatingDeck && (
                <form onSubmit={handleCreateDeck} className="flex gap-2">
                  <Input
                    autoFocus
                    value={newDeckName}
                    onChange={e => setNewDeckName(e.target.value)}
                    placeholder="Deck name…"
                    className="flex-1 text-sm h-8"
                  />
                  <button type="submit" disabled={!newDeckName.trim()} className="px-3 py-1 bg-brand text-white text-sm rounded-md disabled:opacity-50">
                    Create
                  </button>
                  <button type="button" onClick={() => { setCreatingDeck(false); setNewDeckName('') }} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">
                    Cancel
                  </button>
                </form>
              )}

              {decksLoading ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />)}
                </div>
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
                          <span className="text-xs text-gray-400 ml-2">{deck.word_count ?? 0} words</span>
                          {isAssigned && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Assigned</span>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingDeck(deck)}
                          className="text-xs text-gray-400 hover:text-brand transition-colors"
                        >
                          Edit
                        </button>
                        {isAssigned ? (
                          <button
                            onClick={() => handleRemoveDeck(deck.id, deck.name)}
                            disabled={removing === deck.id}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            {removing === deck.id ? '…' : 'Remove'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAssign(deck.id)}
                            disabled={assigning === deck.id}
                            className="text-xs text-brand hover:text-brand/80 transition-colors disabled:opacity-50"
                          >
                            {assigning === deck.id ? '…' : 'Assign'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDeck(deck.id, deck.name)}
                          disabled={deleting === deck.id}
                          className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          {deleting === deck.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Add Word Form ── */}
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input value={word} onChange={e => setWord(e.target.value)} placeholder="Word *" required />
              <Input value={defJa} onChange={e => setDefJa(e.target.value)} placeholder="意味 (JA) *" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={defEn} onChange={e => setDefEn(e.target.value)} placeholder="Definition (EN)" />
              <Input value={example} onChange={e => setExample(e.target.value)} placeholder="Example sentence" />
            </div>
            <button
              type="submit"
              disabled={saving || !word.trim() || !defJa.trim()}
              className="px-4 py-1.5 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding…' : '+ Add Word'}
            </button>
          </form>

          {/* ── Word List (grouped by deck) ── */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : vocab.length === 0 ? (
            <p className="text-sm text-gray-400">No vocabulary added yet.</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {deckGroups.map(({ deckId, deckName, words }) => (
                <div key={deckId ?? '__ungrouped__'}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {deckName} <span className="font-normal">({words.length})</span>
                    </span>
                    {deckId && (
                      <button
                        onClick={() => handleRemoveDeck(deckId, deckName)}
                        disabled={removing === deckId}
                        className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {removing === deckId ? '…' : 'Remove deck'}
                      </button>
                    )}
                  </div>
                  {words.map(v => <VocabRow key={v.id} v={v} />)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
