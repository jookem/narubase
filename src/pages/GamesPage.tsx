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
import { KaraokeGame } from '@/components/karaoke/KaraokeGame'
import { SituationSimulator } from '@/components/situation/SituationSimulator'
import type { VocabularyBankEntry } from '@/lib/types/database'

// ── Types ─────────────────────────────────────────────────────────

type DeckWithPuzzles = PuzzleDeck & { puzzles: Puzzle[] }

type SpellingDeck = {
  deckId: string
  deckName: string
  words: VocabularyBankEntry[]
}

type TrainSession = { deckId: string; deckName: string; puzzleIds: string[]; idx: number }
type SpellingSession = { deckId: string; deckName: string; wordIds: string[] }

// ── Helpers ───────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function isValidPuzzle(p: Puzzle): boolean {
  return !p.japanese_sentence?.includes('MYMEMORY WARNING') && !p.japanese_sentence?.includes('YOU USED ALL AVAILABLE')
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

const trainKey = (uid: string) => `train_session_${uid}`
const spellingKey = (uid: string) => `spelling_session_${uid}`

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
  const [tab, setTab] = useState<'train' | 'spelling' | 'picture' | 'karaoke' | 'situation'>('train')

  // ── Train state ────────────────────────────────────────────────
  const [trainDecks, setTrainDecks] = useState<DeckWithPuzzles[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, PuzzleProgress>>({})
  const [trainLoading, setTrainLoading] = useState(true)
  const [activePuzzles, setActivePuzzles] = useState<Puzzle[] | null>(null)
  const [puzzleIdx, setPuzzleIdx] = useState(0)
  const [trainDone, setTrainDone] = useState(false)
  const [trainSavedSession, setTrainSavedSession] = useState<TrainSession | null>(null)

  // ── Spelling state ─────────────────────────────────────────────
  const [spellingDecks, setSpellingDecks] = useState<SpellingDeck[]>([])
  const [spellingLoading, setSpellingLoading] = useState(true)
  const [activeSpellingWords, setActiveSpellingWords] = useState<VocabularyBankEntry[] | null>(null)
  const [spellingDone, setSpellingDone] = useState(false)
  const [spellingSavedSession, setSpellingSavedSession] = useState<SpellingSession | null>(null)

  // ── Karaoke state ──────────────────────────────────────────────
  const [karaokeSentences, setKaraokeSentences] = useState<string[]>([])
  const [karaokeLoading, setKaraokeLoading] = useState(true)
  const [activeKaraoke, setActiveKaraoke] = useState(false)

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

    // Check for saved session
    const raw = localStorage.getItem(trainKey(user.id))
    if (raw) {
      try {
        const session: TrainSession = JSON.parse(raw)
        const deck = (d ?? []).find(dk => dk.id === session.deckId)
        if (deck && session.idx < session.puzzleIds.length) {
          setTrainSavedSession(session)
        } else {
          localStorage.removeItem(trainKey(user.id))
        }
      } catch {
        localStorage.removeItem(trainKey(user.id))
      }
    }
  }

  // ── Load spelling data ─────────────────────────────────────────

  async function loadSpelling() {
    if (!user) return

    const { data } = await supabase
      .from('vocabulary_bank')
      .select('*, deck:vocabulary_decks!deck_id(name)')
      .eq('student_id', user.id)
      .not('deck_id', 'is', null)
      .order('created_at', { ascending: false })

    const entries = (data ?? []) as (VocabularyBankEntry & { deck?: { name: string } | null })[]

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

    const decks = Object.values(grouped).filter(g =>
      g.words.some(w => w.word.trim().length >= 2)
    )

    setSpellingDecks(decks)
    setSpellingLoading(false)

    // Check for saved session
    const raw = localStorage.getItem(spellingKey(user.id))
    if (raw) {
      try {
        const session: SpellingSession = JSON.parse(raw)
        const deck = decks.find(dk => dk.deckId === session.deckId)
        if (deck && session.wordIds.length > 0) {
          setSpellingSavedSession(session)
        } else {
          localStorage.removeItem(spellingKey(user.id))
        }
      } catch {
        localStorage.removeItem(spellingKey(user.id))
      }
    }
  }

  async function loadKaraoke() {
    if (!user) return

    // Step 1: get deck_ids the student is assigned to
    const { data: bankRows } = await supabase
      .from('grammar_bank')
      .select('deck_id')
      .eq('student_id', user.id)
      .not('deck_id', 'is', null)

    const deckIds = [...new Set((bankRows ?? []).map((r: any) => r.deck_id as string))]

    const all: string[] = []

    if (deckIds.length > 0) {
      // Step 2: pull examples from grammar_deck_points for those decks
      const { data: points } = await supabase
        .from('grammar_deck_points')
        .select('examples')
        .in('deck_id', deckIds)

      for (const row of points ?? []) {
        for (const ex of row.examples ?? []) {
          const s = ex?.trim()
          if (s && s.split(/\s+/).length >= 3) all.push(s)
        }
      }
    }


    const seen = new Set<string>()
    const unique = all.filter(s => { if (seen.has(s)) return false; seen.add(s); return true })
    const shuffled = [...unique].sort(() => Math.random() - 0.5)
    setKaraokeSentences(shuffled)
    setKaraokeLoading(false)
  }

  useEffect(() => { loadTrain(); loadSpelling(); loadKaraoke() }, [user])

  // ── Train handlers ─────────────────────────────────────────────

  function startTrainDeck(deck: DeckWithPuzzles, onlyIncomplete = false) {
    let puzzles = deck.puzzles.filter(isValidPuzzle)
    if (onlyIncomplete) puzzles = puzzles.filter(p => !progressMap[p.id]?.completed)
    if (!puzzles.length) return
    const batch = getStudyBatch(puzzles)
    if (user) {
      const session: TrainSession = { deckId: deck.id, deckName: deck.name, puzzleIds: batch.map(p => p.id), idx: 0 }
      localStorage.setItem(trainKey(user.id), JSON.stringify(session))
    }
    setTrainSavedSession(null)
    setActivePuzzles(batch)
    setPuzzleIdx(0)
    setTrainDone(false)
  }

  function resumeTrainSession() {
    if (!user || !trainSavedSession) return
    const deck = trainDecks.find(d => d.id === trainSavedSession.deckId)
    if (!deck) return
    const puzzleMap: Record<string, Puzzle> = {}
    for (const p of deck.puzzles) puzzleMap[p.id] = p
    const puzzles = trainSavedSession.puzzleIds.map(id => puzzleMap[id]).filter(Boolean) as Puzzle[]
    if (!puzzles.length) return
    setActivePuzzles(puzzles)
    setPuzzleIdx(trainSavedSession.idx)
    setTrainDone(false)
    setTrainSavedSession(null)
  }

  function handleTrainNext() {
    if (!activePuzzles) return
    const nextIdx = puzzleIdx + 1
    if (nextIdx >= activePuzzles.length) {
      if (user) localStorage.removeItem(trainKey(user.id))
      setTrainDone(true)
    } else {
      setPuzzleIdx(nextIdx)
      if (user) {
        const raw = localStorage.getItem(trainKey(user.id))
        if (raw) {
          try {
            const session: TrainSession = JSON.parse(raw)
            session.idx = nextIdx
            localStorage.setItem(trainKey(user.id), JSON.stringify(session))
          } catch {}
        }
      }
    }
  }

  function handleTrainClose() {
    // Keep session in localStorage so user can resume
    setActivePuzzles(null)
    setTrainDone(false)
    loadTrain()
  }

  // ── Spelling handlers ──────────────────────────────────────────

  function startSpellingDeck(deck: SpellingDeck) {
    const batch = getSpellingBatch(deck.words)
    if (!batch.length) return
    if (user) {
      const session: SpellingSession = { deckId: deck.deckId, deckName: deck.deckName, wordIds: batch.map(w => w.id) }
      localStorage.setItem(spellingKey(user.id), JSON.stringify(session))
    }
    setSpellingSavedSession(null)
    setActiveSpellingWords(batch)
    setSpellingDone(false)
  }

  function resumeSpellingSession() {
    if (!user || !spellingSavedSession) return
    const deck = spellingDecks.find(d => d.deckId === spellingSavedSession.deckId)
    if (!deck) return
    const wordMap: Record<string, VocabularyBankEntry> = {}
    for (const w of deck.words) wordMap[w.id] = w
    const words = spellingSavedSession.wordIds.map(id => wordMap[id]).filter(Boolean) as VocabularyBankEntry[]
    if (!words.length) return
    setActiveSpellingWords(words)
    setSpellingDone(false)
    setSpellingSavedSession(null)
  }

  function handleSpellingComplete() {
    if (user) localStorage.removeItem(spellingKey(user.id))
    setSpellingDone(true)
  }

  function handleSpellingClose() {
    // Keep session in localStorage so user can resume
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
        onComplete={handleSpellingComplete}
      />
    )
  }

  if (spellingDone && activeSpellingWords) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title="Spelling Bee Complete! 🐝"
          subtitle={`You practiced ${activeSpellingWords.length} word${activeSpellingWords.length !== 1 ? 's' : ''}`}
          onClose={handleSpellingClose}
          closeLabel="Back to Games"
        />
      </div>
    )
  }

  if (activeKaraoke) {
    return (
      <KaraokeGame
        sentences={karaokeSentences}
        onClose={() => setActiveKaraoke(false)}
        onComplete={() => setActiveKaraoke(false)}
      />
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
      <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-xl p-1 sm:grid-cols-5">
        <Tab label="🚂 Train" active={tab === 'train'} onClick={() => setTab('train')} />
        <Tab label="🐝 Spelling" active={tab === 'spelling'} onClick={() => setTab('spelling')} />
        <Tab label="🖼️ Picture" active={tab === 'picture'} onClick={() => setTab('picture')} />
        <Tab label="🎤 Karaoke" active={tab === 'karaoke'} onClick={() => setTab('karaoke')} />
        <Tab label="🎭 Situations" active={tab === 'situation'} onClick={() => setTab('situation')} />
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
            {/* Resume banner */}
            {trainSavedSession && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-amber-800">前回の続きから</p>
                  <p className="text-xs text-amber-600">{trainSavedSession.deckName} · {trainSavedSession.idx + 1}/{trainSavedSession.puzzleIds.length} 問目</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { if (user) localStorage.removeItem(trainKey(user.id)); setTrainSavedSession(null) }}
                    className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1"
                  >
                    破棄
                  </button>
                  <button
                    onClick={resumeTrainSession}
                    className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    再開 →
                  </button>
                </div>
              </div>
            )}

            {trainDecks.map(deck => {
              const validPuzzles = deck.puzzles.filter(isValidPuzzle)
              const total = validPuzzles.length
              const completed = validPuzzles.filter(p => progressMap[p.id]?.completed).length
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
                        {deck.puzzles.filter(isValidPuzzle).map(p => {
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

      {/* ── Picture This tab ── */}
      {tab === 'picture' && <PictureDescription />}

      {/* ── Karaoke tab ── */}
      {tab === 'karaoke' && (
        karaokeLoading ? (
          <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
        ) : karaokeSentences.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-4xl mb-3">🎤</p>
              <p className="text-gray-500">例文がまだありません。</p>
              <p className="text-sm text-gray-400 mt-1">Grammar examples will appear here once your teacher adds them.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="py-5 space-y-3">
                <div>
                  <h2 className="font-semibold text-gray-900">カラオケ 音読練習</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {karaokeSentences.length} sentence{karaokeSentences.length !== 1 ? 's' : ''} from your grammar bank · Read aloud and words light up as you speak
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-700">
                    Works best on <strong>Chrome or Edge</strong> (desktop or Android). Not supported on iOS Safari.
                  </p>
                </div>
                <button
                  onClick={() => setActiveKaraoke(true)}
                  className="px-5 py-2.5 bg-brand text-white font-medium rounded-xl hover:bg-brand/90 transition-colors"
                >
                  🎤 Start Karaoke
                </button>
              </CardContent>
            </Card>

            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium px-1">Preview sentences</p>
              {karaokeSentences.slice(0, 8).map((s, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-700">
                  {s}
                </div>
              ))}
              {karaokeSentences.length > 8 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{karaokeSentences.length - 8} more sentences</p>
              )}
            </div>
          </div>
        )
      )}

      {/* ── Situation Simulator tab ── */}
      {tab === 'situation' && <SituationSimulator />}

      {/* ── Spelling Bee tab ── */}
      {tab === 'spelling' && (
        spellingLoading ? (
          <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
        ) : spellingDecks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-4xl mb-3">🐝</p>
              <p className="text-gray-500">単語がまだありません。</p>
              <p className="text-sm text-gray-400 mt-1">Your teacher will assign vocabulary decks here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Resume banner */}
            {spellingSavedSession && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-amber-800">前回の続きから</p>
                  <p className="text-xs text-amber-600">{spellingSavedSession.deckName} · {spellingSavedSession.wordIds.length}語</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { if (user) localStorage.removeItem(spellingKey(user.id)); setSpellingSavedSession(null) }}
                    className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1"
                  >
                    破棄
                  </button>
                  <button
                    onClick={resumeSpellingSession}
                    className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    再開 →
                  </button>
                </div>
              </div>
            )}

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
                      Start Spelling Bee
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
