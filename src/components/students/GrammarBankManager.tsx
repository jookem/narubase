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
  removePointsFromDeck,
  assignGrammarDeckToStudent,
  removeGrammarDeckFromStudent,
  reorderGrammarDecks,
  updateGrammarDeckFolder,
  listLessonSlides,
  addLessonSlide,
  updateLessonSlide,
  removeLessonSlide,
  removeLessonSlides,
  reorderLessonSlides,
  type GrammarBankEntry,
  type GrammarDeck,
  type GrammarDeckPoint,
  type GrammarLessonSlide,
} from '@/lib/api/grammar'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { FolderDeckList } from '@/components/shared/FolderDeckList'
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

// Render a sentence with _____ highlighted (supports multiple blanks)
function SentenceWithBlank({ sentence }: { sentence: string }) {
  const parts = sentence.split('_____')
  if (parts.length === 1) return <span>{sentence}</span>
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="inline-block bg-brand-light text-brand-dark font-semibold px-1 rounded mx-0.5">_____</span>
          )}
        </span>
      ))}
    </span>
  )
}

// ── Lesson Slides Tab ─────────────────────────────────────────
function LessonSlidesTab({ deckId }: { deckId: string }) {
  const [slides, setSlides] = useState<GrammarLessonSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({ title: '', explanation: '', examples: '', hint_ja: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  // Grammar point input
  const [grammarPoint, setGrammarPoint] = useState('')
  const [generating, setGenerating] = useState(false)
  const [bulkDeletingSlides, setBulkDeletingSlides] = useState(false)
  const bulkSlides = useBulkSelect(slides.map(s => s.id))

  useEffect(() => {
    listLessonSlides(deckId).then(({ slides: s }) => {
      setSlides(s ?? [])
      setLoading(false)
    })
  }, [deckId])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    const topic = grammarPoint.trim()
    if (!topic) return
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('grammar-lesson-generate', {
        body: { category: topic, samples: [] },
      })
      if (error || (!data?.slides && !data?.slide)) throw new Error(error?.message ?? 'No slides returned')

      type SlidePayload = { title: string; explanation: string; examples: string[]; hint_ja: string }
      const generated: SlidePayload[] = Array.isArray(data.slides) ? data.slides : data.slide ? [data.slide] : []
      const existingTitles = new Set(slides.map(s => s.title.toLowerCase()))
      let created = 0
      for (const s of generated) {
        if (existingTitles.has(s.title.toLowerCase())) continue
        const { error: addErr } = await addLessonSlide(deckId, {
          title: s.title, explanation: s.explanation, examples: s.examples, hint_ja: s.hint_ja || undefined,
        })
        if (!addErr) { existingTitles.add(s.title.toLowerCase()); created++ }
      }
      const { slides: updated } = await listLessonSlides(deckId)
      setSlides(updated ?? [])
      if (created > 0) { setGrammarPoint(''); toast.success(`Generated ${created} slide${created !== 1 ? 's' : ''} for "${topic}"`) }
      else toast.info('Slides already exist for this grammar point')
    } catch (e: any) {
      toast.error(`Failed: ${e?.message ?? String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  function parseExamples(text: string) {
    return text.split('\n').map(s => s.trim()).filter(Boolean)
  }

  function startEdit(s: GrammarLessonSlide) {
    setEditingId(s.id)
    setEditFields({
      title: s.title,
      explanation: s.explanation,
      examples: s.examples.join('\n'),
      hint_ja: s.hint_ja ?? '',
    })
  }

  async function handleEditSave() {
    if (!editingId) return
    setSavingEdit(true)
    const { error } = await updateLessonSlide(editingId, {
      title: editFields.title.trim(),
      explanation: editFields.explanation.trim(),
      examples: parseExamples(editFields.examples),
      hint_ja: editFields.hint_ja.trim() || undefined,
    })
    setSavingEdit(false)
    if (error) { toast.error(error); return }
    setSlides(prev => prev.map(s => s.id === editingId ? {
      ...s,
      title: editFields.title.trim(),
      explanation: editFields.explanation.trim(),
      examples: parseExamples(editFields.examples),
      hint_ja: editFields.hint_ja.trim() || null,
    } : s))
    setEditingId(null)
  }

  async function handleRemove(slideId: string) {
    setRemoving(slideId)
    const { error } = await removeLessonSlide(slideId)
    setRemoving(null)
    if (error) toast.error(error)
    else setSlides(prev => prev.filter(s => s.id !== slideId))
  }

  async function handleMove(slideId: string, dir: -1 | 1) {
    const idx = slides.findIndex(s => s.id === slideId)
    if (idx < 0) return
    const next = idx + dir
    if (next < 0 || next >= slides.length) return
    const reordered = [...slides]
    ;[reordered[idx], reordered[next]] = [reordered[next], reordered[idx]]
    setSlides(reordered)
    await reorderLessonSlides(reordered.map(s => s.id))
  }

  async function handleBulkDeleteSlides() {
    const ids = bulkSlides.selectedIds
    const count = ids.length
    if (!confirm(`Delete ${count} slide${count !== 1 ? 's' : ''}?`)) return
    setBulkDeletingSlides(true)
    const { error } = await removeLessonSlides(ids)
    setBulkDeletingSlides(false)
    if (error) { toast.error(error); return }
    const idSet = new Set(ids)
    setSlides(prev => prev.filter(s => !idSet.has(s.id)))
    bulkSlides.clear()
    toast.success(`Deleted ${count} slide${count !== 1 ? 's' : ''}`)
  }

  if (loading) return <div className="py-4 space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>

  return (
    <div className="space-y-4">
      {/* Grammar point input */}
      <form onSubmit={handleGenerate} className="flex gap-2">
        <input
          value={grammarPoint}
          onChange={e => setGrammarPoint(e.target.value)}
          placeholder="Enter a grammar point e.g. Present Perfect, Modal Verbs…"
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={generating || !grammarPoint.trim()}
          className="shrink-0 px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {generating ? 'Generating…' : '✦ Generate slides'}
        </button>
      </form>

      {/* Slide list */}
      {loading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : slides.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No lesson slides yet — enter a grammar point above to get started.</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-600 select-none">
              <input type="checkbox" checked={bulkSlides.allSelected} onChange={bulkSlides.toggleAll} className="w-3.5 h-3.5 accent-brand" />
              {bulkSlides.anySelected ? `${bulkSlides.count} selected` : 'Select all'}
            </label>
            {bulkSlides.anySelected && (
              <div className="flex items-center gap-3">
                <button onClick={bulkSlides.clear} className="hover:text-gray-600">Clear</button>
                <button onClick={handleBulkDeleteSlides} disabled={bulkDeletingSlides} className="text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                  {bulkDeletingSlides ? 'Deleting…' : `Delete ${bulkSlides.count}`}
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
          {slides.map((s, i) => (
            <div key={s.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {editingId === s.id ? (
                <div className="p-4 space-y-3 bg-gray-50">
                  <Input value={editFields.title} onChange={e => setEditFields(f => ({ ...f, title: e.target.value }))} placeholder="Title *" />
                  <div className="space-y-1">
                    <textarea
                      value={editFields.explanation}
                      onChange={e => setEditFields(f => ({ ...f, explanation: e.target.value }))}
                      placeholder="Explanation — supports markdown&#10;**bold**  *italic*&#10;1. numbered list&#10;- bullet list"
                      rows={8}
                      className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand resize-y"
                    />
                    <p className="text-xs text-gray-400">Formatting: <code className="bg-gray-100 px-1 rounded">**bold**</code> <code className="bg-gray-100 px-1 rounded">*italic*</code> <code className="bg-gray-100 px-1 rounded">1. list</code> <code className="bg-gray-100 px-1 rounded">- bullet</code></p>
                  </div>
                  <textarea
                    value={editFields.examples}
                    onChange={e => setEditFields(f => ({ ...f, examples: e.target.value }))}
                    placeholder="Examples (one per line) — wrap grammar point in [brackets] to highlight"
                    rows={4}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand resize-y"
                  />
                  <Input value={editFields.hint_ja} onChange={e => setEditFields(f => ({ ...f, hint_ja: e.target.value }))} placeholder="Japanese note" />
                  <div className="flex gap-2">
                    <button onClick={handleEditSave} disabled={savingEdit} className="px-4 py-1.5 bg-brand text-white text-sm rounded-md disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3">
                  <input type="checkbox" checked={bulkSlides.isSelected(s.id)} onChange={() => bulkSlides.toggle(s.id)} className="mt-1 shrink-0 w-3.5 h-3.5 accent-brand cursor-pointer" />
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => handleMove(s.id, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▲</button>
                    <button onClick={() => handleMove(s.id, 1)} disabled={i === slides.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▼</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                    {s.explanation && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.explanation}</p>}
                    {s.examples.length > 0 && (
                      <p className="text-xs text-gray-400 italic mt-0.5">
                        {s.examples.length} example{s.examples.length !== 1 ? 's' : ''}
                      </p>
                    )}
                    {s.hint_ja && <p className="text-xs text-purple-500 mt-0.5">{s.hint_ja}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEdit(s)} className="text-xs text-gray-400 hover:text-brand transition-colors">Edit</button>
                    <button onClick={() => handleRemove(s.id)} disabled={removing === s.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                      {removing === s.id ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          </div>
        </>
      )}
    </div>
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
  const [tab, setTab] = useState<'lesson' | 'quiz'>('lesson')
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const bulkPoints = useBulkSelect(points.map(p => p.id))
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
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + 5, start + 5)
    })
  }

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({ sentence: '', answer: '', hint: '', answer_ja: '', distractors: '', category: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  async function handleGenerateFromSlides() {
    setGeneratingQuestions(true)
    try {
      const { slides } = await listLessonSlides(deck.id)
      if (!slides || slides.length === 0) {
        toast.error('No lesson slides found — add slides first')
        return
      }
      // Group slides by base topic (strip " — Japanese subtitle")
      const topicSlides = new Map<string, typeof slides>()
      for (const s of slides) {
        const topic = s.title.split(' — ')[0].trim()
        if (!topicSlides.has(topic)) topicSlides.set(topic, [])
        topicSlides.get(topic)!.push(s)
      }
      let added = 0
      for (const [topic, topicGroup] of topicSlides) {
        // Collect example sentences from this topic's slides as context
        const examples = topicGroup.flatMap(s => s.examples).slice(0, 6)
        const { data, error } = await supabase.functions.invoke('grammar-generate-questions', {
          body: { topic, examples, count: 10 },
        })
        if (error || !data?.questions?.length) {
          console.error('Failed to generate questions for', topic, error)
          continue
        }
        for (const q of data.questions) {
          const { error: addErr } = await addPointToDeck(deck.id, {
            point: q.sentence_with_blank,
            explanation: q.answer,
            sentence_with_blank: q.sentence_with_blank,
            answer: q.answer,
            answer_ja: q.answer_ja || undefined,
            hint_ja: q.hint_ja || undefined,
            distractors: q.distractors ?? [],
            category: q.category || topic,
          })
          if (!addErr) added++
        }
      }
      const { deck: refreshed } = await getGrammarDeckWithPoints(deck.id)
      setPoints(refreshed?.points ?? points)
      onUpdated()
      toast.success(`Generated ${added} question${added !== 1 ? 's' : ''} from ${topicSlides.size} grammar point${topicSlides.size !== 1 ? 's' : ''}`)
    } catch (e: any) {
      toast.error(`Failed: ${e?.message ?? String(e)}`)
    } finally {
      setGeneratingQuestions(false)
    }
  }

  async function handleBulkDeletePoints() {
    const ids = bulkPoints.selectedIds
    const count = ids.length
    if (!confirm(`Delete ${count} question${count !== 1 ? 's' : ''}?`)) return
    setBulkDeleting(true)
    const { error } = await removePointsFromDeck(ids)
    setBulkDeleting(false)
    if (error) { toast.error(error); return }
    const idSet = new Set(ids)
    setPoints(prev => prev.filter(p => !idSet.has(p.id)))
    bulkPoints.clear()
    onUpdated()
    toast.success(`Deleted ${count} question${count !== 1 ? 's' : ''}`)
  }

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

  function startEdit(p: GrammarDeckPoint) {
    setEditingId(p.id)
    setEditFields({
      sentence: p.sentence_with_blank ?? p.point,
      answer: p.answer ?? p.explanation,
      hint: p.hint_ja ?? '',
      answer_ja: p.answer_ja ?? '',
      distractors: (p.distractors ?? []).join(', '),
      category: p.category ?? '',
    })
  }

  async function handleEditSave() {
    if (!editingId) return
    const sentence = editFields.sentence.trim()
    const answer = editFields.answer.trim()
    if (!sentence || !answer) return
    const distractors = editFields.distractors.split(',').map(s => s.trim()).filter(Boolean)
    const category = editFields.category.trim() || undefined
    setSavingEdit(true)

    // Capture old sentence before updating so we can match grammar_bank rows
    const oldPoint = points.find(p => p.id === editingId)
    const oldSentence = oldPoint?.sentence_with_blank ?? oldPoint?.point ?? ''

    const { error } = await updateGrammarDeckPoint(editingId, {
      point: sentence,
      explanation: answer,
      sentence_with_blank: sentence,
      answer,
      hint_ja: editFields.hint.trim() || undefined,
      answer_ja: editFields.answer_ja.trim() || undefined,
      distractors,
      category,
    })
    setSavingEdit(false)
    if (error) { toast.error(error); return }

    // Auto-sync changes to all student grammar_bank copies
    await supabase.from('grammar_bank').update({
      point: sentence,
      explanation: answer,
      category: category ?? null,
      hint_ja: editFields.hint.trim() || null,
    }).eq('deck_id', deck.id).eq('point', oldSentence)

    setPoints(prev => prev.map(p => p.id === editingId ? {
      ...p,
      point: sentence,
      explanation: answer,
      sentence_with_blank: sentence,
      answer,
      hint_ja: editFields.hint.trim() || null,
      answer_ja: editFields.answer_ja.trim() || null,
      distractors,
      category: category ?? null,
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
    <div role="dialog" aria-modal="true" aria-label="Edit grammar deck" className="fixed z-50 bg-black/60 flex items-center justify-center p-4" style={{ top: 0, left: 0, width: '100vw', height: '100vh', minHeight: '-webkit-fill-available' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0">
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
          <button aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 shrink-0">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setTab('lesson')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'lesson' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Lesson Slides
          </button>
          <button
            onClick={() => setTab('quiz')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'quiz' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Quiz Questions
          </button>
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {tab === 'lesson' ? (
            <LessonSlidesTab deckId={deck.id} />
          ) : (
            <>
              {/* Generate from slides */}
              <div className="mb-4 bg-violet-50 rounded-xl p-4 border border-violet-200 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-violet-900">Generate quiz questions from slides</p>
                  <p className="text-xs text-violet-600 mt-0.5">10 questions per grammar point based on your lesson slides</p>
                </div>
                <button
                  onClick={handleGenerateFromSlides}
                  disabled={generatingQuestions}
                  className="w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {generatingQuestions ? 'Generating…' : '✦ Generate questions'}
                </button>
              </div>

              {/* Bulk action bar */}
              {points.length > 0 && !loading && (
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-600 select-none">
                    <input type="checkbox" checked={bulkPoints.allSelected} onChange={bulkPoints.toggleAll} className="w-3.5 h-3.5 accent-brand" />
                    {bulkPoints.anySelected ? `${bulkPoints.count} selected` : 'Select all'}
                  </label>
                  {bulkPoints.anySelected && (
                    <div className="flex items-center gap-3">
                      <button onClick={bulkPoints.clear} className="hover:text-gray-600">Clear</button>
                      <button onClick={handleBulkDeletePoints} disabled={bulkDeleting} className="text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                        {bulkDeleting ? 'Deleting…' : `Delete ${bulkPoints.count}`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Point list — grouped by category */}
              {loading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
              ) : points.length === 0 ? (
                <p className="text-sm text-gray-400">No questions yet — generate from your lesson slides above.</p>
              ) : (() => {
                const catMap = new Map<string, GrammarDeckPoint[]>()
                for (const p of points) {
                  const key = p.category ?? 'その他 / Other'
                  if (!catMap.has(key)) catMap.set(key, [])
                  catMap.get(key)!.push(p)
                }
                const catGroups = [...catMap.entries()].sort(([a], [b]) => {
                  if (a === 'その他 / Other') return 1
                  if (b === 'その他 / Other') return -1
                  return a.localeCompare(b)
                })

                return (
                  <div className="space-y-4">
                    {catGroups.map(([category, groupPoints]) => {
                      const missing = groupPoints.filter(p => !p.sentence_with_blank)
                      return (
                        <div key={category} className="space-y-1">
                          {/* Category header */}
                          <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</h3>
                            <span className="text-xs text-gray-400">{groupPoints.length}</span>
                            {missing.length > 0 && (
                              <span className="text-xs text-orange-500">{missing.length} missing sentence</span>
                            )}
                          </div>

                          {groupPoints.map(p => (
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
                                  <Input value={editFields.answer_ja} onChange={e => setEditFields(f => ({ ...f, answer_ja: e.target.value }))} placeholder="Japanese answer e.g. もっと大きい" className="h-7 text-xs" />
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input value={editFields.distractors} onChange={e => setEditFields(f => ({ ...f, distractors: e.target.value }))} placeholder="Wrong choices, comma-separated" className="h-7 text-xs" />
                                    <Input value={editFields.category} onChange={e => setEditFields(f => ({ ...f, category: e.target.value }))} placeholder="Category" className="h-7 text-xs" />
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={handleEditSave} disabled={savingEdit} className="px-3 py-1 bg-brand text-white text-xs rounded-md disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save'}</button>
                                    <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div className={`flex items-start gap-2 py-2 ${!p.sentence_with_blank ? 'opacity-60' : ''}`}>
                                  <input type="checkbox" checked={bulkPoints.isSelected(p.id)} onChange={() => bulkPoints.toggle(p.id)} className="mt-1 shrink-0 w-3.5 h-3.5 accent-brand cursor-pointer" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-900">
                                      <SentenceWithBlank sentence={p.sentence_with_blank ?? p.point} />
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      {p.answer && (
                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                          ✓ {p.answer}
                                        </span>
                                      )}
                                      {p.hint_ja && <span className="text-xs text-gray-500">{p.hint_ja}</span>}
                                      {(p.distractors ?? []).length > 0 && (
                                        <span className="text-xs text-gray-400">wrong: {p.distractors!.join(' | ')}</span>
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
                      )
                    })}
                  </div>
                )
              })()}
              <p className="text-xs text-gray-400 mt-3">{points.length} question{points.length !== 1 ? 's' : ''} in this deck</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export function GrammarBankManager({ studentId }: { studentId?: string }) {
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
    if (!studentId) { setEntries([]); setLoading(false); return }
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

  const [savingDeck, setSavingDeck] = useState(false)

  async function handleCreateDeck(ev: React.FormEvent) {
    ev.preventDefault()
    if (!newDeckName.trim() || savingDeck) return
    setSavingDeck(true)
    const { deck, error } = await createGrammarDeck(newDeckName.trim())
    setSavingDeck(false)
    if (error) { toast.error(error); return }
    await loadDecks()
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
    const { count, error } = await assignGrammarDeckToStudent(deckId, studentId!)
    setAssigning(null)
    if (error) toast.error(error)
    else {
      toast.success(`${count} grammar point${count !== 1 ? 's' : ''} assigned`)
      loadEntries()
    }
  }

  async function handleRemoveDeck(deckId: string, deckName: string) {
    if (!confirm(`Unassign deck "${deckName}" from this student?`)) return
    setRemovingDeck(deckId)
    const { error } = await removeGrammarDeckFromStudent(deckId, studentId!)
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
          <CardTitle className="text-base">Grammar Bank</CardTitle>
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
                <button type="submit" disabled={!newDeckName.trim() || savingDeck} className="px-3 py-1 bg-brand text-white text-sm rounded-md disabled:opacity-50">{savingDeck ? 'Creating…' : 'Create'}</button>
                <button type="button" onClick={() => { setCreatingDeck(false); setNewDeckName('') }} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              </form>
            )}

            {decksLoading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />)}</div>
            ) : decks.length === 0 ? (
              <p className="text-xs text-gray-400">No decks yet. Create one to get started.</p>
            ) : (
              <FolderDeckList
                storageKey="grammar-decks"
                decks={decks.map(d => ({
                  id: d.id,
                  name: d.name,
                  folder: d.folder,
                  meta: `${d.point_count ?? 0} points`,
                  badge: assignedDeckIds.has(d.id) ? 'Assigned' : undefined,
                }))}
                onReorder={rows => {
                  const newOrder = rows.map(r => decks.find(d => d.id === r.id)!)
                  setDecks(newOrder)
                  reorderGrammarDecks(newOrder.map(d => d.id))
                }}
                onMoveToFolder={async (id, folder) => {
                  const { error } = await updateGrammarDeckFolder(id, folder)
                  if (!error) setDecks(prev => prev.map(d => d.id === id ? { ...d, folder } : d))
                }}
                renderActions={row => {
                  const deck = decks.find(d => d.id === row.id)!
                  const isAssigned = assignedDeckIds.has(row.id)
                  return (
                    <>
                      <button onClick={() => setEditingDeck(deck)} className="text-xs text-gray-400 hover:text-brand transition-colors">Edit</button>
                      {studentId && (isAssigned ? (
                        <button onClick={() => handleRemoveDeck(row.id, row.name)} disabled={removingDeck === row.id} className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                          {removingDeck === row.id ? '…' : 'Unassign'}
                        </button>
                      ) : (
                        <button onClick={() => handleAssign(row.id)} disabled={assigning === row.id} className="text-xs text-brand hover:text-brand/80 transition-colors disabled:opacity-50">
                          {assigning === row.id ? '…' : 'Assign'}
                        </button>
                      ))}
                      <button onClick={() => handleDeleteDeck(row.id, row.name)} disabled={deletingDeck === row.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                        {deletingDeck === row.id ? '…' : 'Delete'}
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
