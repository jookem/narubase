import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { launchConfetti } from '@/lib/confetti'
import { recordPhonicsLevelComplete } from '@/lib/api/phonics'
import { saveKidSession } from '@/lib/api/kids'
import type { PhonicsUnit, PhonicsWord } from '@/lib/phonicsContent'
import { Mascot } from './Mascot'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"

interface Props {
  unit: PhonicsUnit
  matchStars: number
  srsScore: number
  wordsLearned: PhonicsWord[]
  hasNextUnit: boolean
  onNext: () => void
  onMap: () => void
  onStarsRecorded: (unitId: string, stars: number) => void
}

function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v))
}

// Combines Family Match performance + SRS Checkpoint rating quality into a
// 1-3 star rating (1 guaranteed just for finishing, since Word Builder has
// no wrong answers and can't contribute a score), persists it, and shows
// this unit's own mascot celebrating rather than a random generic one —
// matching KidsGame's own bespoke pastel completion screens rather than the
// shared dark-themed CelebrationScreen built for adult study sessions.
export function LevelComplete({ unit, matchStars, srsScore, wordsLearned, hasNextUnit, onNext, onMap, onStarsRecorded }: Props) {
  const { user } = useAuth()
  const [stars] = useState<1 | 2 | 3>(() => clamp(1, 3, Math.round((matchStars + srsScore * 3) / 2)) as 1 | 2 | 3)
  const recordedRef = useRef(false)

  useEffect(() => {
    launchConfetti()
    if (!user || recordedRef.current) return
    recordedRef.current = true
    recordPhonicsLevelComplete(unit.id, stars).then(({ stars: finalStars }) => {
      onStarsRecorded(unit.id, finalStars ?? stars)
    })
    saveKidSession({
      player1Id: user.id,
      game: 'phonics',
      score: stars,
      wordsCorrect: Math.round(srsScore * wordsLearned.length),
      wordsAttempted: wordsLearned.length,
      streakBest: 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center', fontFamily: FONT }}>
      <div style={{ animation: 'kg-bounceIn .4s ease-out' }}>
        <Mascot name={unit.mascotName} pose="arrived" loop size={96} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#5A4336' }}>Level Complete!</div>
      <div style={{ fontSize: 36, display: 'flex', gap: 4 }}>
        {[1, 2, 3].map(i => (
          <span key={i} style={{ animation: `kg-pop .3s ease-out ${i * 0.15}s both`, opacity: i <= stars ? 1 : 0.25 }}>⭐</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {wordsLearned.map(w => (
          <div key={w.onset} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', borderRadius: '999px', padding: '6px 12px', boxShadow: '0 3px 0 #EEDAC6' }}>
            <span style={{ fontSize: 18 }}>{w.emoji}</span>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#6B4F3F' }}>{w.word}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {hasNextUnit && (
          <button onClick={onNext} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 15, padding: '10px 24px', borderRadius: '999px', background: '#F2879B', color: '#fff', boxShadow: '0 4px 0 #D96C81' }}>
            Next Level →
          </button>
        )}
        <button onClick={onMap} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 15, padding: '10px 24px', borderRadius: '999px', background: '#FFFFFF', color: '#6B4F3F', boxShadow: '0 4px 0 #E7D3C0' }}>
          ← Back to Map
        </button>
      </div>
    </div>
  )
}
