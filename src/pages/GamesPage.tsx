import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  getAssignedDecksWithPuzzles,
  getStudentProgress,
  type PuzzleDeck,
  type Puzzle,
  type PuzzleProgress,
} from '@/lib/api/puzzles'
import { Card, CardContent } from '@/components/ui/card'
import { TrainPuzzle } from '@/components/puzzle/TrainPuzzle'
import { SpellingGame } from '@/components/spelling/SpellingGame'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'
import { PictureDescription } from '@/components/eiken/PictureDescription'
import type { VocabularyBankEntry } from '@/lib/types/database'

// ── Types ─────────────────────────────────────────────────────────

type DeckWithPuzzles = PuzzleDeck & { puzzles: Puzzle[] }

type SpellingDeck = {
  deckId: string
  deckName: string
  words: VocabularyBankEntry[]
}

// ── Helpers ───────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function getStudyBatch<T>(arr: T[]): T[] {
  const size = parseInt(localStorage.getItem('study_size') ?? '20', 10)
  const shuffled = shuffle(arr)
  return size === 0 ? shuffled : shuffled.slice(0, size)
}

function getSpellingBatch(words: VocabularyBankEntry[]): VocabularyBankEntry[] {
  const eligible = words.filter(w => w.word.trim().length >= 2)
  const size = parseInt(localStorage.getItem('study_size') ?? '20', 10)
  const shuffled = shuffle(eligible)
  return size === 0 ? shuffled : shuffled.slice(0, size)
}

// ── Tab button ─────────────────────────────────────────────────────

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-800'
      }`}
    >
      {label}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────

export function GamesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'train' | 'spelling' | 'picture'>('train')

  // ── Train state ────────────────────────────────────────────────
  const [trainDecks, setTrainDecks] = useState<DeckWithPuzzles[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, PuzzleProgress>>({})
  const [trainLoading, setTrainLoading] = useState(true)
  const [activePuzzles, setActivePuzzles] = useState<Puzzle[] | null>(null)
  const [puzzleIdx, setPuzzleIdx] = useState(0)
  const [trainDone, setTrainDone] = useState(false)

  // ── Spelling state ─────────────────────────────────────────────
  const [spellingDecks, setSpellingDecks] = useState<SpellingDeck[]>([])
  const [spellingLoading, setSpellingLoading] = useState(true)
  const [activeSpellingWords, setActiveSpellingWords] = useState<VocabularyBankEntry[] | null>(null)
  const [spellingDone, setSpellingDone] = useState(false)

  // ── Load train data ────────────────────────────────────────────

  async function loadTrain() {
    if (!user) return
    const { decks: d } = await getAssignedDecksWithPuzzles(user.id)
    setTrainDecks(d ?? [])
    const allProgress: Record<string, PuzzleProgress> = {}
    for (const deck of d ?? []) {
      const { progress } = await getStudentProgress(user.id, deck.id)
      for (const p of progress ?? []) allProgress[p.puzzle_id] = p
    }
    setProgressMap(allProgress)
    setTrainLoading(false)
  }

  // ── Load spelling data ─────────────────────────────────────────

  async function loadSpelling() {
    if (!user) return

    // Join vocabulary_bank with vocabulary_decks to get deck name in one query
    const { data } = await supabase
      .from('vocabulary_bank')
      .select('*, deck:vocabulary_decks!deck_id(name)')
      .eq('student_id', user.id)
      .not('deck_id', 'is', null)
      .order('created_at', { ascending: false })

    const entries = (data ?? []) as (VocabularyBankEntry & { deck?: { name: string } | null })[]

    // Group by deck_id — only words that belong to an assigned deck
    const grouped: Record<string, SpellingDeck> = {}
    for (const entry of entries) {
      const key = entry.deck_id!
      if (!grouped[key]) {
        grouped[key] = {
          deckId: key,
          deckName: entry.deck?.name ?? 'Vocabulary Deck',
          words: [],
        }
      }
      grouped[key].words.push(entry)
    }

    // Only show decks that have at least one spellable word (2+ letters)
    const decks = Object.values(grouped).filter(g =>
      g.words.some(w => w.word.trim().length >= 2)
    )

    setSpellingDecks(decks)
    setSpellingLoading(false)
  }

  useEffect(() => { loadTrain(); loadSpelling() }, [user])

  // ── Train handlers ─────────────────────────────────────────────

  function startTrainDeck(deck: DeckWithPuzzles, onlyIncomplete = false) {
    let puzzles = deck.puzzles
    if (onlyIncomplete) puzzles = puzzles.filter(p => !progressMap[p.id]?.completed)
    if (!puzzles.length) return
    setActivePuzzles(getStudyBatch(puzzles))
    setPuzzleIdx(0)
    setTrainDone(false)
  }

  function handleTrainNext() {
    if (!activePuzzles) return
    if (puzzleIdx + 1 >= activePuzzles.length) setTrainDone(true)
    else setPuzzleIdx(i => i + 1)
  }

  function handleTrainClose() {
    setActivePuzzles(null)
    setTrainDone(false)
    loadTrain()
  }

  // ── Spelling handlers ──────────────────────────────────────────

  function startSpellingDeck(deck: SpellingDeck) {
    const batch = getSpellingBatch(deck.words)
    if (!batch.length) return
    setActiveSpellingWords(batch)
    setSpellingDone(false)
  }

  function handleSpellingClose() {
    setActiveSpellingWords(null)
    setSpellingDone(false)
  }

  // ── Full-screen overlays ───────────────────────────────────────

  if (activePuzzles && !trainDone) {
    return (
      <TrainPuzzle
        puzzle={activePuzzles[puzzleIdx]}
        puzzleNumber={puzzleIdx + 1}
        total={activePuzzles.length}
        isLast={puzzleIdx + 1 >= activePuzzles.length}
        onNext={handleTrainNext}
        onClose={handleTrainClose}
      />
    )
  }

  if (trainDone && activePuzzles) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title="All Aboard! 🚉"
          subtitle={`You completed ${activePuzzles.length} puzzle${activePuzzles.length !== 1 ? 's' : ''}`}
          onClose={handleTrainClose}
          closeLabel="Back to Games"
        />
      </div>
    )
  }

  if (activeSpellingWords && !spellingDone) {
    return (
      <SpellingGame
        words={activeSpellingWords}
        onClose={handleSpellingClose}
        onComplete={() => setSpellingDone(true)}
      />
    )
  }

  if (spellingDone && activeSpellingWords) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title="スペリング完了！ 🎉"
          subtitle={`You practiced ${activeSpellingWords.length} word${activeSpellingWords.length !== 1 ? 's' : ''}`}
          onClose={handleSpellingClose}
          closeLabel="Back to Games"
        />
      </div>
    )
  }

  // ── Hub UI ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">🎮 ゲーム / Games</h1>
        <p className="text-gray-500 text-sm mt-1">英語を楽しく練習しよう</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <Tab label="🚂 Train" active={tab === 'train'} onClick={() => setTab('train')} />
        <Tab label="🔤 Spelling" active={tab === 'spelling'} onClick={() => setTab('spelling')} />
        <Tab label="🖼️ Picture" active={tab === 'picture'} onClick={() => setTab('picture')} />
      </div>

      {/* ── Train tab ── */}
      {tab === 'train' && (
        trainLoading ? (
          <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
        ) : trainDecks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-4xl mb-3">🚂</p>
              <p className="text-gray-500">パズルデッキがまだありません。</p>
              <p className="text-sm text-gray-400 mt-1">Your teacher will assign puzzle decks here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {trainDecks.map(deck => {
              const total = deck.puzzles.length
              const completed = deck.puzzles.filter(p => progressMap[p.id]?.completed).length
              const incomplete = total - completed
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0
              const sessionLimit = parseInt(localStorage.getItem('study_size') ?? '20', 10)
              const reviewCount = sessionLimit === 0 ? incomplete : Math.min(sessionLimit, incomplete)

              return (
                <Card key={deck.id}>
                  <CardContent className="py-4 space-y-3">
                    <div>
                      <h2 className="font-semibold text-gray-900">{deck.name}</h2>
                      <p className="text-sm text-gray-500">{total}問 · {completed}問クリア</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {incomplete > 0 && (
                        <button
                          onClick={() => startTrainDeck(deck, true)}
                          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                        >
                          復習 ({reviewCount})
                        </button>
                      )}
                      <button
                        onClick={() => startTrainDeck(deck, false)}
                        className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
                      >
                        全部学習
                      </button>
                    </div>
                    {total > 0 && (
                      <div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{pct}% クリア</p>
                      </div>
                    )}
                    {deck.puzzles.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {deck.puzzles.map(p => {
                          const prog = progressMap[p.id]
                          return (
                            <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                              <span className={`text-base ${prog?.completed ? 'opacity-100' : 'opacity-20'}`}>
                                {prog?.completed ? '✅' : '⬜'}
                              </span>
                              <span className={`flex-1 ${prog?.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                {p.japanese_sentence}
                              </span>
                              {prog && !prog.completed && (
                                <span className="text-xs text-gray-400">{prog.attempts} attempt{prog.attempts !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      )}

      {/* ── Picture tab ── */}
      {tab === 'picture' && <PictureDescription />}

      {/* ── Spelling tab ── */}
      {tab === 'spelling' && (
        spellingLoading ? (
          <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
        ) : spellingDecks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-4xl mb-3">🔤</p>
              <p className="text-gray-500">単語がまだありません。</p>
              <p className="text-sm text-gray-400 mt-1">Your teacher will assign vocabulary decks here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {spellingDecks.map(deck => {
              const wordCount = deck.words.filter(w => w.word.trim().length >= 2).length
              return (
                <Card key={deck.deckId}>
                  <CardContent className="py-4 space-y-3">
                    <div>
                      <h2 className="font-semibold text-gray-900">{deck.deckName}</h2>
                      <p className="text-sm text-gray-500">{wordCount} word{wordCount !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => startSpellingDeck(deck)}
                      className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
                    >
                      Start Spelling
                    </button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
