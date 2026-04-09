import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getAssignedDecksWithPuzzles,
  getStudentProgress,
  type PuzzleDeck,
  type Puzzle,
  type PuzzleProgress,
} from '@/lib/api/puzzles'
import { Card, CardContent } from '@/components/ui/card'
import { TrainPuzzle } from '@/components/puzzle/TrainPuzzle'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'

type DeckWithPuzzles = PuzzleDeck & { puzzles: Puzzle[] }

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function GamePage() {
  const { user } = useAuth()
  const [decks, setDecks] = useState<DeckWithPuzzles[]>([])
  const [loading, setLoading] = useState(true)
  const [progressMap, setProgressMap] = useState<Record<string, PuzzleProgress>>({})

  // Game state
  const [activePuzzles, setActivePuzzles] = useState<Puzzle[] | null>(null)
  const [puzzleIdx, setPuzzleIdx] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)

  async function load() {
    if (!user) return
    const { decks: d } = await getAssignedDecksWithPuzzles(user.id)
    setDecks(d ?? [])

    // Load progress for all puzzles
    const allProgress: Record<string, PuzzleProgress> = {}
    for (const deck of d ?? []) {
      const { progress } = await getStudentProgress(user.id, deck.id)
      for (const p of progress ?? []) allProgress[p.puzzle_id] = p
    }
    setProgressMap(allProgress)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  function startDeck(deck: DeckWithPuzzles, onlyIncomplete = false) {
    let puzzles = deck.puzzles
    if (onlyIncomplete) puzzles = puzzles.filter(p => !progressMap[p.id]?.completed)
    if (!puzzles.length) return
    setActivePuzzles(shuffle(puzzles))
    setPuzzleIdx(0)
    setSessionComplete(false)
  }

  function handleNext() {
    if (!activePuzzles) return
    if (puzzleIdx + 1 >= activePuzzles.length) {
      setSessionComplete(true)
    } else {
      setPuzzleIdx(i => i + 1)
    }
  }

  function handleClose() {
    setActivePuzzles(null)
    setSessionComplete(false)
    load() // refresh progress
  }

  if (loading) return <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />

  // Active game
  if (activePuzzles && !sessionComplete) {
    const puzzle = activePuzzles[puzzleIdx]
    return (
      <TrainPuzzle
        puzzle={puzzle}
        puzzleNumber={puzzleIdx + 1}
        total={activePuzzles.length}
        isLast={puzzleIdx + 1 >= activePuzzles.length}
        onNext={handleNext}
        onClose={handleClose}
      />
    )
  }

  // Session complete screen
  if (sessionComplete && activePuzzles) {
    return (
      <div role="dialog" aria-modal="true" aria-label="Game complete" className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title="All Aboard! 🚉"
          subtitle={`You completed ${activePuzzles.length} puzzle${activePuzzles.length !== 1 ? 's' : ''}`}
          onClose={handleClose}
          closeLabel="Back to Decks"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">🚂 パズル / Train Puzzles</h1>
        <p className="text-gray-500 text-sm mt-1">英語の語順を並べ替えよう</p>
      </div>

      {decks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-4xl mb-3">🚂</p>
            <p className="text-gray-500">パズルデッキがまだありません。</p>
            <p className="text-sm text-gray-400 mt-1">Your teacher will assign puzzle decks here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {decks.map(deck => {
            const totalPuzzles = deck.puzzles.length
            const completed = deck.puzzles.filter(p => progressMap[p.id]?.completed).length
            const incomplete = totalPuzzles - completed
            const pct = totalPuzzles > 0 ? Math.round((completed / totalPuzzles) * 100) : 0

            return (
              <Card key={deck.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-gray-900">{deck.name}</h2>
                      <p className="text-sm text-gray-500">{totalPuzzles}問 · {completed}問クリア</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {incomplete > 0 && (
                        <button
                          onClick={() => startDeck(deck, true)}
                          className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                        >
                          続ける ({incomplete})
                        </button>
                      )}
                      <button
                        onClick={() => startDeck(deck, false)}
                        className="px-3 py-1.5 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
                      >
                        {completed === totalPuzzles && totalPuzzles > 0 ? 'もう一度' : '開始'}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {totalPuzzles > 0 && (
                    <div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{pct}% クリア</p>
                    </div>
                  )}

                  {/* Puzzle list */}
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
      )}
    </div>
  )
}
