import { useRef, useState } from 'react'
import { speak } from '@/lib/tts'
import { rateVocabCard } from '@/lib/api/lessons'
import type { PhonicsBankRow } from '@/lib/api/phonics'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"

type CheckpointCard = PhonicsBankRow & { jp: string }

interface Props {
  words: CheckpointCard[]
  onDone: (ratingScore: number) => void
}

const RATING_QUALITY: Record<'again' | 'hard' | 'good' | 'easy', number> = {
  again: 0, hard: 0.5, good: 0.85, easy: 1,
}

// Reviews this unit's words with the same flip-card + SRS rating flow as
// KidsGame's inline "study" screen (same colors/labels/rateVocabCard call),
// so this checkpoint feels identical to the vocab review a student already
// knows, just scoped to the family they just learned.
//
// `queue` drives what's shown next, not a fixed index — "Again" requeues
// the card a couple of slots later instead of just advancing past it, so a
// missed word is guaranteed to come back around before the checkpoint ends.
// Progress/score are tracked per-word-id so repeats don't distort either.
export function SrsCheckpoint({ words, onDone }: Props) {
  const [queue, setQueue] = useState<CheckpointCard[]>(words)
  const [flipped, setFlipped] = useState(false)
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set())
  const qualityByIdRef = useRef<Record<string, number>>({})

  const card = queue[0]

  function rate(rating: 'again' | 'hard' | 'good' | 'easy') {
    rateVocabCard(card.id, card.mastery_level, rating, card.interval_days, card.ease_factor)
    qualityByIdRef.current[card.id] = RATING_QUALITY[rating]
    setFlipped(false)

    const rest = queue.slice(1)
    if (rating === 'again') {
      // Requeue a couple of cards later, not immediately, so the child gets
      // another real attempt instead of an instant back-to-back repeat.
      const pos = Math.min(rest.length, 2)
      setQueue([...rest.slice(0, pos), card, ...rest.slice(pos)])
      return
    }

    setClearedIds(s => new Set(s).add(card.id))
    setQueue(rest)
    if (rest.length === 0) {
      const total = Object.values(qualityByIdRef.current).reduce((a, b) => a + b, 0)
      onDone(total / words.length)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, fontFamily: FONT, width: '100%', maxWidth: 380, margin: '0 auto', padding: '4px 4px 20px' }}>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#A98B77', marginBottom: 6 }}>
          <span>どのくらいわかった？</span>
          <span>{clearedIds.size} / {words.length}</span>
        </div>
        <div style={{ height: 8, background: '#EDE0D4', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(clearedIds.size / words.length) * 100}%`, background: '#8BC273', borderRadius: 8, transition: 'width .3s' }} />
        </div>
      </div>

      <div
        onClick={() => { if (!flipped) { setFlipped(true); speak(card.word.toLowerCase()) } }}
        style={{ width: '100%', background: '#FFFFFF', borderRadius: 28, padding: '32px 28px', boxShadow: '0 10px 0 #EEDAC6', textAlign: 'center', cursor: flipped ? 'default' : 'pointer', userSelect: 'none', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#5A4336', lineHeight: 1.3 }}>{card.jp}</div>
        {!flipped && (
          <div style={{ fontSize: 14, fontWeight: 700, color: '#C7A892', marginTop: 4 }}>タップして英語を見る 👆</div>
        )}
        {flipped && (
          <>
            <div style={{ width: 48, height: 2, background: '#EEDAC6', borderRadius: 2 }} />
            <div style={{ fontSize: 36, fontWeight: 800, color: '#F2879B', letterSpacing: 3, animation: 'kg-bounceIn .35s ease-out' }}>{card.word}</div>
            <button onClick={e => { e.stopPropagation(); speak(card.word.toLowerCase()) }}
              style={{ border: 'none', cursor: 'pointer', background: '#F0F8FF', borderRadius: '999px', padding: '6px 16px', fontSize: 14, fontWeight: 700, color: '#7FB8E0' }}>
              🔊 きく
            </button>
          </>
        )}
      </div>

      {flipped && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
          {([
            { r: 'again' as const, label: 'もう一度', sub: 'Again', bg: '#FFF0F0', col: '#D96C81', sh: '#E4B8C4' },
            { r: 'hard' as const, label: 'むずかしい', sub: 'Hard', bg: '#FFF5E6', col: '#D9893A', sh: '#E4C49A' },
            { r: 'good' as const, label: 'よかった', sub: 'Good', bg: '#EEF8FF', col: '#3FA7E8', sh: '#B0D8F5' },
            { r: 'easy' as const, label: 'かんたん', sub: 'Easy', bg: '#EEFCF0', col: '#5AB468', sh: '#B8DFB8' },
          ]).map(btn => (
            <button key={btn.r} onClick={() => rate(btn.r)}
              style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, background: btn.bg, borderRadius: 16, padding: '12px 8px', boxShadow: `0 4px 0 ${btn.sh}`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: btn.col }}>{btn.label}</div>
              <div style={{ fontSize: 11, color: btn.col, opacity: 0.75 }}>{btn.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
