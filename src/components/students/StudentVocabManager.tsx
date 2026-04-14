import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
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
  updateDeckWord,
  assignDeckToStudent,
  syncDeckToAllStudents,
  removeDeckFromStudent,
  reorderVocabDecks,
  type Deck,
  type DeckWord,
} from '@/lib/api/lessons'
import { SortableDeckList } from '@/components/shared/SortableDeckList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnkiImporter } from './AnkiImporter'
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
  studentId,
  onClose,
  onUpdated,
  onDelete,
}: {
  deck: Deck
  studentId: string
  onClose: () => void
  onUpdated: () => void
  onDelete: (deckId: string, deckName: string) => Promise<void>
}) {
  const [words, setWords] = useState<DeckWord[]>(deck.words ?? [])
  const [word, setWord] = useState('')
  const [defJa, setDefJa] = useState('')
  const [defEn, setDefEn] = useState('')
  const [example, setExample] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [loading, setLoading] = useState(!deck.words)
  const [editingWordId, setEditingWordId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({ word: '', reading: '', defJa: '', defEn: '', example: '', category: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [name, setName] = useState(deck.name)
  const [renamingName, setRenamingName] = useState(false)
  const [tab, setTab] = useState<'words' | 'quiz'>('words')
  const [suggestingCategories, setSuggestingCategories] = useState(false)

  // ── Quiz tab state — keyed by vocabulary_deck_words.id ───────
  const [generating, setGenerating] = useState(false)
  const [savingQuizId, setSavingQuizId] = useState<string | null>(null)
  const [regenId, setRegenId] = useState<string | null>(null)
  const [quizEdits, setQuizEdits] = useState<Record<string, { sentence: string; d0: string; d1: string; d2: string }>>({})

  // Initialise quizEdits whenever words load/change
  useEffect(() => {
    const init: typeof quizEdits = {}
    for (const w of words) {
      if (!quizEdits[w.id]) {
        init[w.id] = {
          sentence: w.quiz_sentence ?? '',
          d0: w.quiz_distractors?.[0] ?? '',
          d1: w.quiz_distractors?.[1] ?? '',
          d2: w.quiz_distractors?.[2] ?? '',
        }
      }
    }
    if (Object.keys(init).length) setQuizEdits(prev => ({ ...init, ...prev }))
  }, [words])

  async function invokeQuiz(body: object) {
    const { data, error } = await supabase.functions.invoke('vocab-quiz-generate', { body })
    if (error) {
      let msg = error.message
      try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error } catch {}
      throw new Error(msg)
    }
    return data
  }

  /** Save quiz data to vocabulary_deck_words, then sync to all students' vocabulary_bank */
  async function persistQuiz(deckWordId: string, wordText: string, sentence: string, distractors: string[]) {
    await supabase.from('vocabulary_deck_words')
      .update({ quiz_sentence: sentence, quiz_distractors: distractors })
      .eq('id', deckWordId)
    await supabase.from('vocabulary_bank')
      .update({ quiz_sentence: sentence, quiz_distractors: distractors })
      .eq('deck_id', deck.id)
      .eq('word', wordText)
  }

  async function generateAll(targets: DeckWord[], wordPool?: DeckWord[]) {
    if (!targets.length) return
    setGenerating(true)
    try {
      const pool = wordPool ?? words
      const data = await invokeQuiz({
        words: targets.map(w => ({ word: w.word, definition_en: w.definition_en })),
        level: deck.name,
        wordPool: pool.map(w => ({ word: w.word })),
      })
      const raw: { word: string; sentence: string; distractors: string[] }[] = data.questions ?? []
      await Promise.all(raw.map(q => {
        const target = targets.find(w => w.word === q.word)
        if (!target) return
        return persistQuiz(target.id, target.word, q.sentence, q.distractors)
      }))
      // Update local words state
      setWords(prev => prev.map(w => {
        const q = raw.find(r => r.word === w.word)
        return q ? { ...w, quiz_sentence: q.sentence, quiz_distractors: q.distractors } : w
      }))
      setQuizEdits(prev => {
        const next = { ...prev }
        for (const q of raw) {
          const target = targets.find(w => w.word === q.word)
          if (target) next[target.id] = { sentence: q.sentence, d0: q.distractors[0] ?? '', d1: q.distractors[1] ?? '', d2: q.distractors[2] ?? '' }
        }
        return next
      })
    } catch (e: any) {
      toast.error(`Generation failed: ${e?.message ?? String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  async function regenOne(w: DeckWord) {
    setRegenId(w.id)
    try {
      const data = await invokeQuiz({
        words: [{ word: w.word, definition_en: w.definition_en }],
        level: deck.name,
        wordPool: words.map(x => ({ word: x.word })),
      })
      const q = (data.questions ?? [])[0]
      if (!q) throw new Error('No question returned')
      await persistQuiz(w.id, w.word, q.sentence, q.distractors)
      setWords(prev => prev.map(x => x.id === w.id ? { ...x, quiz_sentence: q.sentence, quiz_distractors: q.distractors } : x))
      setQuizEdits(prev => ({ ...prev, [w.id]: { sentence: q.sentence, d0: q.distractors[0] ?? '', d1: q.distractors[1] ?? '', d2: q.distractors[2] ?? '' } }))
    } catch (e: any) {
      toast.error(`Regeneration failed: ${e?.message ?? String(e)}`)
    } finally {
      setRegenId(null)
    }
  }

  async function saveQuizOne(w: DeckWord) {
    const e = quizEdits[w.id]
    if (!e) return
    setSavingQuizId(w.id)
    const distractors = [e.d0, e.d1, e.d2].filter(Boolean)
    await persistQuiz(w.id, w.word, e.sentence || '', distractors)
    setWords(prev => prev.map(x => x.id === w.id ? { ...x, quiz_sentence: e.sentence || null, quiz_distractors: distractors } : x))
    setSavingQuizId(null)
    toast.success('Saved')
  }

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

  async function handleSuggestCategories() {
    if (!words.length) { toast.info('No words to categorize'); return }
    setSuggestingCategories(true)
    try {
      const { data, error } = await supabase.functions.invoke('vocab-categorize', {
        body: {
          words: words.map(w => ({
            id: w.id,
            word: w.word,
            definition_en: w.definition_en,
            definition_ja: w.definition_ja,
            example: w.example,
          })),
        },
      })
      if (error) {
        let msg = error.message
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error } catch {}
        throw new Error(msg)
      }
      const categories: { id: string; category: string }[] = data.categories ?? []

      // Update vocabulary_deck_words (the source template)
      await Promise.all(categories.map(({ id, category }) =>
        supabase.from('vocabulary_deck_words').update({ category }).eq('id', id)
      ))

      // Sync to all students' vocabulary_bank entries for this deck
      const wordsById = new Map(words.map(w => [w.id, w]))
      await Promise.all(categories.map(({ id, category }) => {
        const w = wordsById.get(id)
        if (!w) return Promise.resolve()
        return supabase.from('vocabulary_bank').update({ category }).eq('deck_id', deck.id).eq('word', w.word)
      }))

      // Update local state
      setWords(prev => prev.map(w => {
        const match = categories.find(c => c.id === w.id)
        return match ? { ...w, category: match.category } : w
      }))

      toast.success(`Categorized ${categories.length} word${categories.length !== 1 ? 's' : ''}`)
    } catch (e: any) {
      toast.error(`Failed: ${e?.message ?? String(e)}`)
    } finally {
      setSuggestingCategories(false)
    }
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
      category: newCategory.trim() || undefined,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
    } else {
      const { deck: refreshed } = await getDeckWithWords(deck.id)
      setWords(refreshed?.words ?? words)
      setWord(''); setDefJa(''); setDefEn(''); setExample(''); setNewCategory('')
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

  function startEdit(w: DeckWord) {
    setEditingWordId(w.id)
    setEditFields({
      word: w.word,
      reading: w.reading ?? '',
      defJa: w.definition_ja ?? '',
      defEn: w.definition_en ?? '',
      example: w.example ?? '',
      category: w.category ?? '',
    })
  }

  async function handleEditSave() {
    if (!editingWordId || !editFields.word.trim()) return
    setSavingEdit(true)
    const { error } = await updateDeckWord(editingWordId, {
      word: editFields.word.trim(),
      reading: editFields.reading.trim() || undefined,
      definition_ja: editFields.defJa.trim() || undefined,
      definition_en: editFields.defEn.trim() || undefined,
      example: editFields.example.trim() || undefined,
      category: editFields.category.trim() || undefined,
    })
    setSavingEdit(false)
    if (error) { toast.error(error); return }
    // Sync category change to all students' vocabulary_bank
    const categoryVal = editFields.category.trim() || null
    const wordVal = editFields.word.trim()
    await supabase.from('vocabulary_bank')
      .update({ category: categoryVal })
      .eq('deck_id', deck.id)
      .eq('word', wordVal)
    setWords(prev => prev.map(w => w.id === editingWordId ? {
      ...w,
      word: wordVal,
      reading: editFields.reading.trim() || null,
      definition_ja: editFields.defJa.trim() || null,
      definition_en: editFields.defEn.trim() || null,
      example: editFields.example.trim() || null,
      category: categoryVal,
    } : w))
    setEditingWordId(null)
    onUpdated()
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit vocabulary deck" className="fixed z-50 bg-black/60 flex items-center justify-center p-4" style={{ top: 0, left: 0, width: '100vw', height: '100vh', minHeight: '-webkit-fill-available' }}>
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
          <div className="flex items-center gap-2 ml-4">
            {words.length > 0 && (
              <button
                onClick={handleSuggestCategories}
                disabled={suggestingCategories}
                className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 shrink-0"
              >
                {suggestingCategories ? 'Categorizing…' : '✦ Auto-categorize'}
              </button>
            )}
            <button
              onClick={async () => { await onDelete(deck.id, name); onClose() }}
              className="text-xs text-gray-300 hover:text-red-500 transition-colors"
              title="Delete this deck"
            >
              Delete deck
            </button>
            <button aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setTab('words')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'words' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Words
          </button>
          <button
            onClick={() => setTab('quiz')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'quiz' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Quiz Questions
          </button>
        </div>

        {tab === 'quiz' ? (
          /* ── Quiz Tab ── */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Global header */}
            {(() => {
              const totalReady = words.filter(w => w.quiz_sentence?.includes('_____')).length
              const totalMissing = words.length - totalReady
              return (
                <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
                  <p className="text-xs text-gray-400">
                    {words.length} words · {totalReady} ready · {totalMissing} missing
                  </p>
                  <div className="flex gap-2">
                    {totalMissing > 0 && (
                      <button onClick={() => generateAll(words.filter(w => !w.quiz_sentence?.includes('_____')))} disabled={generating} className="px-3 py-1.5 bg-brand text-white text-xs rounded-lg disabled:opacity-50">
                        {generating ? 'Generating…' : `Generate all missing`}
                      </button>
                    )}
                    {words.length > 0 && totalMissing === 0 && (
                      <button onClick={() => generateAll(words)} disabled={generating} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 disabled:opacity-50">
                        {generating ? 'Generating…' : 'Regenerate all'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
              {loading ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
              ) : words.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No words in this deck yet.</p>
              ) : (() => {
                // Group deck words by category
                const catMap = new Map<string, DeckWord[]>()
                for (const w of words) {
                  const key = w.category ?? 'その他 / Other'
                  if (!catMap.has(key)) catMap.set(key, [])
                  catMap.get(key)!.push(w)
                }
                const catGroups = [...catMap.entries()].sort(([a], [b]) => {
                  if (a === 'その他 / Other') return 1
                  if (b === 'その他 / Other') return -1
                  return a.localeCompare(b)
                })

                return catGroups.map(([category, entries]) => {
                  const missing = entries.filter(w => !w.quiz_sentence?.includes('_____'))
                  return (
                    <div key={category} className="space-y-2">
                      {/* Category header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</h3>
                          <span className="text-xs text-gray-400">{entries.length} words</span>
                          {missing.length > 0 && (
                            <span className="text-xs text-orange-500">{missing.length} missing</span>
                          )}
                        </div>
                        <button
                          onClick={() => generateAll(missing.length > 0 ? missing : entries, entries)}
                          disabled={generating}
                          className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                        >
                          {generating ? '…' : missing.length > 0 ? `Generate ${missing.length} missing` : 'Regenerate category'}
                        </button>
                      </div>

                      {/* Word cards */}
                      {entries.map(w => {
                        const e = quizEdits[w.id] ?? { sentence: '', d0: '', d1: '', d2: '' }
                        const hasQuestion = e.sentence?.includes('_____')
                        return (
                          <div key={w.id} className={`border rounded-xl p-4 space-y-2 ${hasQuestion ? 'border-gray-200' : 'border-orange-200 bg-orange-50'}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-sm text-gray-900">{w.word}</span>
                                {w.definition_ja && <span className="text-xs text-gray-400 ml-2">{w.definition_ja}</span>}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => regenOne(w)} disabled={regenId === w.id || generating} className="text-xs text-gray-400 hover:text-brand disabled:opacity-40">
                                  {regenId === w.id ? 'Generating…' : 'Regenerate'}
                                </button>
                                <button onClick={() => saveQuizOne(w)} disabled={savingQuizId === w.id} className="text-xs px-2 py-0.5 bg-brand text-white rounded-md disabled:opacity-40">
                                  {savingQuizId === w.id ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Sentence (use _____ for blank)</label>
                              <input
                                value={e.sentence}
                                onChange={ev => setQuizEdits(prev => ({ ...prev, [w.id]: { ...prev[w.id], sentence: ev.target.value } }))}
                                placeholder="e.g. She _____ to school every day."
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {(['d0', 'd1', 'd2'] as const).map((k, i) => (
                                <div key={k}>
                                  <label className="text-xs text-gray-400 mb-1 block">Distractor {i + 1}</label>
                                  <input
                                    value={e[k]}
                                    onChange={ev => setQuizEdits(prev => ({ ...prev, [w.id]: { ...prev[w.id], [k]: ev.target.value } }))}
                                    placeholder="wrong answer"
                                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              })()}
            </div>
            <div className="px-6 py-3 border-t text-xs text-gray-400 shrink-0">Orange = no question yet · Category buttons use same-category distractors for harder quizzes</div>
          </div>
        ) : (
        /* ── Words Tab ── */
        <>
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
          <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Category (e.g. People & Family)" />
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
            <p className="text-sm text-gray-400 py-4">No words yet. Add some above or import from Anki.</p>
          ) : (
            <div className="space-y-1">
              {words.map(w => (
                <div key={w.id} className="border-b border-gray-100 last:border-0">
                  {editingWordId === w.id ? (
                    <div className="py-2 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input value={editFields.word} onChange={e => setEditFields(f => ({ ...f, word: e.target.value }))} placeholder="Word *" className="h-7 text-xs" />
                        <Input value={editFields.reading} onChange={e => setEditFields(f => ({ ...f, reading: e.target.value }))} placeholder="Reading" className="h-7 text-xs" />
                      </div>
                      <Input value={editFields.defJa} onChange={e => setEditFields(f => ({ ...f, defJa: e.target.value }))} placeholder="意味 (JA)" className="h-7 text-xs" />
                      <Input value={editFields.defEn} onChange={e => setEditFields(f => ({ ...f, defEn: e.target.value }))} placeholder="Definition (EN)" className="h-7 text-xs" />
                      <Input value={editFields.example} onChange={e => setEditFields(f => ({ ...f, example: e.target.value }))} placeholder="Example" className="h-7 text-xs" />
                      <Input value={editFields.category} onChange={e => setEditFields(f => ({ ...f, category: e.target.value }))} placeholder="Category (e.g. People & Family)" className="h-7 text-xs" />
                      <div className="flex gap-2">
                        <button onClick={handleEditSave} disabled={savingEdit || !editFields.word.trim()} className="px-3 py-1 bg-brand text-white text-xs rounded-md disabled:opacity-50">
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingWordId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">{w.word}</span>
                          {w.reading && <span className="text-xs text-gray-400">{w.reading}</span>}
                          {w.category && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">{w.category}</span>
                          )}
                        </div>
                        {w.definition_ja && <p className="text-xs text-gray-700 mt-0.5" dangerouslySetInnerHTML={{ __html: w.definition_ja }} />}
                        {w.definition_en && <p className="text-xs text-gray-400" dangerouslySetInnerHTML={{ __html: w.definition_en }} />}
                        {w.example && <p className="text-xs text-gray-400 italic" dangerouslySetInnerHTML={{ __html: `"${w.example}"` }} />}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => startEdit(w)} className="text-xs text-gray-400 hover:text-brand transition-colors">
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveWord(w.id)}
                          disabled={removing === w.id}
                          className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          {removing === w.id ? '…' : 'Remove'}
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
          {words.length} word{words.length !== 1 ? 's' : ''} in this deck
        </div>
        </>
        )}
      </div>
    </div>
  )
}

// ── Quiz Editor Modal ─────────────────────────────────────────
function QuizEditorModal({
  deck,
  studentId,
  onClose,
}: {
  deck: Deck
  studentId: string
  onClose: () => void
}) {
  const [entries, setEntries] = useState<VocabularyBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [regenId, setRegenId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { sentence: string; d0: string; d1: string; d2: string }>>({})

  async function loadEntries() {
    const { data } = await supabase
      .from('vocabulary_bank')
      .select('*')
      .eq('student_id', studentId)
      .eq('deck_id', deck.id)
      .order('word', { ascending: true })
    const rows = data ?? []
    setEntries(rows)
    const init: typeof edits = {}
    for (const r of rows) {
      init[r.id] = {
        sentence: r.quiz_sentence ?? '',
        d0: r.quiz_distractors?.[0] ?? '',
        d1: r.quiz_distractors?.[1] ?? '',
        d2: r.quiz_distractors?.[2] ?? '',
      }
    }
    setEdits(init)
    setLoading(false)
  }

  useEffect(() => { loadEntries() }, [deck.id, studentId])

  async function invokequiz(body: object) {
    const { data, error } = await supabase.functions.invoke('vocab-quiz-generate', { body })
    if (error) {
      let msg = error.message
      try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error } catch {}
      throw new Error(msg)
    }
    return data
  }

  async function generateAll(targets: VocabularyBankEntry[]) {
    if (!targets.length) return
    setGenerating(true)
    try {
      const data = await invokequiz({
        words: targets.map(w => ({ word: w.word, definition_en: w.definition_en })),
        level: deck.name,
        wordPool: entries.map(w => ({ word: w.word })),
      })
      const raw: { word: string; sentence: string; distractors: string[] }[] = data.questions ?? []
      await Promise.all(raw.map(q => {
        const entry = targets.find(w => w.word === q.word)
        if (!entry) return
        return supabase.from('vocabulary_bank').update({
          quiz_sentence: q.sentence,
          quiz_distractors: q.distractors,
        }).eq('id', entry.id)
      }))
      await loadEntries()
    } catch (e: any) {
      const msg = e?.message ?? e?.context?.message ?? String(e)
      toast.error(`Generation failed: ${msg}`)
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  async function regenOne(entry: VocabularyBankEntry) {
    setRegenId(entry.id)
    try {
      const data = await invokequiz({
        words: [{ word: entry.word, definition_en: entry.definition_en }],
        level: deck.name,
        wordPool: entries.map(w => ({ word: w.word })),
      })
      const q = (data.questions ?? [])[0]
      if (!q) throw new Error('No question returned')
      await supabase.from('vocabulary_bank').update({
        quiz_sentence: q.sentence,
        quiz_distractors: q.distractors,
      }).eq('id', entry.id)
      setEdits(prev => ({
        ...prev,
        [entry.id]: { sentence: q.sentence, d0: q.distractors[0] ?? '', d1: q.distractors[1] ?? '', d2: q.distractors[2] ?? '' },
      }))
    } catch (e: any) {
      const msg = e?.message ?? e?.context?.message ?? String(e)
      toast.error(`Regeneration failed: ${msg}`)
      console.error(e)
    } finally {
      setRegenId(null)
    }
  }

  async function saveOne(entry: VocabularyBankEntry) {
    const e = edits[entry.id]
    if (!e) return
    setSavingId(entry.id)
    const distractors = [e.d0, e.d1, e.d2].filter(Boolean)
    await supabase.from('vocabulary_bank').update({
      quiz_sentence: e.sentence || null,
      quiz_distractors: distractors,
    }).eq('id', entry.id)
    setSavingId(null)
    toast.success('Saved')
  }

  const uncached = entries.filter(e => !e.quiz_sentence)

  return (
    <div className="fixed z-50 bg-black/60 flex items-center justify-center p-4" style={{ top: 0, left: 0, width: '100vw', height: '100vh', minHeight: '-webkit-fill-available' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Quiz Questions — {deck.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{entries.length} words · {uncached.length} without questions</p>
          </div>
          <div className="flex items-center gap-3">
            {uncached.length > 0 && (
              <button
                onClick={() => generateAll(uncached)}
                disabled={generating}
                className="px-3 py-1.5 bg-brand text-white text-sm rounded-lg disabled:opacity-50"
              >
                {generating ? 'Generating…' : `Generate ${uncached.length} missing`}
              </button>
            )}
            {uncached.length === 0 && entries.length > 0 && (
              <button
                onClick={() => generateAll(entries)}
                disabled={generating}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {generating ? 'Generating…' : 'Regenerate all'}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No words in this deck for this student.</p>
          ) : entries.map(entry => {
            const e = edits[entry.id] ?? { sentence: '', d0: '', d1: '', d2: '' }
            const hasSentence = !!e.sentence
            return (
              <div key={entry.id} className={`border rounded-xl p-4 space-y-2 ${hasSentence ? 'border-gray-200' : 'border-orange-200 bg-orange-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-900">{entry.word}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => regenOne(entry)}
                      disabled={regenId === entry.id || generating}
                      className="text-xs text-gray-400 hover:text-brand disabled:opacity-40"
                    >
                      {regenId === entry.id ? 'Generating…' : 'Regenerate'}
                    </button>
                    <button
                      onClick={() => saveOne(entry)}
                      disabled={savingId === entry.id}
                      className="text-xs px-2 py-0.5 bg-brand text-white rounded-md disabled:opacity-40"
                    >
                      {savingId === entry.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Sentence (use _____ for blank)</label>
                  <input
                    value={e.sentence}
                    onChange={ev => setEdits(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], sentence: ev.target.value } }))}
                    placeholder="e.g. She _____ to school every day."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['d0', 'd1', 'd2'] as const).map((k, i) => (
                    <div key={k}>
                      <label className="text-xs text-gray-400 mb-1 block">Distractor {i + 1}</label>
                      <input
                        value={e[k]}
                        onChange={ev => setEdits(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], [k]: ev.target.value } }))}
                        placeholder="wrong word"
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-6 py-3 border-t text-xs text-gray-400">
          Orange = no question yet · Edit any field then click Save
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
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)
  const [removingImage, setRemovingImage] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [imageTargetId, setImageTargetId] = useState<string | null>(null)
  const [deckSyncStatus, setDeckSyncStatus] = useState<Record<string, number>>({}) // deckId → missing word count
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState<string | null>(null)

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

  async function checkDeckSync(currentVocab: typeof vocab) {
    const assignedIds = [...new Set(currentVocab.map(v => v.deck_id).filter(Boolean) as string[])]
    if (!assignedIds.length) return

    // Count words per deck in vocabulary_deck_words (master deck)
    const { data: masterCounts } = await supabase
      .from('vocabulary_deck_words')
      .select('deck_id, word')
      .in('deck_id', assignedIds)

    if (!masterCounts) return

    // Count what the student currently has per deck
    const studentCountByDeck: Record<string, Set<string>> = {}
    for (const v of currentVocab) {
      if (!v.deck_id) continue
      if (!studentCountByDeck[v.deck_id]) studentCountByDeck[v.deck_id] = new Set()
      studentCountByDeck[v.deck_id].add(v.word)
    }

    const masterByDeck: Record<string, Set<string>> = {}
    for (const row of masterCounts) {
      if (!masterByDeck[row.deck_id]) masterByDeck[row.deck_id] = new Set()
      masterByDeck[row.deck_id].add(row.word)
    }

    const status: Record<string, number> = {}
    for (const deckId of assignedIds) {
      const master = masterByDeck[deckId] ?? new Set()
      const student = studentCountByDeck[deckId] ?? new Set()
      const missing = [...master].filter(w => !student.has(w)).length
      if (missing > 0) status[deckId] = missing
    }
    setDeckSyncStatus(status)
  }

  useEffect(() => { loadVocab() }, [studentId])
  useEffect(() => { loadDecks() }, [])

  // Run sync check whenever vocab loads
  useEffect(() => {
    if (!loading) checkDeckSync(vocab)
  }, [loading, vocab])

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
    if (!confirm(`Delete deck "${deckName}"? This will remove the deck and all its words from every student it was assigned to.`)) return
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

  async function handleSync(deckId: string, deckName: string) {
    setSyncing(deckId)
    try {
      const { error } = await assignDeckToStudent(deckId, studentId)
      if (error) { toast.error(error); return }
      const added = deckSyncStatus[deckId] ?? 0
      setDeckSyncStatus(prev => { const n = { ...prev }; delete n[deckId]; return n })
      toast.success(`Synced "${deckName}" — ${added} word${added !== 1 ? 's' : ''} added`)
      loadVocab()
    } catch (e: any) {
      console.error('[handleSync]', e)
      toast.error(e?.message ?? 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  async function handleSyncAll(deckId: string, deckName: string) {
    setSyncingAll(deckId)
    try {
      const { synced, error } = await syncDeckToAllStudents(deckId)
      if (error) { toast.error(error); return }
      toast.success(`"${deckName}" synced to ${synced} student${synced !== 1 ? 's' : ''}`)
      loadVocab()
    } catch (e: any) {
      console.error('[handleSyncAll]', e)
      toast.error(e?.message ?? 'Sync failed')
    } finally {
      setSyncingAll(null)
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
      const deckName = dId ? (decks.find(d => d.id === dId)?.name ?? 'Assigned Deck') : 'Ungrouped'
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
          studentId={studentId}
          onClose={() => setEditingDeck(null)}
          onUpdated={() => { loadDecks(); loadVocab() }}
          onDelete={async (id, name) => { await handleDeleteDeck(id, name); setEditingDeck(null) }}
        />
      )}

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Vocabulary Bank</CardTitle>
            <AnkiImporter studentId={studentId} onImported={loadVocab} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Deck Library ── */}
          <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Decks</span>
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
              <SortableDeckList
                decks={decks.map(d => ({
                  id: d.id,
                  name: d.name,
                  meta: `${d.word_count ?? 0} words`,
                  badge: assignedDeckIds.has(d.id) ? 'Assigned' : undefined,
                }))}
                onReorder={rows => {
                  const newOrder = rows.map(r => decks.find(d => d.id === r.id)!)
                  setDecks(newOrder)
                  reorderVocabDecks(newOrder.map(d => d.id))
                }}
                renderActions={row => {
                  const deck = decks.find(d => d.id === row.id)!
                  const isAssigned = assignedDeckIds.has(row.id)
                  const missing = deckSyncStatus[row.id]
                  return (
                    <>
                      <button onClick={() => setEditingDeck(deck)} className="text-xs text-gray-400 hover:text-brand transition-colors">Edit</button>
                      {isAssigned && missing > 0 && (
                        <button
                          onClick={() => handleSync(row.id, row.name)}
                          disabled={syncing === row.id}
                          className="text-xs text-orange-500 hover:text-orange-700 transition-colors disabled:opacity-50 font-medium"
                          title={`${missing} word${missing !== 1 ? 's' : ''} in deck not yet assigned to this student`}
                        >
                          {syncing === row.id ? 'Syncing…' : `⚠ Sync (${missing})`}
                        </button>
                      )}
                      {isAssigned && (
                        <button
                          onClick={() => handleSyncAll(row.id, row.name)}
                          disabled={syncingAll === row.id}
                          className="text-xs text-gray-400 hover:text-brand transition-colors disabled:opacity-50"
                          title="Push latest deck words to all students who have this deck assigned"
                        >
                          {syncingAll === row.id ? 'Syncing…' : 'Sync all'}
                        </button>
                      )}
                      {isAssigned ? (
                        <button onClick={() => handleRemoveDeck(row.id, row.name)} disabled={removing === row.id} className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                          {removing === row.id ? '…' : 'Remove'}
                        </button>
                      ) : (
                        <button onClick={() => handleAssign(row.id)} disabled={assigning === row.id} className="text-xs text-brand hover:text-brand/80 transition-colors disabled:opacity-50">
                          {assigning === row.id ? '…' : 'Assign'}
                        </button>
                      )}
                      <button onClick={() => handleDeleteDeck(row.id, row.name)} disabled={deleting === row.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                        {deleting === row.id ? '…' : 'Delete'}
                      </button>
                    </>
                  )
                }}
              />
            )}
          </div>

        </CardContent>
      </Card>
    </>
  )
}
