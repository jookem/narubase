import { useEffect, useState } from 'react'
import nlp from 'compromise'
import {
  listPuzzleDecks, createPuzzleDeck, deletePuzzleDeck, renamePuzzleDeck,
  getPuzzleDeckWithPuzzles, createPuzzle, updatePuzzle, deletePuzzle,
  assignPuzzleDeckToStudent, removePuzzleDeckFromStudent, getAssignedDeckIds,
  reorderPuzzleDecks,
  updatePuzzleDeckFolder,
  type PuzzleDeck, type Puzzle, type PuzzlePart,
} from '@/lib/api/puzzles'
import { FolderDeckList } from '@/components/shared/FolderDeckList'
import { listGrammarDecks, getGrammarDeckWithPoints, type GrammarDeck } from '@/lib/api/grammar'
import { listDecks, getDeckWithWords, type Deck } from '@/lib/api/lessons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

// ── Parts of speech ───────────────────────────────────────────

const LABELS = [
  'Noun', 'Pronoun', 'Verb', 'Auxiliary', 'Modal',
  'Adjective', 'Adverb', 'Article', 'Determiner',
  'Preposition', 'Conjunction', 'Interjection', 'Interrogative',
  'Numeral', 'Particle', 'Infinitive',
  'Subject', 'Object', 'Complement', 'Other',
]

const LABEL_COLORS: Record<string, string> = {
  Noun:          'bg-blue-100 text-blue-700',
  Pronoun:       'bg-sky-100 text-sky-700',
  Verb:          'bg-red-100 text-red-700',
  Auxiliary:     'bg-emerald-100 text-emerald-700',
  Modal:         'bg-violet-100 text-violet-700',
  Adjective:     'bg-purple-100 text-purple-700',
  Adverb:        'bg-orange-100 text-orange-700',
  Article:       'bg-amber-100 text-amber-700',
  Determiner:    'bg-lime-100 text-lime-700',
  Preposition:   'bg-teal-100 text-teal-700',
  Conjunction:   'bg-yellow-100 text-yellow-700',
  Interjection:  'bg-rose-100 text-rose-700',
  Interrogative: 'bg-cyan-100 text-cyan-700',
  Numeral:       'bg-fuchsia-100 text-fuchsia-700',
  Particle:      'bg-slate-100 text-slate-600',
  Infinitive:    'bg-stone-100 text-stone-600',
  Subject:       'bg-indigo-100 text-indigo-700',
  Object:        'bg-green-100 text-green-700',
  Complement:    'bg-pink-100 text-pink-700',
  Other:         'bg-gray-100 text-gray-600',
}

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

function termToLabel(term: any): string {
  const t = term.text('trim').toLowerCase()
  // Articles — check text directly since compromise folds them into Determiner
  if (t === 'a' || t === 'an' || t === 'the') return 'Article'
  // Interrogatives (who, what, where, when, why, how, which)
  if (term.has('#QuestionWord')) return 'Interrogative'
  // Pronouns before modals so "I/you/he" isn't mis-tagged
  if (term.has('#Pronoun')) return 'Pronoun'
  // Modal verbs (can, could, will, would, should, may, might, must)
  if (term.has('#Modal')) return 'Modal'
  // Auxiliary / copula (be, have, do and their forms)
  if (term.has('#Auxiliary') || term.has('#Copula')) return 'Auxiliary'
  if (term.has('#Verb')) return 'Verb'
  if (term.has('#Adjective')) return 'Adjective'
  if (term.has('#Adverb')) return 'Adverb'
  if (term.has('#Determiner')) return 'Determiner'
  if (term.has('#Preposition')) return 'Preposition'
  if (term.has('#Conjunction')) return 'Conjunction'
  if (term.has('#Ordinal') || term.has('#Cardinal')) return 'Numeral'
  if (term.has('#Noun') || term.has('#ProperNoun')) return 'Noun'
  return 'Other'
}

async function translateAndParse(
  text: string,
): Promise<{ english: string; japanese: string | null; parts: PuzzlePart[] }> {
  let english = text.trim()
  let japanese: string | null = null

  function isMyMemoryError(text: string | null | undefined): boolean {
    return typeof text === 'string' && (text.includes('MYMEMORY WARNING') || text.includes('YOU USED ALL AVAILABLE'))
  }

  if (isJapanese(text)) {
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ja|en`,
      )
      const json = await res.json()
      const translated = json.responseStatus === 200 ? json.responseData?.translatedText : null
      if (translated && !isMyMemoryError(translated)) english = translated
    } catch { /* keep original text */ }
  } else {
    // Translate English → Japanese for the hint
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(english)}&langpair=en|ja`,
      )
      const json = await res.json()
      const translated = json.responseStatus === 200 ? json.responseData?.translatedText : null
      if (translated && !isMyMemoryError(translated)) japanese = translated
    } catch { /* no hint if translation fails */ }
  }

  const doc = nlp(english)
  const parts: PuzzlePart[] = []
  doc.terms().forEach((term: any) => {
    const t = term.text('trim')
    if (t) parts.push({ text: t, label: termToLabel(term) })
  })

  return { english, japanese, parts }
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
        if (pt.sentence_with_blank && pt.answer) {
          // Fill-in-the-blank format: fill the blank to get a complete sentence
          const s = pt.sentence_with_blank.replace('_____', pt.answer).trim()
          if (s) sentences.push({ sentence: s, hint: pt.hint_ja ?? pt.point })
        } else {
          // Legacy format: no sentence_with_blank — use examples array instead
          for (const ex of (pt.examples ?? [])) {
            const s = ex.split('\n')[0].trim()  // English line only
            if (s) sentences.push({ sentence: s, hint: pt.point })
          }
        }
      }
    }

    // Collect from vocabulary deck
    if (selectedVocab) {
      const { deck: vd } = await getDeckWithWords(selectedVocab)
      for (const w of vd?.words ?? []) {
        const s = (w.quiz_sentence && w.quiz_answer)
          ? w.quiz_sentence.replace('_____', w.quiz_answer).trim()
          : w.example?.trim() || stripHtml(w.definition_en) || stripHtml(w.definition_ja)
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

    // Translate + parse each sentence — same flow as manual input
    let created = 0
    for (const { sentence, hint } of toCreate) {
      try {
        const { english, japanese, parts } = await translateAndParse(sentence)
        if (parts.length < 2) continue
        const { puzzle, error } = await createPuzzle(deck.id, {
          japanese_sentence: isJapanese(sentence) ? sentence : (japanese ?? sentence),
          hint: english,
          parts,
        })
        if (!error && puzzle) {
          setPuzzles(prev => [...prev, puzzle])
          created++
        }
      } catch { /* skip sentences that fail translation */ }
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
      const { english, japanese, parts } = await translateAndParse(s)
      if (parts.length < 2) { toast.error('Need at least 2 words after translation.'); return }
      const { puzzle, error } = await createPuzzle(deck.id, {
        // Student always sees Japanese — use input directly if Japanese, otherwise use translation
        japanese_sentence: isJapanese(s) ? s : (japanese ?? s),
        // Hint is always the English sentence — teacher can override with manualHint
        hint: manualHint.trim() || english,
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

  // ── Inline edit state ─────────────────────────────────────────
  const [editingPuzzleId, setEditingPuzzleId] = useState<string | null>(null)
  const [editParts, setEditParts] = useState<PuzzlePart[]>([])
  const [editHint, setEditHint] = useState('')
  const [editJapaneseSentence, setEditJapaneseSentence] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [translatingMissing, setTranslatingMissing] = useState(false)
  const [translateProgress, setTranslateProgress] = useState('')

  function startEditPuzzle(p: Puzzle) {
    setEditingPuzzleId(p.id)
    setEditParts(p.parts.map(pt => ({ ...pt })))
    setEditHint(p.hint ?? '')
    setEditJapaneseSentence(p.japanese_sentence ?? '')
  }

  function updateEditPart(i: number, field: keyof PuzzlePart, val: string) {
    setEditParts(prev => prev.map((pt, idx) => idx === i ? { ...pt, [field]: val } : pt))
  }

  function removeEditPart(i: number) {
    setEditParts(prev => prev.filter((_, idx) => idx !== i))
  }

  function moveEditPart(i: number, dir: -1 | 1) {
    setEditParts(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function addEditPart() {
    setEditParts(prev => [...prev, { text: '', label: 'Other' }])
  }

  async function saveEditPuzzle(puzzleId: string) {
    const valid = editParts.filter(p => p.text.trim())
    if (valid.length < 2) { toast.error('Need at least 2 parts.'); return }
    setSavingEdit(true)
    const jaVal = editJapaneseSentence.trim() || undefined
    const { error } = await updatePuzzle(puzzleId, {
      japanese_sentence: jaVal,
      hint: editHint.trim() || undefined,
      parts: valid,
    })
    setSavingEdit(false)
    if (error) { toast.error(error); return }
    setPuzzles(prev => prev.map(p => p.id === puzzleId
      ? { ...p, parts: valid, hint: editHint.trim() || null, japanese_sentence: jaVal ?? p.japanese_sentence }
      : p
    ))
    setEditingPuzzleId(null)
    onUpdated()
  }

  function isBadSentence(s: string | null | undefined): boolean {
    return !s || s.includes('MYMEMORY WARNING') || s.includes('YOU USED ALL AVAILABLE')
  }

  async function handleTranslateMissing() {
    const missing = puzzles.filter(p => isBadSentence(p.japanese_sentence) && p.hint)
    if (!missing.length) { toast.info('No missing translations found.'); return }
    setTranslatingMissing(true)
    let done = 0
    for (const p of missing) {
      setTranslateProgress(`Translating ${done + 1} / ${missing.length}…`)
      try {
        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(p.hint!)}&langpair=en|ja`,
        )
        const json = await res.json()
        const translated = json.responseStatus === 200 ? json.responseData?.translatedText : null
        if (translated && !translated.includes('MYMEMORY WARNING')) {
          await updatePuzzle(p.id, { japanese_sentence: translated })
          setPuzzles(prev => prev.map(x => x.id === p.id ? { ...x, japanese_sentence: translated } : x))
        }
      } catch { /* skip on error */ }
      done++
      // Small delay to avoid hammering the API
      await new Promise(r => setTimeout(r, 300))
    }
    setTranslatingMissing(false)
    setTranslateProgress('')
    toast.success(`Done — ${done} sentence${done !== 1 ? 's' : ''} processed.`)
    onUpdated()
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit puzzle deck" className="fixed z-50 bg-black/60 flex items-center justify-center p-4" style={{ top: 0, left: 0, width: '100vw', height: '100vh', minHeight: '-webkit-fill-available' }}>
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
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {puzzles.some(p => isBadSentence(p.japanese_sentence) && p.hint) && (
              <button
                onClick={handleTranslateMissing}
                disabled={translatingMissing}
                className="px-3 py-1.5 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {translatingMissing ? translateProgress : '🌐 Translate missing'}
              </button>
            )}
            <button aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
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
                <div key={p.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  {editingPuzzleId === p.id ? (
                    /* ── Edit mode ── */
                    <div className="p-3 space-y-2 bg-gray-50">
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Japanese sentence (shown to student)</label>
                        <input
                          value={editJapaneseSentence}
                          onChange={e => setEditJapaneseSentence(e.target.value)}
                          placeholder="Japanese translation…"
                          className="w-full h-8 text-sm border border-gray-200 rounded px-2 bg-white mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Word order (drag ↑↓ to reorder)</label>
                      </div>
                      <div className="space-y-1.5">
                        {editParts.map((pt, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div className="flex flex-col gap-0">
                              <button onClick={() => moveEditPart(i, -1)} disabled={i === 0}
                                className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs px-0.5" title="Move up">▲</button>
                              <button onClick={() => moveEditPart(i, 1)} disabled={i === editParts.length - 1}
                                className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs px-0.5" title="Move down">▼</button>
                            </div>
                            <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                            <input
                              value={pt.text}
                              onChange={e => updateEditPart(i, 'text', e.target.value)}
                              placeholder="word"
                              className="flex-1 h-7 text-xs border border-gray-200 rounded px-2 bg-white"
                            />
                            <select
                              value={pt.label}
                              onChange={e => updateEditPart(i, 'label', e.target.value)}
                              className="h-7 text-xs border border-gray-200 rounded px-1 bg-white"
                            >
                              {LABELS.map(l => <option key={l}>{l}</option>)}
                            </select>
                            <button
                              onClick={() => removeEditPart(i)}
                              disabled={editParts.length <= 2}
                              className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-20 text-sm leading-none px-0.5"
                              title="Remove word"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={addEditPart}
                          className="text-xs text-brand hover:text-brand/80 transition-colors mt-1"
                        >
                          + Add word
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={editHint}
                          onChange={e => setEditHint(e.target.value)}
                          placeholder="Hint (optional)"
                          className="flex-1 h-7 text-xs border border-gray-200 rounded px-2 bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEditPuzzle(p.id)} disabled={savingEdit}
                          className="px-3 py-1 bg-brand text-white text-xs rounded-md disabled:opacity-50">
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingPuzzleId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    <div className="flex items-start gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{p.japanese_sentence}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.parts.map((pt, i) => (
                            <span key={i} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${LABEL_COLORS[pt.label] ?? LABEL_COLORS.Other}`}>
                              {pt.text}
                              <span className="opacity-50 ml-0.5 text-[10px]">({pt.label})</span>
                            </span>
                          ))}
                        </div>
                        {p.hint && <p className="text-xs text-gray-400 italic mt-1">💡 {p.hint}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0 mt-0.5">
                        <button onClick={() => startEditPuzzle(p)} className="text-xs text-gray-400 hover:text-brand transition-colors">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                          className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                          {deleting === p.id ? '…' : 'Delete'}
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
    if (!confirm(`Unassign deck "${deckName}" from this student?`)) return
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
              <FolderDeckList
                storageKey="puzzle-decks"
                decks={decks.map(d => ({
                  id: d.id,
                  name: d.name,
                  folder: d.folder,
                  meta: `${d.puzzle_count ?? 0} puzzles`,
                  badge: assignedIds.has(d.id) ? 'Assigned' : undefined,
                }))}
                onReorder={rows => {
                  const newOrder = rows.map(r => decks.find(d => d.id === r.id)!)
                  setDecks(newOrder)
                  reorderPuzzleDecks(newOrder.map(d => d.id))
                }}
                onMoveToFolder={async (id, folder) => {
                  const { error } = await updatePuzzleDeckFolder(id, folder)
                  if (!error) setDecks(prev => prev.map(d => d.id === id ? { ...d, folder } : d))
                }}
                renderActions={row => {
                  const deck = decks.find(d => d.id === row.id)!
                  const isAssigned = assignedIds.has(row.id)
                  return (
                    <>
                      <button onClick={() => setEditingDeck(deck)} className="text-xs text-gray-400 hover:text-brand transition-colors">Edit</button>
                      {isAssigned ? (
                        <button onClick={() => handleRemove(row.id, row.name)} disabled={removing === row.id} className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                          {removing === row.id ? '…' : 'Unassign'}
                        </button>
                      ) : (
                        <button onClick={() => handleAssign(row.id)} disabled={assigning === row.id} className="text-xs text-brand hover:text-brand/80 transition-colors disabled:opacity-50">
                          {assigning === row.id ? '…' : 'Assign'}
                        </button>
                      )}
                      <button onClick={() => handleDelete(row.id, row.name)} disabled={deleting === row.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
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
