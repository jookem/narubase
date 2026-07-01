import { useMemo, useState } from 'react'
import { speak } from '@/lib/tts'
import { sfxCorrect, sfxWrong } from '@/lib/sfx'
import type { PhonicsWord } from '@/lib/phonicsContent'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"

interface Props {
  words: PhonicsWord[]
  onComplete: (stars: 1 | 2 | 3, flipCount: number) => void
}

interface MatchCard {
  id: string
  pairId: string
  kind: 'word' | 'picture'
  word: PhonicsWord
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildDeck(words: PhonicsWord[]): MatchCard[] {
  const cards: MatchCard[] = []
  for (const w of words) {
    cards.push({ id: `${w.onset}-word`, pairId: w.onset, kind: 'word', word: w })
    cards.push({ id: `${w.onset}-picture`, pairId: w.onset, kind: 'picture', word: w })
  }
  return shuffle(cards)
}

// Memory-match minigame built from the word+picture pairs Word Builder just
// collected. Forces the kid to actually discriminate between near-minimal-
// pair words (they differ only by onset) rather than passively re-viewing
// them. No penalty for a mismatch beyond a short delay — just try again.
export function FamilyMatch({ words, onComplete }: Props) {
  const [deck] = useState<MatchCard[]>(() => buildDeck(words))
  const [flipped, setFlipped] = useState<string[]>([])
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [flipCount, setFlipCount] = useState(0)
  const [busy, setBusy] = useState(false)

  const perfectFlips = words.length * 2
  const done = matched.size === words.length

  const cols = useMemo(() => (deck.length <= 6 ? 3 : 4), [deck.length])

  function tapCard(card: MatchCard) {
    if (busy || done) return
    if (matched.has(card.pairId)) return
    if (flipped.includes(card.id)) return
    if (flipped.length === 2) return

    const nextFlipped = [...flipped, card.id]
    setFlipped(nextFlipped)

    if (nextFlipped.length < 2) return

    setFlipCount(c => c + 1)
    const [firstId, secondId] = nextFlipped
    const first = deck.find(c => c.id === firstId)!
    const second = deck.find(c => c.id === secondId)!

    if (first.pairId === second.pairId) {
      sfxCorrect()
      setTimeout(() => speak(first.word.word), 150)
      const newMatched = new Set(matched); newMatched.add(first.pairId)
      setTimeout(() => {
        setMatched(newMatched)
        setFlipped([])
        if (newMatched.size === words.length) {
          const stars: 1 | 2 | 3 = flipCount + 1 <= perfectFlips ? 3 : flipCount + 1 <= perfectFlips * 2 ? 2 : 1
          setTimeout(() => onComplete(stars, flipCount + 1), 900)
        }
      }, 500)
    } else {
      sfxWrong()
      setBusy(true)
      setTimeout(() => { setFlipped([]); setBusy(false) }, 900)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, width: '100%', maxWidth: 420, margin: '0 auto', padding: '4px 4px 20px' }}>
      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#A98B77' }}>
        Find the matching pairs! · {matched.size}/{words.length}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
        {deck.map(card => {
          const isMatched = matched.has(card.pairId)
          const isFaceUp = isMatched || flipped.includes(card.id)
          return (
            <button
              key={card.id}
              onClick={() => tapCard(card)}
              disabled={isMatched}
              style={{
                border: 'none', cursor: isMatched ? 'default' : 'pointer', aspectRatio: '1 / 1', borderRadius: 16,
                fontFamily: FONT, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: card.kind === 'picture' && isFaceUp ? 30 : 16,
                background: isMatched ? '#D8ECC4' : isFaceUp ? '#FFFFFF' : '#F2879B',
                color: isMatched ? '#5B8A3A' : '#6B4F3F',
                boxShadow: isFaceUp ? '0 4px 0 #EEDAC6' : '0 4px 0 #D96C81',
                animation: isFaceUp ? 'kg-pop .25s ease-out' : undefined,
                padding: 4,
              }}>
              {isFaceUp ? (card.kind === 'picture' ? card.word.emoji : card.word.word) : '?'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
