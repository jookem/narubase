import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { recordPuzzleAttempt, type Puzzle, type PuzzlePart } from '@/lib/api/puzzles'
import { launchConfetti } from '@/lib/confetti'

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
  id: string   // string id required by dnd-kit
  originalIdx: number
  part: PuzzlePart
}

// ── Sortable car component ────────────────────────────────────
function TrainCar({
  car,
  isCorrect,
  isDragging,
}: {
  car: Car
  isCorrect: boolean
  isDragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: car.id })
  const colors = getColors(car.part.label)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    touchAction: 'none' as const,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-end shrink-0">
      <div className="flex flex-col items-center">
        <div
          {...attributes}
          {...listeners}
          className={`flex flex-col items-center justify-center px-4 py-3 border-2 min-w-[100px] max-w-[160px]
            cursor-grab active:cursor-grabbing select-none rounded-sm
            transition-colors duration-150
            ${isCorrect
              ? 'bg-green-100 border-green-400'
              : `${colors.car} hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20`
            }
          `}
        >
          <p className="text-sm font-semibold text-gray-900 text-center leading-tight">{car.part.text}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1.5 font-medium
            ${isCorrect ? 'bg-green-200 text-green-800' : colors.badge}`}>
            {car.part.label}
          </span>
        </div>
        {/* Wheels */}
        <div className="flex justify-around w-full px-2 -mt-1">
          <div className="w-4 h-4 rounded-full bg-gray-600 border-2 border-gray-500 shadow-inner" />
          <div className="w-4 h-4 rounded-full bg-gray-600 border-2 border-gray-500 shadow-inner" />
        </div>
      </div>
      {/* Coupler */}
      <div className="w-2 h-2 bg-gray-600 mb-5 shrink-0" />
    </div>
  )
}

// ── Drag overlay (floating ghost car) ─────────────────────────
function GhostCar({ car }: { car: Car }) {
  const colors = getColors(car.part.label)
  return (
    <div className="flex items-end shrink-0 pointer-events-none">
      <div className="flex flex-col items-center">
        <div className={`flex flex-col items-center justify-center px-4 py-3 border-2 min-w-[100px] max-w-[160px]
          rounded-sm shadow-2xl shadow-black/50 -translate-y-3 scale-105
          ${colors.car} border-brand`}
        >
          <p className="text-sm font-semibold text-gray-900 text-center leading-tight">{car.part.text}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1.5 font-medium ${colors.badge}`}>
            {car.part.label}
          </span>
        </div>
        <div className="flex justify-around w-full px-2 -mt-1">
          <div className="w-4 h-4 rounded-full bg-gray-600 border-2 border-gray-500" />
          <div className="w-4 h-4 rounded-full bg-gray-600 border-2 border-gray-500" />
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
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
  const [gameState, setGameState] = useState<State>('playing')
  const [attempts, setAttempts] = useState(0)
  const [shake, setShake] = useState(false)
  const [activeCar, setActiveCar] = useState<Car | null>(null)
  const [trainExiting, setTrainExiting] = useState(false)
  const [showCorrect, setShowCorrect] = useState(false)

  useEffect(() => {
    const shuffled = shuffle(
      puzzle.parts.map((p, i) => ({ id: String(i), originalIdx: i, part: p }))
    )
    setCars(shuffled)
    setGameState('playing')
    setAttempts(0)
    setActiveCar(null)
    setTrainExiting(false)
    setShowCorrect(false)
  }, [puzzle.id])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 30 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    const car = cars.find(c => c.id === event.active.id)
    setActiveCar(car ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCar(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    setCars(prev => {
      const oldIdx = prev.findIndex(c => c.id === active.id)
      const newIdx = prev.findIndex(c => c.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function checkAnswer() {
    const newAttempts = attempts + 1
    setAttempts(newAttempts)
    const isCorrect = cars.every((car, idx) => car.originalIdx === idx)

    if (isCorrect) {
      setGameState('correct')
      recordPuzzleAttempt(puzzle.id, true)
      launchConfetti()
      setTimeout(() => setTrainExiting(true), 200)
      setTimeout(() => setShowCorrect(true), 1100)
    } else {
      setGameState('wrong')
      recordPuzzleAttempt(puzzle.id, false)
      setShake(true)
      setTimeout(() => { setShake(false); setGameState('playing') }, 800)
    }
  }

  const progress = Math.round((puzzleNumber / total) * 100)

  return (
    <div role="dialog" aria-modal="true" aria-label="Train puzzle session" className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">{puzzleNumber} / {total}</span>
        <button aria-label="Exit puzzle session" onClick={onClose} className="text-gray-500 hover:text-white text-sm transition-colors">✕ Exit</button>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-2xl h-1 bg-gray-700 rounded-full mb-8">
        <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="w-full max-w-2xl space-y-8">
        {/* Prompt */}
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
        <div className={`pt-6 pb-3 train-track ${trainExiting ? 'overflow-hidden' : 'overflow-x-auto'}`}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className={`flex items-end gap-0 ${shake ? 'animate-shake' : ''} ${trainExiting ? 'animate-train-exit' : ''}`}>
              {/* Locomotive */}
              <div className="flex items-end shrink-0">
                <div className="flex flex-col items-center">
                  <div className="bg-gray-700 rounded-l-xl px-3 py-4 flex flex-col items-center justify-center border-2 border-gray-600 min-w-[52px]">
                    <span className="text-2xl">🚂</span>
                  </div>
                  <div className="flex justify-around w-full px-1 -mt-1">
                    <div className="w-5 h-5 rounded-full bg-gray-500 border-2 border-gray-400 shadow-inner" />
                    <div className="w-5 h-5 rounded-full bg-gray-500 border-2 border-gray-400 shadow-inner" />
                  </div>
                </div>
                <div className="w-3 h-2 bg-gray-600 mb-5" />
              </div>

              <SortableContext items={cars.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                {cars.map(car => (
                  <TrainCar
                    key={car.id}
                    car={car}
                    isCorrect={gameState === 'correct'}
                    isDragging={activeCar?.id === car.id}
                  />
                ))}
              </SortableContext>
            </div>

            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeCar ? <GhostCar car={activeCar} /> : null}
            </DragOverlay>
          </DndContext>
        </div>

        <p className="text-center text-xs text-gray-600">
          Drag cars along the track to reorder them
        </p>

        {/* Hint after wrong */}
        {gameState === 'wrong' && puzzle.hint && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-yellow-300">💡 {puzzle.hint}</p>
          </div>
        )}

        {/* Success */}
        {showCorrect && (
          <div className="text-center space-y-4 animate-[fadeIn_0.4s_ease]">
            <div className="bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-3">
              <p className="text-green-400 font-semibold">
                {attempts === 1 ? '🎉 Perfect first try!' : `✓ Correct! (${attempts} attempt${attempts !== 1 ? 's' : ''})`}
              </p>
              {puzzle.hint && <p className="text-sm text-green-300/70 mt-1">💡 {puzzle.hint}</p>}
            </div>
            <button onClick={onNext} className="px-8 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand/90 transition-colors">
              {isLast ? 'Finish 🚉' : 'Next Puzzle →'}
            </button>
          </div>
        )}

        {/* Check button */}
        {gameState === 'playing' && (
          <div className="text-center">
            <button onClick={checkAnswer} className="px-8 py-3 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-colors shadow-lg">
              Check Order
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
