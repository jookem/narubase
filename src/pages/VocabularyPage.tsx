import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { VocabularyFlashcard } from '@/components/lesson/VocabularyFlashcard'
import { StudySession } from '@/components/lesson/StudySession'
import { speak } from '@/lib/tts'
import { updateVocabMastery } from '@/lib/api/lessons'
import type { VocabularyBankEntry, MasteryLevel } from '@/lib/types/database'
import { PageError } from '@/components/shared/PageError'
import { VocabQuizGame } from '@/components/vocab/VocabQuizGame'

// ── Helpers ───────────────────────────────────────────────────────

function getStudyBatch<T>(arr: T[]): T[] {
  const size = parseInt(localStorage.getItem('study_size') ?? '20', 10)
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return size === 0 ? shuffled : shuffled.slice(0, size)
}

const MASTERY_COLORS = [
  'bg-gray-100 text-gray-500',
  'bg-yellow-100 text-yellow-700',
  'bg-brand-light text-brand-dark',
  'bg-green-100 text-green-700',
]
const MASTERY_LABELS_EN = ['New', 'Seen', 'Familiar', 'Mastered']

type DeckGroup = { deckId: string | null; deckName: string; words: VocabularyBankEntry[] }
type View = 'deck' | 'az'

// ── Compact A-Z row ───────────────────────────────────────────────

function VocabRow({ entry, onChanged }: { entry: VocabularyBankEntry; onChanged: () => void }) {
  const [mastery, setMastery] = useState(entry.mastery_level)

  async function cycle() {
    const next = ((mastery + 1) % 4) as MasteryLevel
    setMastery(next)
    await updateVocabMastery(entry.id, next)
    onChanged()
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <button
        onClick={() => speak(entry.word)}
        className="text-gray-300 hover:text-brand transition-colors shrink-0 text-base"
        title="Listen"
      >
        🔊
      </button>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-gray-900">{entry.word}</span>
        {entry.reading && <span className="text-xs text-gray-400 ml-1.5">({entry.reading})</span>}
        {entry.definition_en && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{entry.definition_en}</p>
        )}
      </div>
      <button
        onClick={cycle}
        className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${MASTERY_COLORS[mastery]}`}
        title="Tap to update mastery"
      >
        {MASTERY_LABELS_EN[mastery]}
      </button>
    </div>
  )
}

// ── Letter index bar ──────────────────────────────────────────────

function LetterIndex({ letters, onJump }: { letters: string[]; onJump: (l: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 py-2">
      {letters.map(l => (
        <button
          key={l}
          onClick={() => onJump(l)}
          className="w-7 h-7 text-xs font-bold rounded-md bg-gray-100 hover:bg-brand hover:text-white transition-colors"
        >
          {l}
        </button>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────

export function VocabularyPage() {
  const { user } = useAuth()
  const [vocab, setVocab] = useState<VocabularyBankEntry[]>([])
  const [deckNames, setDeckNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studyCards, setStudyCards] = useState<VocabularyBankEntry[] | null>(null)
  const [quizDeck, setQuizDeck] = useState<DeckGroup | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('az')
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  async function loadVocab() {
    if (!user) return
    try {
      const { data, error: err } = await supabase
        .from('vocabulary_bank')
        .select('*')
        .eq('student_id', user.id)
        .order('word', { ascending: true })
      if (err) throw err

      const entries = data ?? []
      setVocab(entries)

      const deckIds = [...new Set(entries.map(v => v.deck_id).filter(Boolean) as string[])]
      if (deckIds.length > 0) {
        const { data: decks } = await supabase
          .from('vocabulary_decks')
          .select('id, name')
          .in('id', deckIds)
        if (decks) {
          const map: Record<string, string> = {}
          for (const d of decks) map[d.id] = d.name
          setDeckNames(map)
        }
      }
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load vocabulary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadVocab() }, [user])

  if (error) return <PageError message={error} onRetry={loadVocab} />
  if (loading) return <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />

  const q = search.trim().toLowerCase()
  const filtered = q
    ? vocab.filter(v =>
        v.word?.toLowerCase().includes(q) ||
        v.definition_en?.toLowerCase().includes(q) ||
        v.definition_ja?.toLowerCase().includes(q)
      )
    : vocab

  const dueForReview = vocab.filter(v => {
    if (!v.next_review) return v.mastery_level < 3
    return new Date(v.next_review) <= new Date()
  })
  const sessionLimit = parseInt(localStorage.getItem('study_size') ?? '20', 10)
  const reviewCount = sessionLimit === 0 ? dueForReview.length : Math.min(sessionLimit, dueForReview.length)

  // ── A-Z grouping ───────────────────────────────────────────────
  const sorted = [...filtered].sort((a, b) => a.word.localeCompare(b.word))
  const letterMap: Record<string, VocabularyBankEntry[]> = {}
  for (const v of sorted) {
    const letter = v.word[0]?.toUpperCase().match(/[A-Z]/) ? v.word[0].toUpperCase() : '#'
    if (!letterMap[letter]) letterMap[letter] = []
    letterMap[letter].push(v)
  }
  const letters = Object.keys(letterMap).sort((a, b) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b))

  function jumpTo(letter: string) {
    sectionRefs.current[letter]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Deck grouping ──────────────────────────────────────────────
  const deckGroupMap = new Map<string | null, DeckGroup>()
  for (const v of filtered) {
    const dId = v.deck_id ?? null
    if (!deckGroupMap.has(dId)) {
      const deckName = dId ? (deckNames[dId] ?? 'Assigned Deck') : 'その他 / Other'
      deckGroupMap.set(dId, { deckId: dId, deckName, words: [] })
    }
    deckGroupMap.get(dId)!.words.push(v)
  }
  const deckGroups = [...deckGroupMap.values()].sort((a, b) => {
    if (a.deckId && !b.deckId) return -1
    if (!a.deckId && b.deckId) return 1
    return a.deckName.localeCompare(b.deckName)
  })

  return (
    <>
      {studyCards && (
        <StudySession
          cards={studyCards}
          onClose={() => setStudyCards(null)}
          onComplete={() => { setStudyCards(null); loadVocab() }}
        />
      )}
      {quizDeck && (
        <VocabQuizGame
          words={quizDeck.words}
          deckName={quizDeck.deckName}
          onClose={() => setQuizDeck(null)}
        />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold">単語 / Vocabulary</h1>
            <p className="text-gray-500 text-sm mt-1">
              {vocab.length}語 collected · {dueForReview.length} due for review
              {sessionLimit > 0 && dueForReview.length > sessionLimit ? ` (${sessionLimit} per session)` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {dueForReview.length > 0 && (
              <button
                onClick={() => setStudyCards(getStudyBatch(dueForReview))}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                復習 ({reviewCount})
              </button>
            )}
            {vocab.length > 0 && (
              <button
                onClick={() => setStudyCards(getStudyBatch(vocab))}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
              >
                全部学習
              </button>
            )}
          </div>
        </div>

        {/* Search + view toggle */}
        {vocab.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search words…"
              className="flex-1 min-w-0 sm:flex-none sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                onClick={() => setView('az')}
                className={`px-3 py-2 font-medium transition-colors ${view === 'az' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                A–Z
              </button>
              <button
                onClick={() => setView('deck')}
                className={`px-3 py-2 font-medium transition-colors ${view === 'deck' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                By Deck
              </button>
            </div>
          </div>
        )}

        {/* ── A-Z view ── */}
        {view === 'az' && vocab.length > 0 && (
          <>
            {!q && <LetterIndex letters={letters} onJump={jumpTo} />}

            {letters.length === 0 && q && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-gray-500">No words match "{search}"</p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-6">
              {letters.map(letter => (
                <section
                  key={letter}
                  ref={el => { sectionRefs.current[letter] = el }}
                  className="scroll-mt-20"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-bold text-brand w-7">{letter}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">{letterMap[letter].length}</span>
                  </div>
                  <Card>
                    <CardContent className="py-0 px-4">
                      {letterMap[letter].map(word => (
                        <VocabRow key={word.id} entry={word} onChanged={loadVocab} />
                      ))}
                    </CardContent>
                  </Card>
                </section>
              ))}
            </div>
          </>
        )}

        {/* ── Deck view ── */}
        {view === 'deck' && (
          <>
            {dueForReview.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-orange-600 uppercase tracking-wide">
                  復習が必要 / Review Due ({dueForReview.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {dueForReview.map(word => (
                    <VocabularyFlashcard key={word.id} entry={word} onMasteryChanged={loadVocab} />
                  ))}
                </div>
              </section>
            )}

            {deckGroups.map(({ deckId, deckName, words }) => (
              <section key={deckId ?? '__other__'} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                    {deckName} ({words.length})
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuizDeck({ deckId, deckName, words })}
                      className="text-xs text-purple-500 hover:text-purple-700 font-medium transition-colors"
                    >
                      📝 Quiz
                    </button>
                    <button
                      onClick={() => setStudyCards(getStudyBatch(words))}
                      className="text-xs text-gray-400 hover:text-brand transition-colors"
                    >
                      このデッキを学習 →
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {words.map(word => (
                    <VocabularyFlashcard key={word.id} entry={word} onMasteryChanged={loadVocab} />
                  ))}
                </div>
              </section>
            ))}

            {filtered.length === 0 && q && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-gray-500">No words match "{search}"</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {vocab.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">単語がまだありません。</p>
              <p className="text-sm text-gray-400 mt-1">Your teacher will add vocabulary words from your lessons here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
