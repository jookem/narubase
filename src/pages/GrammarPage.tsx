import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { listGrammar, listLessonSlides, type GrammarBankEntry, type GrammarLessonSlide } from '@/lib/api/grammar'
import { Card, CardContent } from '@/components/ui/card'
import { GrammarSession } from '@/components/grammar/GrammarSession'
import { GrammarLesson } from '@/components/grammar/GrammarLesson'
import { GrammarFlashcards } from '@/components/grammar/GrammarFlashcards'
import { PageError } from '@/components/shared/PageError'

type GrammarStage = 'lesson' | 'flashcards' | 'quiz'
type GrammarStudyState = {
  cards: GrammarBankEntry[]
  slides: GrammarLessonSlide[]
  deckName: string
  stage: GrammarStage
}


const MASTERY_LABELS = ['新しい', '見た', '覚えてる', 'マスター']
const MASTERY_LABELS_EN = ['New', 'Seen', 'Familiar', 'Mastered']
const MASTERY_COLORS = [
  'bg-gray-100 text-gray-500',
  'bg-yellow-100 text-yellow-700',
  'bg-brand-light text-brand-dark',
  'bg-green-100 text-green-700',
]

type View = 'category' | 'mastery'

export function GrammarPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<GrammarBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<GrammarStudyState | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('category')
  const [studySize, setStudySizeState] = useState(() =>
    parseInt(localStorage.getItem('study_size') ?? '20', 10)
  )
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  function setStudySize(val: number) {
    setStudySizeState(val)
    localStorage.setItem('study_size', String(val))
  }

  async function load() {
    if (!user) return
    try {
      const { entries: e, error: err } = await listGrammar(user.id)
      if (err) throw new Error(String(err))
      setEntries(e ?? [])
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load grammar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user])

  // Start a full study session: lesson → flashcards → quiz
  async function startStudy(cards: GrammarBankEntry[], skipLesson = false) {
    const deckIds = [...new Set(cards.map(c => c.deck_id).filter(Boolean))]
    let slides: GrammarLessonSlide[] = []
    let deckName = 'Grammar'

    if (!skipLesson && deckIds.length === 1) {
      const deckId = deckIds[0]!
      const result = await listLessonSlides(deckId)
      deckName = entries.find(e => e.deck_id === deckId)?.category ?? 'Grammar'

      if (result.slides && result.slides.length > 0) {
        const cardCategories = [...new Set(cards.map(c => c.category).filter(Boolean))]
        if (cardCategories.length === 1) {
          const match = result.slides.find(s => s.title.toLowerCase() === cardCategories[0]!.toLowerCase())
          slides = match ? [match] : result.slides
          deckName = cardCategories[0] ?? deckName
        } else {
          slides = result.slides
        }
      }
    }

    const stage: GrammarStage = slides.length > 0 ? 'lesson' : 'flashcards'
    setSession({ cards, slides, deckName, stage })
  }

  if (error) return <PageError message={error} onRetry={load} />
  if (loading) return <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />

  const q = search.trim().toLowerCase()
  const filtered = q
    ? entries.filter(e =>
        e.point?.toLowerCase().includes(q) ||
        e.explanation?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q)
      )
    : entries

  const due = entries.filter(e => {
    if (!e.next_review) return e.mastery_level < 3
    return new Date(e.next_review) <= new Date()
  })

  const sessionLimit = studySize
  const reviewCount = sessionLimit === 0 ? due.length : Math.min(sessionLimit, due.length)

  function getCategoryBatch(cards: GrammarBankEntry[]): GrammarBankEntry[] {
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    return sessionLimit === 0 ? shuffled : shuffled.slice(0, sessionLimit)
  }

  // All entries sharing the same category as a given card (for lesson → quiz flow)
  function categoryCards(e: GrammarBankEntry): GrammarBankEntry[] {
    if (!e.category) return [e]
    return entries.filter(c => c.category === e.category)
  }

  // ── By Category grouping ───────────────────────────────────────
  const categoryMap = new Map<string, GrammarBankEntry[]>()
  const uncategorized: GrammarBankEntry[] = []
  for (const e of filtered) {
    if (e.category) {
      if (!categoryMap.has(e.category)) categoryMap.set(e.category, [])
      categoryMap.get(e.category)!.push(e)
    } else {
      uncategorized.push(e)
    }
  }
  const categories = [...categoryMap.keys()].sort((a, b) => a.localeCompare(b))

  function jumpTo(cat: string) {
    sectionRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── By Mastery grouping ────────────────────────────────────────
  const byMastery = [0, 1, 2, 3].map(level => ({
    level,
    items: filtered.filter(e => e.mastery_level === level),
  }))

  return (
    <>
      {session?.stage === 'lesson' && (
        <GrammarLesson
          slides={session.slides}
          deckName={session.deckName}
          initialIndex={0}
          onComplete={() => setSession(s => s && { ...s, stage: 'flashcards' })}
          onClose={() => setSession(null)}
        />
      )}

      {session?.stage === 'flashcards' && (
        <GrammarFlashcards
          cards={session.cards}
          onComplete={() => setSession(s => s && { ...s, stage: 'quiz' })}
          onClose={() => setSession(null)}
        />
      )}

      {session?.stage === 'quiz' && (
        <GrammarSession
          cards={session.cards}
          onClose={() => setSession(null)}
          onComplete={() => { setSession(null); load() }}
        />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold">文法 / Grammar</h1>
            <p className="text-gray-500 text-sm mt-1">
              {entries.length}点 collected · {due.length} due for review{sessionLimit > 0 && due.length > sessionLimit ? ` (${sessionLimit} per session)` : ''}
            </p>
          </div>
          {entries.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {due.length > 0 && (
                <button
                  onClick={() => startStudy(getCategoryBatch(due), true)}
                  className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  復習 ({reviewCount})
                </button>
              )}
              <button
                onClick={() => startStudy(getCategoryBatch(entries))}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
              >
                全部学習
              </button>
              <div className="flex gap-1.5 ml-auto">
                {[10, 20, 30, 0].map(val => (
                  <button
                    key={val}
                    onClick={() => setStudySize(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      studySize === val
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-brand/50'
                    }`}
                  >
                    {val === 0 ? 'All' : val}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search + view toggle */}
        {entries.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search grammar points…"
              className="flex-1 min-w-0 sm:flex-none sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                onClick={() => setView('category')}
                className={`px-3 py-2 font-medium transition-colors ${view === 'category' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                By Topic
              </button>
              <button
                onClick={() => setView('mastery')}
                className={`px-3 py-2 font-medium transition-colors ${view === 'mastery' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                By Mastery
              </button>
            </div>
          </div>
        )}

        {/* ── By Category view ── */}
        {view === 'category' && entries.length > 0 && (
          <>
            {/* Category pill nav */}
            {!q && categories.length > 1 && (
              <div className="flex flex-wrap gap-1.5 py-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => jumpTo(cat)}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                  >
                    {cat}
                  </button>
                ))}
                {uncategorized.length > 0 && (
                  <button
                    onClick={() => jumpTo('__other__')}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    Other
                  </button>
                )}
              </div>
            )}

            {filtered.length === 0 && q && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-gray-500">No grammar points match "{search}"</p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-6">
              {categories.map(cat => (
                <section
                  key={cat}
                  ref={el => { sectionRefs.current[cat] = el }}
                  className="scroll-mt-20 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wide">{cat}</h2>
                      <span className="text-xs text-gray-400">{categoryMap.get(cat)!.length}</span>
                    </div>
                    {(() => {
                      const all = categoryMap.get(cat)!
                      const isCapped = sessionLimit > 0 && all.length > sessionLimit
                      return (
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => startStudy(getCategoryBatch(all), true)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            フラッシュカード
                          </button>
                          <button
                            onClick={() => startStudy(getCategoryBatch(all))}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors"
                          >
                            {isCapped ? `📖 学習 (${sessionLimit}/${all.length}) →` : '📖 学習 →'}
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categoryMap.get(cat)!.map(e => (
                      <GrammarCard key={e.id} entry={e} onStudy={() => startStudy([e], true)} onLesson={() => startStudy(categoryMap.get(cat)!)} />
                    ))}
                  </div>
                </section>
              ))}

              {uncategorized.length > 0 && (
                <section
                  ref={el => { sectionRefs.current['__other__'] = el }}
                  className="scroll-mt-20 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Other</h2>
                      <span className="text-xs text-gray-400">{uncategorized.length}</span>
                    </div>
                    {(() => {
                      const isCapped = sessionLimit > 0 && uncategorized.length > sessionLimit
                      return (
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => startStudy(getCategoryBatch(uncategorized), true)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            フラッシュカード
                          </button>
                          <button
                            onClick={() => startStudy(getCategoryBatch(uncategorized))}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors"
                          >
                            {isCapped ? `📖 学習 (${sessionLimit}/${uncategorized.length}) →` : '📖 学習 →'}
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {uncategorized.map(e => (
                      <GrammarCard key={e.id} entry={e} onStudy={() => startStudy([e], true)} onLesson={() => startStudy(uncategorized)} />
                    ))}
                  </div>
                </section>
              )}

              {/* If everything is uncategorized, just show them all without "Other" header */}
              {categories.length === 0 && uncategorized.length > 0 && filtered.length > 0 && !q && (
                <p className="text-xs text-gray-400 text-center py-2">
                  No categories set yet — your teacher can add them from the lesson or student page.
                </p>
              )}
            </div>
          </>
        )}

        {/* ── By Mastery view ── */}
        {view === 'mastery' && entries.length > 0 && (
          <>
            {due.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-orange-600 uppercase tracking-wide">
                  復習が必要 / Review Due ({due.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {due.map(e => <GrammarCard key={e.id} entry={e} onStudy={() => startStudy([e], true)} onLesson={() => startStudy(categoryCards(e))} />)}
                </div>
              </section>
            )}

            {byMastery.map(({ level, items }) =>
              items.length === 0 ? null : (
                <section key={level} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      {MASTERY_LABELS[level]} / {MASTERY_LABELS_EN[level]} ({items.length})
                    </h2>
                    {(() => {
                      const isCapped = sessionLimit > 0 && items.length > sessionLimit
                      return (
                        <button
                          onClick={() => startStudy(getCategoryBatch(items))}
                          className="text-xs text-gray-400 hover:text-brand transition-colors"
                        >
                          {isCapped ? `Study (${sessionLimit}/${items.length}) →` : 'Study this group →'}
                        </button>
                      )
                    })()}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map(e => <GrammarCard key={e.id} entry={e} onStudy={() => startStudy([e], true)} onLesson={() => startStudy(categoryCards(e))} />)}
                  </div>
                </section>
              )
            )}

            {filtered.length === 0 && q && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-gray-500">No grammar points match "{search}"</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {entries.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <p className="text-4xl">📖</p>
              <p className="text-gray-600 font-medium">文法がまだありません。</p>
              <p className="text-sm text-gray-400">Your teacher will add grammar points from your lessons here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function GrammarCard({ entry, onStudy, onLesson }: { entry: GrammarBankEntry; onStudy: () => void; onLesson: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-lg font-bold text-gray-900">{entry.point}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${MASTERY_COLORS[entry.mastery_level]}`}>
            {MASTERY_LABELS_EN[entry.mastery_level]}
          </span>
        </div>
        <p className="text-sm text-gray-600">{entry.explanation}</p>
        {entry.examples.length > 0 && (
          <p className="text-xs text-gray-400 italic">"{entry.examples[0]}"</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <button onClick={onLesson} className="text-xs text-brand hover:text-brand/80 transition-colors">
            Learn →
          </button>
          <button onClick={onStudy} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Practice
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
