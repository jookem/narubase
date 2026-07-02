import { useEffect, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { speak } from '@/lib/tts'
import { sfxBlend, sfxWrong } from '@/lib/sfx'
import type { PhonicsUnit, PhonicsWord } from '@/lib/phonicsContent'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"
const SLOT_ID = 'onset-slot'

interface Props {
  unit: PhonicsUnit
  onAllOnsetsUsed: (words: PhonicsWord[]) => void
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function DraggableOnsetTile({ word, disabled, shake, onTap }: { word: PhonicsWord; disabled: boolean; shake: boolean; onTap: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: word.onset,
    disabled,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onTap}
      disabled={disabled}
      style={{
        ...style,
        touchAction: 'none', border: 'none', cursor: disabled ? 'default' : 'grab',
        fontFamily: FONT, fontWeight: 800, fontSize: 22, minWidth: 64, height: 64, padding: '0 10px', borderRadius: 18,
        background: shake ? '#FDE2E2' : '#FFFFFF', color: shake ? '#C0524F' : '#6B4F3F',
        boxShadow: shake ? '0 5px 0 #E8B9B6' : '0 5px 0 #E7D3C0',
        opacity: isDragging ? 0.25 : disabled ? 0.4 : 1,
        animation: shake ? 'kg-shake .4s ease' : undefined,
      }}
    >
      {word.onset}
    </button>
  )
}

function DroppableOnsetSlot({ filled }: { filled: PhonicsWord | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: SLOT_ID })
  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 64, height: 64, padding: '0 10px', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT, fontWeight: 800, fontSize: 22, color: '#F2879B',
        border: filled ? 'none' : `3px dashed ${isOver ? '#F2879B' : '#E7D3C0'}`,
        background: filled ? '#FBD9E1' : isOver ? '#FFF0F4' : 'transparent',
        transition: 'background .15s, border-color .15s',
      }}
    >
      {filled?.onset ?? ''}
    </div>
  )
}

// Picture-anchored onset quiz: one word from the family is picked as the
// current target and shown as a picture (its emoji) *before* the student
// answers, so they must match sound-to-meaning rather than free-placing any
// tile (every onset here forms a real word, so without a target picture
// there's nothing to actually get wrong). Wrong picks shake and play a
// buzzer but stay in the tray so the student can try again. Mirrors
// SpellingGame.tsx's @dnd-kit/core usage: useDraggable + useDroppable +
// PointerSensor/TouchSensor + DragOverlay, plus a plain onClick fallback per
// tile for tap-to-place reliability on touch devices.
export function WordBuilder({ unit, onAllOnsetsUsed }: Props) {
  const [order, setOrder] = useState<PhonicsWord[]>(() => shuffle(unit.words))
  const [orderIdx, setOrderIdx] = useState(0)
  const [tray, setTray] = useState<PhonicsWord[]>(() => shuffle(unit.words))
  const [placed, setPlaced] = useState<PhonicsWord | null>(null)
  const [collected, setCollected] = useState<PhonicsWord[]>([])
  const [activeDrag, setActiveDrag] = useState<PhonicsWord | null>(null)
  const [shakeOnset, setShakeOnset] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 30 } }),
  )

  useEffect(() => {
    setOrder(shuffle(unit.words))
    setOrderIdx(0)
    setTray(shuffle(unit.words))
    setPlaced(null)
    setCollected([])
    setShakeOnset(null)
  }, [unit])

  const target = order[orderIdx] ?? null

  function tryOnset(word: PhonicsWord) {
    if (placed || !target) return
    if (word.onset !== target.onset) {
      sfxWrong()
      setShakeOnset(word.onset)
      setTimeout(() => setShakeOnset(w => (w === word.onset ? null : w)), 400)
      return
    }
    sfxBlend()
    setPlaced(word)
    setTray(t => t.filter(w => w.onset !== word.onset))
    setTimeout(() => speak(word.word), 150)

    setTimeout(() => {
      setCollected(c => {
        const next = [...c, word]
        if (next.length === unit.words.length) setTimeout(() => onAllOnsetsUsed(next), 900)
        return next
      })
      setPlaced(null)
      setOrderIdx(i => i + 1)
    }, 1800)
  }

  function handleDragStart({ active }: DragStartEvent) {
    const word = tray.find(w => w.onset === active.id)
    if (word) setActiveDrag(word)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDrag(null)
    if (!over || over.id !== SLOT_ID) return
    const word = tray.find(w => w.onset === active.id)
    if (word) tryOnset(word)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT, width: '100%', maxWidth: 560, margin: '0 auto', padding: '4px 4px 20px' }}>
      {/* Collected words strip */}
      <div style={{ display: 'flex', gap: 8, minHeight: 36, flexWrap: 'wrap', justifyContent: 'center' }}>
        {collected.map(w => (
          <div key={w.onset} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', borderRadius: '999px', padding: '6px 12px', boxShadow: '0 3px 0 #EEDAC6', animation: 'kg-bounceIn .3s ease-out' }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{w.emoji}</span>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#6B4F3F' }}>{w.word}</span>
          </div>
        ))}
      </div>

      {/* Word panel — the target picture before an answer, or the reveal
          after. These are mutually exclusive states of the same "what word
          is this" question, so they share one reserved slot instead of each
          reserving their own — that was pushing the onset tray needlessly
          far down the page. lineHeight is pinned on the emoji itself since
          some color-emoji glyphs (e.g. Windows' Segoe UI Emoji) carry a much
          taller line-box than their font-size implies. */}
      <div style={{ minHeight: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!placed && target && (
          <div key={target.onset} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: 'kg-bounceIn .3s ease-out' }}>
            <div style={{ fontSize: 56, lineHeight: 1 }}>{target.emoji}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#A98B77' }}>{target.jp}</div>
          </div>
        )}
        {placed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: 'kg-pop .3s ease-out' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#A98B77' }}>{placed.jp}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>{placed.emoji}</span>
              <span style={{ fontWeight: 800, fontSize: 26, color: '#F2879B' }}>{placed.word}</span>
            </div>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Build row: suffix-family units show [slot][rime]; prefix-digraph
            units (e.g. 'wh', always word-initial) show [rime][slot] instead */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {unit.prefixMode && <div style={{ fontWeight: 800, fontSize: 30, color: '#6B4F3F' }}>{unit.rime}</div>}
          <DroppableOnsetSlot filled={placed} />
          {!unit.prefixMode && <div style={{ fontWeight: 800, fontSize: 30, color: '#6B4F3F' }}>{unit.rime}</div>}
          {unit.silentE && (
            <div style={{
              width: 44, height: 64, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 18, color: '#C7A892', background: '#F5EDE6', opacity: 0.6,
            }}>
              🤫e
            </div>
          )}
        </div>

        {/* Onset tray — every remaining onset in the family, only one of
            which matches the current target picture */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {tray.map(w => (
            <DraggableOnsetTile key={w.onset} word={w} disabled={!!placed} shake={shakeOnset === w.onset} onTap={() => tryOnset(w)} />
          ))}
        </div>

        <DragOverlay>
          {activeDrag && (
            <div style={{
              width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 22, background: '#FFFFFF', color: '#6B4F3F',
              boxShadow: '0 10px 24px rgba(0,0,0,.25)', transform: 'scale(1.08)',
            }}>
              {activeDrag.onset}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
