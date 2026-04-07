import { useState, useEffect } from 'react'
import { recordPuzzleAttempt, type Puzzle, type PuzzlePart } from '@/lib/api/puzzles'

const LABEL_COLORS: Record<string, { car: string; badge: string }> = {
  Noun:         { car: 'bg-blue-50 border-blue-300',    badge: 'bg-blue-200 text-blue-800' },
  Pronoun:      { car: 'bg-sky-50 border-sky-300',      badge: 'bg-sky-200 text-sky-800' },
  Verb:         { car: 'bg-red-50 border-red-300',      badge: 'bg-red-200 text-red-800' },
  Adjective:    { car: 'bg-purple-50 border-purple-300',badge: 'bg-purple-200 text-purple-800' },
  Adverb:       { car: 'bg-orange-50 border-orange-300',badge: 'bg-orange-200 text-orange-800' },
  Preposition:  { car: 'bg-teal-50 border-teal-300',    badge: 'bg-teal-200 text-teal-800' },
  Conjunction:  { car: 'bg-yellow-50 border-yellow-300',badge: 'bg-yellow-200 text-yellow-800' },
  Interjection: { car: 'bg-rose-50 border-rose-300',    badge: 'bg-rose-200 text-rose-800' },
  Subject:      { car: 'bg-indigo-50 border-indigo-300',badge: 'bg-indigo-200 text-indigo-800' },
  Object:       { car: 'bg-green-50 border-green-300',  badge: 'bg-green-200 text-green-800' },
  Complement:   { car: 'bg-pink-50 border-pink-300',    badge: 'bg-pink-200 text-pink-800' },
  Other:        { car: 'bg-gray-50 border-gray-300',    badge: 'bg-gray-200 text-gray-700' },
}

function getColors(label: string) {
  return LABEL_COLORS[label] ?? LABEL_COLORS.Other
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

interface Car {
  id: number
  part: PuzzlePart
}

interface Props {
  puzzle: Puzzle
  onNext: () => void
  onClose: () => void
  isLast: boolean
  puzzleNumber: number
  total: number
}

type State = 'playing' | 'correct' | 'wrong'

export function TrainPuzzle({ puzzle, onNext, onClose, isLast, puzzleNumber, total }: Props) {
  const [cars, setCars] = useState<Car[]>([])
  const [selected, setSelected] = useState<number | null>(null) // index in cars array
  const [gameState, setGameState] = useState<State>('playing')
  const [attempts, setAttempts] = useState(0)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    const shuffled = shuffle(puzzle.parts.map((p, i) => ({ id: i, part: p })))
    setCars(shuffled)
    setSelected(null)
    setGameState('playing')
    setAttempts(0)
  }, [puzzle.id])

  function handleCarTap(idx: number) {
    if (gameState !== 'playing') return

    if (selected === null) {
      setSelected(idx)
      return
    }

    if (selected === idx) {
      setSelected(null)
      return
    }

    // Swap the two cars
    setCars(prev => {
      const next = [...prev]
      ;[next[selected], next[idx]] = [next[idx], next[selected]]
      return next
    })
    setSelected(null)
  }

  function checkAnswer() {
    const newAttempts = attempts + 1
    setAttempts(newAttempts)

    const isCorrect = cars.every((car, idx) => car.id === idx)

    if (isCorrect) {
      setGameState('correct')
      recordPuzzleAttempt(puzzle.id, true)
    } else {
      setGameState('wrong')
      recordPuzzleAttempt(puzzle.id, false)
      setShake(true)
      setTimeout(() => { setShake(false); setGameState('playing') }, 800)
    }
  }

  const progress = Math.round((puzzleNumber / total) * 100)

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">{puzzleNumber} / {total}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-sm transition-colors">✕ Exit</button>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-2xl h-1 bg-gray-700 rounded-full mb-8">
        <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="w-full max-w-2xl space-y-8">
        {/* Japanese sentence prompt */}
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Arrange the English translation</p>
          <p className="text-3xl font-bold text-white">{puzzle.japanese_sentence}</p>
        </div>

        {/* Track label */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-700" />
          <span className="text-xs text-gray-600 uppercase tracking-widest">Track</span>
          <div className="h-px flex-1 bg-gray-700" />
        </div>

        {/* Train */}
        <div className={`flex items-stretch gap-0 overflow-x-auto pb-2 ${shake ? 'animate-shake' : ''}`}>
          {/* Locomotive */}
          <div className="flex items-center shrink-0">
            <div className="bg-gray-700 rounded-l-xl px-3 py-4 flex flex-col items-center justify-center border-2 border-gray-600 min-w-[52px]">
              <span className="text-2xl">🚂</span>
            </div>
            {/* Connector */}
            <div className="w-3 h-2 bg-gray-600 self-center" />
          </div>

          {/* Cars */}
          {cars.map((car, idx) => {
            const colors = getColors(car.part.label)
            const isSelected = selected === idx
            const isCorrectPos = gameState === 'correct'

            let carClass = `flex flex-col items-center justify-center px-4 py-3 border-2 min-w-[100px] max-w-[160px] cursor-pointer transition-all duration-200 select-none `

            if (isCorrectPos) {
              carClass += 'bg-green-100 border-green-400 scale-105'
            } else if (isSelected) {
              carClass += `${colors.car} border-brand shadow-lg shadow-brand/30 scale-105 -translate-y-1`
            } else {
              carClass += `${colors.car} hover:scale-105 hover:-translate-y-0.5`
            }

            return (
              <div key={`${car.id}-${idx}`} className="flex items-stretch shrink-0">
                <div className={carClass} onClick={() => handleCarTap(idx)}>
                  <p className="text-sm font-semibold text-gray-900 text-center leading-tight">{car.part.text}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1.5 font-medium ${isCorrectPos ? 'bg-green-200 text-green-800' : colors.badge}`}>
                    {car.part.label}
                  </span>
                  {isSelected && (
                    <span className="text-xs text-brand mt-1 opacity-70">selected</span>
                  )}
                </div>
                {idx < cars.length - 1 && (
                  <div className="w-2 h-2 bg-gray-600 self-center shrink-0" />
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-gray-600">
          Tap a car to select it, then tap another car to swap their positions
        </p>

        {/* Hint (shown after wrong) */}
        {gameState === 'wrong' && puzzle.hint && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-yellow-300">💡 {puzzle.hint}</p>
          </div>
        )}

        {/* Correct message + next */}
        {gameState === 'correct' && (
          <div className="text-center space-y-4">
            <div className="bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-3">
              <p className="text-green-400 font-semibold">
                {attempts === 1 ? '🎉 Perfect first try!' : `✓ Correct! (${attempts} attempt${attempts !== 1 ? 's' : ''})`}
              </p>
              {puzzle.hint && <p className="text-sm text-green-300/70 mt-1">💡 {puzzle.hint}</p>}
            </div>
            <button
              onClick={onNext}
              className="px-8 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand/90 transition-colors"
            >
              {isLast ? 'Finish 🚉' : 'Next Puzzle →'}
            </button>
          </div>
        )}

        {/* Check button */}
        {gameState === 'playing' && (
          <div className="text-center">
            <button
              onClick={checkAnswer}
              className="px-8 py-3 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-colors shadow-lg"
            >
              Check Order
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
