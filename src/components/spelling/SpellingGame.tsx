import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { X, Volume2 } from 'lucide-react'
import { speak } from '@/lib/tts'
import { launchConfetti } from '@/lib/confetti'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'
import type { VocabularyBankEntry } from '@/lib/types/database'

// ── Types ─────────────────────────────────────────────────────────

interface LetterTile {
  id: string     // unique: "idx:letter" e.g. "0:a", "1:p"
  letter: string
}

interface SpellingGameProps {
  words: VocabularyBankEntry[]
  onClose: () => void
  onComplete: () => void
}

// ── Helpers ───────────────────────────────────────────────────────

function makeTiles(word: string): LetterTile[] {
  const tiles: LetterTile[] = word.toLowerCase().split('').map((l, i) => ({ id: `${i}:${l}`, letter: l }))
  for (let attempt = 0; attempt < 20; attempt++) {
    const shuffled = [...tiles].sort(() => Math.random() - 0.5)
    if (tiles.length <= 1 || shuffled.some((t, i) => t.id !== tiles[i].id)) return shuffled
  }
  return [...tiles].reverse()
}

function dragPhaseCount(total: number): number {
  if (total <= 3) return total
  return Math.ceil(total * 0.6)
}

// ── DraggableTile ─────────────────────────────────────────────────

interface TileProps {
  tile: LetterTile
  source: 'pool' | 'slot'
  slotIdx?: number
  inSlot?: boolean
  isCorrect?: boolean
  onClick: () => void
}

function DraggableTile({ tile, source, slotIdx, inSlot = false, isCorrect = false, onClick }: TileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tile.id,
    data: { source, slotIdx },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  if (inSlot) {
    // Slot tiles: fill the slot container, no own border/bg
    return (
      <button
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={onClick}
        className={`w-full h-full flex items-center justify-center font-bold text-lg uppercase touch-none select-none
          ${isCorrect ? 'text-white' : 'text-brand'}
          ${isDragging ? 'opacity-20' : ''}`}
      >
        {tile.letter}
      </button>
    )
  }

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`w-11 h-11 border-2 border-brand bg-white rounded-xl font-bold text-lg uppercase text-brand
        flex items-center justify-center touch-none select-none shadow-sm transition-opacity
        ${isDragging ? 'opacity-20' : 'hover:bg-brand/5 active:scale-95'}`}
    >
      {tile.letter}
    </button>
  )
}

// ── DroppableSlot ─────────────────────────────────────────────────

interface SlotProps {
  slotId: string
  tile: LetterTile | null
  isCorrect: boolean
  onRemove: () => void
}

function DroppableSlot({ slotId, tile, isCorrect, onRemove }: SlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId })
  const slotIdx = parseInt(slotId.split('-')[1])

  return (
    <div
      ref={setNodeRef}
      className={`w-11 h-11 border-2 rounded-xl flex items-center justify-center transition-all
        ${tile
          ? isCorrect
            ? 'bg-green-500 border-green-500'
            : 'bg-brand/10 border-brand'
          : isOver
            ? 'border-brand bg-brand/10'
            : 'border-dashed border-gray-500 bg-white/5'
        }`}
    >
      {tile && (
        <DraggableTile
          tile={tile}
          source="slot"
          slotIdx={slotIdx}
          inSlot
          isCorrect={isCorrect}
          onClick={onRemove}
        />
      )}
    </div>
  )
}

// ── DroppablePool ─────────────────────────────────────────────────

function DroppablePool({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-16 px-4 py-3 rounded-2xl border-2 transition-all
        ${isOver ? 'border-white/30 bg-white/10' : 'border-transparent'}`}
    >
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export function SpellingGame({ words, onClose, onComplete }: SpellingGameProps) {
  const [wordIdx, setWordIdx] = useState(0)
  const [pool, setPool] = useState<LetterTile[]>([])
  const [slots, setSlots] = useState<(LetterTile | null)[]>([])
  const [activeDrag, setActiveDrag] = useState<{ tile: LetterTile } | null>(null)
  const [shaking, setShaking] = useState(false)
  const [wordDone, setWordDone] = useState(false)
  const [typeInput, setTypeInput] = useState('')
  const [typeWrong, setTypeWrong] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const [sessionDone, setSessionDone] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const typeRef = useRef<HTMLInputElement>(null)

  const dragCount = dragPhaseCount(words.length)
  const currentWord = words[wordIdx]
  const currentPhase: 'drag' | 'type' = wordIdx < dragCount ? 'drag' : 'type'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 30 } }),
  )

  // ── Init a word ────────────────────────────────────────────────

  function initWord(idx: number) {
    const w = words[idx]
    if (!w) return
    setPool(makeTiles(w.word))
    setSlots(new Array(w.word.length).fill(null))
    setWordDone(false)
    setTypeInput('')
    setTypeWrong(false)
    speak(w.word)
  }

  useEffect(() => { initWord(0) }, [])

  useEffect(() => {
    if (currentPhase === 'type' && !showTransition) {
      setTimeout(() => typeRef.current?.focus(), 150)
    }
  }, [wordIdx, showTransition])

  // ── Advance ────────────────────────────────────────────────────

  function advance() {
    const next = wordIdx + 1
    if (next >= words.length) { setSessionDone(true); return }
    if (wordIdx < dragCount && next >= dragCount) {
      setWordIdx(next)
      setShowTransition(true)
      return
    }
    setWordIdx(next)
    initWord(next)
  }

  // ── Drag handlers ──────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    const data = active.data.current as { source: 'pool' | 'slot'; slotIdx?: number }
    const tile =
      data.source === 'pool'
        ? pool.find(t => t.id === active.id)
        : slots[data.slotIdx!] ?? undefined
    if (tile) setActiveDrag({ tile })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDrag(null)
    if (!over) return

    const data = active.data.current as { source: 'pool' | 'slot'; slotIdx?: number }
    const overId = over.id as string

    // Locate the dragged tile
    const draggedTile: LetterTile | undefined =
      data.source === 'pool'
        ? pool.find(t => t.id === active.id)
        : slots[data.slotIdx!] ?? undefined
    if (!draggedTile) return

    // Remove from source
    let newPool = data.source === 'pool'
      ? pool.filter(t => t.id !== draggedTile.id)
      : [...pool]
    let newSlots = [...slots]
    if (data.source === 'slot' && data.slotIdx !== undefined) {
      newSlots[data.slotIdx] = null
    }

    if (overId.startsWith('slot-')) {
      const targetIdx = parseInt(overId.split('-')[1])
      const displaced = newSlots[targetIdx]
      if (displaced) newPool = [...newPool, displaced]
      newSlots[targetIdx] = draggedTile
    } else if (overId === 'pool' && data.source === 'slot') {
      newPool = [...newPool, draggedTile]
    } else {
      // Dropped nowhere useful — return to source
      if (data.source === 'pool') newPool = [...newPool, draggedTile]
      else if (data.slotIdx !== undefined) newSlots[data.slotIdx] = draggedTile
    }

    setPool(newPool)
    setSlots(newSlots)
  }

  // ── Click interactions ─────────────────────────────────────────

  function clickPoolTile(tile: LetterTile) {
    const emptyIdx = slots.findIndex(s => s === null)
    if (emptyIdx === -1) return
    const newSlots = [...slots]
    newSlots[emptyIdx] = tile
    setPool(pool.filter(t => t.id !== tile.id))
    setSlots(newSlots)
  }

  function removeSlotTile(slotIdx: number) {
    const tile = slots[slotIdx]
    if (!tile) return
    const newSlots = [...slots]
    newSlots[slotIdx] = null
    setPool([...pool, tile])
    setSlots(newSlots)
  }

  // ── Check answers ──────────────────────────────────────────────

  function shake() {
    setShaking(true)
    setTimeout(() => setShaking(false), 600)
  }

  function correct() {
    setCorrectCount(c => c + 1)
    setWordDone(true)
    launchConfetti()
    setTimeout(advance, 1200)
  }

  function checkDrag() {
    if (slots.some(s => s === null)) { shake(); return }
    const answer = slots.map(s => s!.letter).join('')
    if (answer === currentWord.word.toLowerCase()) correct()
    else shake()
  }

  function checkType() {
    if (!typeInput.trim()) return
    if (typeInput.toLowerCase().trim() === currentWord.word.toLowerCase()) {
      correct()
    } else {
      setTypeWrong(true)
      shake()
      setTimeout(() => setTypeWrong(false), 800)
    }
  }

  // ── Slot correctness ───────────────────────────────────────────

  function isCorrect(slotIdx: number) {
    return slots[slotIdx]?.letter === currentWord.word.toLowerCase()[slotIdx]
  }

  const progress = (wordIdx / words.length) * 100

  // ── Session complete ───────────────────────────────────────────

  if (sessionDone) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title="スペリング完了！ 🎉"
          subtitle={`${correctCount} / ${words.length} words spelled correctly`}
          onClose={onComplete}
          closeLabel="Back to Decks"
        />
      </div>
    )
  }

  // ── Phase transition ───────────────────────────────────────────

  if (showTransition) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-6 text-center gap-6">
        <div className="text-6xl">⌨️</div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Now type it!</h2>
          <p className="text-gray-400 text-sm">You've arranged the letters — now spell from memory.</p>
        </div>
        <button
          onClick={() => { setShowTransition(false); initWord(wordIdx) }}
          className="px-8 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand/90 transition-colors"
        >
          Let's go →
        </button>
      </div>
    )
  }

  // ── Main UI ────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
          <X size={20} />
        </button>
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-teal rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-gray-400 text-sm tabular-nums">{wordIdx + 1}/{words.length}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 overflow-y-auto">

        {/* Phase badge */}
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          currentPhase === 'drag'
            ? 'bg-brand/30 text-blue-200'
            : 'bg-teal-900/50 text-teal-300'
        }`}>
          {currentPhase === 'drag' ? '🧩 Arrange the letters' : '⌨️ Type the word'}
        </div>

        {/* Definition hint */}
        {currentWord.definition_en && (
          <p className="text-gray-300 text-center text-base max-w-xs leading-snug">
            {currentWord.definition_en}
          </p>
        )}
        {!currentWord.definition_en && currentWord.definition_ja && (
          <p className="text-gray-300 text-center text-base max-w-xs">
            {currentWord.definition_ja}
          </p>
        )}

        {/* TTS */}
        <button
          onClick={() => speak(currentWord.word)}
          className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
        >
          <Volume2 size={18} />
          <span className="text-sm font-medium">Listen</span>
        </button>

        {/* ── Drag phase ── */}
        {currentPhase === 'drag' && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

            {/* Answer slots */}
            <div className={`flex gap-2 flex-wrap justify-center ${shaking ? 'animate-shake' : ''}`}>
              {slots.map((tile, i) => (
                <DroppableSlot
                  key={`slot-${i}`}
                  slotId={`slot-${i}`}
                  tile={tile}
                  isCorrect={isCorrect(i)}
                  onRemove={() => removeSlotTile(i)}
                />
              ))}
            </div>

            {/* Letter pool */}
            <DroppablePool>
              <div className="flex gap-2 flex-wrap justify-center min-h-[52px]">
                {pool.map(tile => (
                  <DraggableTile
                    key={tile.id}
                    tile={tile}
                    source="pool"
                    onClick={() => clickPoolTile(tile)}
                  />
                ))}
              </div>
            </DroppablePool>

            {/* Drag overlay ghost */}
            <DragOverlay>
              {activeDrag && (
                <div className="w-11 h-11 border-2 border-brand bg-white rounded-xl font-bold text-lg
                  uppercase text-brand flex items-center justify-center shadow-xl scale-110">
                  {activeDrag.tile.letter}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* ── Type phase ── */}
        {currentPhase === 'type' && (
          <div className={`flex flex-col items-center gap-3 ${shaking ? 'animate-shake' : ''}`}>
            <input
              ref={typeRef}
              value={typeInput}
              onChange={e => setTypeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && checkType()}
              className={`w-64 text-center text-2xl font-bold py-3 px-4 rounded-xl border-2 bg-white/10 text-white
                placeholder-white/30 focus:outline-none transition-colors
                ${typeWrong ? 'border-red-400 bg-red-900/20' : 'border-white/20 focus:border-brand'}`}
              placeholder="Type here…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}

        {/* Check / Correct */}
        {wordDone ? (
          <p className="text-green-400 font-bold text-xl">✓ Correct!</p>
        ) : (
          <button
            onClick={currentPhase === 'drag' ? checkDrag : checkType}
            disabled={currentPhase === 'type' && !typeInput.trim()}
            className="px-8 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand/90
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Check
          </button>
        )}
      </div>
    </div>
  )
}
