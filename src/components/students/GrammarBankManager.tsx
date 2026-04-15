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
  reorderGrammarDecks,
  listLessonSlides,
  addLessonSlide,
  updateLessonSlide,
  removeLessonSlide,
  reorderLessonSlides,
  type GrammarBankEntry,
  type GrammarDeck,
  type GrammarDeckPoint,
  type GrammarLessonSlide,
} from '@/lib/api/grammar'
import { SortableDeckList, type DeckRow } from '@/components/shared/SortableDeckList'
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

// ── Lesson Slides Tab ─────────────────────────────────────────
function LessonSlidesTab({ deckId, points }: { deckId: string; points: GrammarDeckPoint[] }) {
  const [slides, setSlides] = useState<GrammarLessonSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({ title: '', explanation: '', examples: '', hint_ja: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  // Add form
  const [addTitle, setAddTitle] = useState('')
  const [addExplanation, setAddExplanation] = useState('')
  const [addExamples, setAddExamples] = useState('')
  const [addHint, setAddHint] = useState('')
  const [saving, setSaving] = useState(false)
  const [autoGenerating, setAutoGenerating] = useState(false)

  useEffect(() => {
    listLessonSlides(deckId).then(({ slides: s }) => {
      setSlides(s ?? [])
      setLoading(false)
    })
  }, [deckId])

  async function handleAutoGenerate() {
    if (points.length === 0) {
      toast.error('No quiz questions found in this deck.')
      return
    }
    setAutoGenerating(true)
    let created = 0
    let skipped = 0
    let failed = 0

    // Re-fetch slides from DB to get accurate existing titles (state may be stale)
    const { slides: freshSlides } = await listLessonSlides(deckId)
    const currentSlides = freshSlides ?? []
    setSlides(currentSlides)

    // Group points by category (fall back to answer text if uncategorized)
    const groups = new Map<string, typeof points>()
    for (const p of points) {
      const key = p.category ?? (p.answer ?? p.explanation)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    }

    if (groups.size === 0) {
      toast.error('No categories found — run Auto-categorize on the questions first.')
      setAutoGenerating(false)
      return
    }

    const existingTitles = new Set(currentSlides.map(s => s.title.toLowerCase()))

    for (const [category, groupPoints] of groups) {
      if (existingTitles.has(category.toLowerCase())) {
        skipped++
        continue
      }

      const { data, error } = await supabase.functions.invoke('grammar-lesson-generate', {
        body: {
          category,
          samples: groupPoints.slice(0, 5).map(p => ({
            sentence_with_blank: p.sentence_with_blank ?? p.point,
            answer: p.answer ?? p.explanation,
            hint_ja: p.hint_ja,
          })),
        },
      })

      if (error || !data?.slide) {
        console.error('Failed to generate slide for', category, error, data)
        failed++
        continue
      }

      const slide = data.slide as { title: string; explanation: string; examples: string[]; hint_ja: string }
      const { error: addErr } = await addLessonSlide(deckId, {
        title: slide.title,
        explanation: slide.explanation,
        examples: slide.examples,
        hint_ja: slide.hint_ja || undefined,
      })
      if (addErr) {
        console.error('Failed to save slide for', category, addErr)
        failed++
      } else {
        created++
      }
    }

    const { slides: updated } = await listLessonSlides(deckId)
    setSlides(updated ?? [])
    setAutoGenerating(false)

    if (created > 0) {
      toast.success(`Generated ${created} slide${created !== 1 ? 's' : ''}${skipped > 0 ? ` · ${skipped} already existed` : ''}`)
    } else if (skipped > 0 && failed === 0) {
      toast.info('All slides already exist — delete existing slides first to regenerate.')
    } else if (failed > 0) {
      toast.error(`Generation failed for ${failed} categor${failed !== 1 ? 'ies' : 'y'} — check console for details.`)
    }
  }

  function parseExamples(text: string) {
    return text.split('\n').map(s => s.trim()).filter(Boolean)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addTitle.trim()) return
    setSaving(true)
    const { slide, error } = await addLessonSlide(deckId, {
      title: addTitle.trim(),
      explanation: addExplanation.trim(),
      examples: parseExamples(addExamples),
      hint_ja: addHint.trim() || undefined,
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    setSlides(prev => [...prev, slide!])
    setAddTitle(''); setAddExplanation(''); setAddExamples(''); setAddHint('')
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

  if (loading) return <div className="py-4 space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>

  return (
    <div className="space-y-4">
      {/* Auto-generate from categories */}
      {points.length > 0 && (
        <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
          <p className="text-xs text-purple-700">AI generates one slide per grammar category — with explanation, 4 examples, and Japanese note</p>
          <button
            onClick={handleAutoGenerate}
            disabled={autoGenerating}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {autoGenerating ? 'Generating…' : '✦ Auto-generate slides'}
          </button>
        </div>
      )}

      {/* Add slide form */}
      <form onSubmit={handleAdd} className="space-y-2 bg-gray-50 rounded-xl p-4 border">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add Slide</p>
        <Input
          value={addTitle}
          onChange={e => setAddTitle(e.target.value)}
          placeholder="Grammar point title * e.g. Present Perfect"
          required
        />
        <div className="space-y-1">
          <textarea
            value={addExplanation}
            onChange={e => setAddExplanation(e.target.value)}
            placeholder="Explanation — supports markdown&#10;**bold**  *italic*&#10;1. numbered list&#10;- bullet list"
            rows={7}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand resize-y"
          />
          <p className="text-xs text-gray-400">Formatting: <code className="bg-gray-100 px-1 rounded">**bold**</code> <code className="bg-gray-100 px-1 rounded">*italic*</code> <code className="bg-gray-100 px-1 rounded">1. list</code> <code className="bg-gray-100 px-1 rounded">- bullet</code></p>
        </div>
        <textarea
          value={addExamples}
          onChange={e => setAddExamples(e.target.value)}
          placeholder="Examples — one per line&#10;e.g. I have eaten lunch.&#10;She has lived here for 3 years."
          rows={4}
          className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand resize-y"
        />
        <Input
          value={addHint}
          onChange={e => setAddHint(e.target.value)}
          placeholder="Japanese note (optional) e.g. 「have + 過去分詞」の形です"
        />
        <button
          type="submit"
          disabled={saving || !addTitle.trim()}
          className="px-4 py-1.5 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Adding…' : '+ Add Slide'}
        </button>
      </form>

      {/* Slide list */}
      {slides.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No lesson slides yet. Add one above to teach this grammar point before practice.</p>
      ) : (
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
                    placeholder="Examples (one per line)"
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
  const [suggestingCategories, setSuggestingCategories] = useState(false)
  // Add form
  const [addSentence, setAddSentence] = useState('')
  const [addAnswer, setAddAnswer] = useState('')
  const [addHint, setAddHint] = useState('')
  const [addDistractors, setAddDistractors] = useState('')
  const [addCategory, setAddCategory] = useState('')
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
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + 5, start + 5)
    })
  }

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({ sentence: '', answer: '', hint: '', distractors: '', category: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  // JSON import
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importing, setImporting] = useState(false)

  type ImportRow = {
    point: string
    explanation: string
    sentence: string
    sentence_ja?: string
    answer: string
    hint?: string
    distractors?: string[]
    category?: string
    examples?: string[]
  }

  function parseImport(): { rows: ImportRow[]; error: string | null } {
    try {
      const parsed = JSON.parse(importJson)
      if (!Array.isArray(parsed)) return { rows: [], error: 'Must be a JSON array [ ... ]' }
      const rows: ImportRow[] = []
      for (let i = 0; i < parsed.length; i++) {
        const r = parsed[i]
        if (!r.point) return { rows: [], error: `Item ${i + 1} missing "point" (grammar rule title)` }
        if (!r.sentence) return { rows: [], error: `Item ${i + 1} missing "sentence"` }
        if (!r.answer) return { rows: [], error: `Item ${i + 1} missing "answer"` }
        if (!String(r.sentence).includes('_____')) return { rows: [], error: `Item ${i + 1} "sentence" must contain _____ (5 underscores)` }
        rows.push({
          point: String(r.point),
          explanation: r.explanation ? String(r.explanation) : '',
          sentence: String(r.sentence),
          sentence_ja: r.sentence_ja ? String(r.sentence_ja) : undefined,
          answer: String(r.answer),
          hint: r.hint ? String(r.hint) : undefined,
          distractors: Array.isArray(r.distractors) ? r.distractors.map(String) : [],
          category: r.category ? String(r.category) : undefined,
          examples: Array.isArray(r.examples) ? r.examples.map(String) : [],
        })
      }
      return { rows, error: null }
    } catch {
      return { rows: [], error: 'Invalid JSON — check for missing commas or brackets' }
    }
  }

  async function handleImport() {
    const { rows, error } = parseImport()
    if (error) { toast.error(error); return }
    if (rows.length === 0) { toast.error('No items found in JSON.'); return }
    setImporting(true)
    let added = 0
    for (const r of rows) {
      const { error: err } = await addPointToDeck(deck.id, {
        point: r.point,
        explanation: r.explanation,
        examples: r.examples ?? [],
        sentence_with_blank: r.sentence,
        sentence_ja: r.sentence_ja,
        answer: r.answer,
        hint_ja: r.hint,
        distractors: r.distractors ?? [],
        category: r.category,
      })
      if (!err) added++
    }
    const { deck: refreshed } = await getGrammarDeckWithPoints(deck.id)
    const newPoints = refreshed?.points ?? points
    setPoints(newPoints)

    setImporting(false)
    setShowImport(false)
    setImportJson('')
    onUpdated()
    toast.success(`Imported ${added} of ${rows.length} point${rows.length !== 1 ? 's' : ''}`)
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

  async function handleSuggestCategories(force = false) {
    const targets = force ? points : points.filter(p => !p.category)
    if (!targets.length) { toast.info('No questions in this deck'); return }
    setSuggestingCategories(true)
    try {
      const { data, error } = await supabase.functions.invoke('grammar-categorize', {
        body: {
          questions: targets.map(p => ({
            id: p.id,
            sentence_with_blank: p.sentence_with_blank ?? p.point,
            answer: p.answer ?? p.explanation,
            hint_ja: p.hint_ja,
          })),
        },
      })
      if (error) {
        let msg = error.message
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error } catch {}
        throw new Error(msg)
      }
      const categories: { id: string; category: string }[] = data.categories ?? []
      // Apply to grammar_deck_points
      await Promise.all(categories.map(({ id, category }) =>
        supabase.from('grammar_deck_points').update({ category }).eq('id', id)
      ))
      // Propagate to student grammar_bank entries from this deck
      setPoints(prev => prev.map(p => {
        const match = categories.find(c => c.id === p.id)
        return match ? { ...p, category: match.category } : p
      }))
      toast.success(`Categorized ${categories.length} question${categories.length !== 1 ? 's' : ''}`)
    } catch (e: any) {
      toast.error(`Failed: ${e?.message ?? String(e)}`)
    } finally {
      setSuggestingCategories(false)
    }
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
      point: sentence,
      explanation: answer,
      sentence_with_blank: sentence,
      answer,
      hint_ja: addHint.trim() || undefined,
      distractors,
      category: addCategory.trim() || undefined,
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    const { deck: refreshed } = await getGrammarDeckWithPoints(deck.id)
    setPoints(refreshed?.points ?? points)
    setAddSentence(''); setAddAnswer(''); setAddHint(''); setAddDistractors(''); setAddCategory('')
    onUpdated()
  }

  function startEdit(p: GrammarDeckPoint) {
    setEditingId(p.id)
    setEditFields({
      sentence: p.sentence_with_blank ?? p.point,
      answer: p.answer ?? p.explanation,
      hint: p.hint_ja ?? '',
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
          <div className="flex items-center gap-2 ml-4">
            {points.length > 0 && (
              <button
                onClick={() => handleSuggestCategories(true)}
                disabled={suggestingCategories}
                className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 shrink-0"
              >
                {suggestingCategories ? 'Categorizing…' : '✦ Auto-categorize all'}
              </button>
            )}
            <button aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
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
            <LessonSlidesTab deckId={deck.id} points={points} />
          ) : (
            <>
              {/* JSON Import */}
              {showImport ? (
                <div className="mb-4 space-y-3 bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Paste JSON to bulk import</p>
                    <button onClick={() => { setShowImport(false); setImportJson('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                  <p className="text-xs text-amber-700 font-mono bg-amber-100 rounded p-2 leading-relaxed whitespace-pre-wrap">{`[{
  "point": "Simple Present",
  "explanation": "Used for habits and facts.",
  "sentence": "She _____ every day.",
  "answer": "runs",
  "hint": "動詞（三単現）",
  "distractors": ["run", "ran", "running"],
  "category": "Verb Tenses",
  "examples": ["I eat breakfast every morning."]
}, ...]`}</p>
                  <textarea
                    autoFocus
                    value={importJson}
                    onChange={e => setImportJson(e.target.value)}
                    placeholder="Paste JSON array here…"
                    rows={6}
                    className="w-full text-xs font-mono border border-amber-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  />
                  {importJson.trim() && (() => {
                    const { rows, error } = parseImport()
                    return error
                      ? <p className="text-xs text-red-500">{error}</p>
                      : <p className="text-xs text-green-700">{rows.length} question{rows.length !== 1 ? 's' : ''} ready to import</p>
                  })()}
                  <button
                    onClick={handleImport}
                    disabled={importing || !importJson.trim()}
                    className="px-4 py-1.5 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : 'Import All'}
                  </button>
                </div>
              ) : null}

              {/* Add form */}
              <form onSubmit={handleAdd} className="space-y-2 mb-4 bg-gray-50 rounded-xl p-4 border">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add Question</p>
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
                <div className="grid grid-cols-2 gap-2">
                  <Input value={addDistractors} onChange={e => setAddDistractors(e.target.value)} placeholder="Wrong choices (comma-separated)" />
                  <Input value={addCategory} onChange={e => setAddCategory(e.target.value)} placeholder="Category e.g. Present Continuous" />
                </div>
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={saving || !addSentence.trim() || !addAnswer.trim()} className="px-4 py-1.5 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50">
                    {saving ? 'Adding…' : '+ Add Question'}
                  </button>
                  <button type="button" onClick={() => setShowImport(v => !v)} className="px-4 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors text-gray-600">
                    {showImport ? 'Cancel import' : '↓ Import JSON'}
                  </button>
                </div>
              </form>

              {/* Point list — grouped by category */}
              {loading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
              ) : points.length === 0 ? (
                <p className="text-sm text-gray-400">No questions yet. Add some above.</p>
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
    const { count, error } = await assignGrammarDeckToStudent(deckId, studentId)
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
              <SortableDeckList
                decks={decks.map(d => ({
                  id: d.id,
                  name: d.name,
                  meta: `${d.point_count ?? 0} points`,
                  badge: assignedDeckIds.has(d.id) ? 'Assigned' : undefined,
                }))}
                onReorder={rows => {
                  const newOrder = rows.map(r => decks.find(d => d.id === r.id)!)
                  setDecks(newOrder)
                  reorderGrammarDecks(newOrder.map(d => d.id))
                }}
                renderActions={row => {
                  const deck = decks.find(d => d.id === row.id)!
                  const isAssigned = assignedDeckIds.has(row.id)
                  return (
                    <>
                      <button onClick={() => setEditingDeck(deck)} className="text-xs text-gray-400 hover:text-brand transition-colors">Edit</button>
                      {isAssigned ? (
                        <button onClick={() => handleRemoveDeck(row.id, row.name)} disabled={removingDeck === row.id} className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                          {removingDeck === row.id ? '…' : 'Unassign'}
                        </button>
                      ) : (
                        <button onClick={() => handleAssign(row.id)} disabled={assigning === row.id} className="text-xs text-brand hover:text-brand/80 transition-colors disabled:opacity-50">
                          {assigning === row.id ? '…' : 'Assign'}
                        </button>
                      )}
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
