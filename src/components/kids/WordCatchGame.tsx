import { useEffect, useRef, useState } from 'react'
import type { VocabularyBankEntry } from '@/lib/types/database'
import type { SessionWord } from './SpellTsumGame'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"
const LANES = 3

const FIELD_W = 340
const LANE_H = 72
const BUBBLE_W = 128
const BUBBLE_H = 48
const NET_W = 46
const NET_X = 10
const TRAVEL_MS = 7500
const TRAVEL_DIST = FIELD_W + BUBBLE_W + 30
const SPEED = TRAVEL_DIST / TRAVEL_MS // px per ms

const FALLBACK: [string, string][] = [
  ['Apple', '🍎'], ['Cat', '🐱'], ['Dog', '🐶'], ['Fish', '🐟'], ['Ball', '⚽'], ['Guitar', '🎸'],
  ['Hat', '🎩'], ['Sun', '☀️'], ['Tea', '🍵'], ['Cake', '🍰'], ['Star', '⭐'], ['Lion', '🦁'],
  ['Rabbit', '🐰'], ['Kite', '🪁'], ['Egg', '🥚'], ['Piano', '🎹'], ['Bird', '🐦'], ['Flower', '🌸'],
]

interface PoolEntry { word: string; clue: string; isEmoji: boolean }
interface LaneWord { word: string; isTarget: boolean }

function shuffleArr<T>(a: T[]): T[] {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildPool(sessionW: SessionWord[], vocab: VocabularyBankEntry[]): PoolEntry[] {
  if (sessionW.length > 0) return sessionW.map(w => ({ word: w.word, clue: w.hint, isEmoji: false }))
  if (vocab.length >= 3) return vocab.map(e => ({
    word: e.word.trim(), clue: e.definition_ja ?? e.definition_en ?? e.reading ?? e.word, isEmoji: false,
  }))
  return FALLBACK.map(([word, emoji]) => ({ word, clue: emoji, isEmoji: true }))
}

function pickOptions(pool: PoolEntry[], target: PoolEntry): LaneWord[] {
  const others = shuffleArr(pool.filter(w => w.word !== target.word)).slice(0, 2)
  return shuffleArr([target, ...others]).map(o => ({ word: o.word, isTarget: o.word === target.word }))
}

interface Props {
  assignedVocab: VocabularyBankEntry[]
  sessionWords: SessionWord[]
  isDuo?: boolean
  assignedVocab2?: VocabularyBankEntry[]
  sessionWords2?: SessionWord[]
  onBack: () => void
  onWordComplete?: () => void
  sfxCorrect: () => void
  sfxTap: () => void
  speak: (t: string) => void
}

// Words fly right-to-left in 3 lanes; the child drags/taps a net (🥅) up and
// down to be in the right lane when the CORRECT word reaches it. Wrong-lane
// catches just bounce harmlessly — no penalty, no "miss" state — a word
// that isn't caught simply loops back around for another pass, so the only
// way to end a round is to actually catch the target. Low-stress by design
// for young ESL learners; skill comes from reading + reacting, not from
// punishing mistakes.
//
// Duo mode: each player has their own pool + finite session queue (built
// from their own assignedVocab/sessionWords, not shared) so player 2 never
// sees player 1's words. Whichever players actually have session data must
// exhaust their own queue before the round truly ends; a player with no
// session data (free-play) never blocks that.
export function WordCatchGame({
  assignedVocab, sessionWords, isDuo, assignedVocab2 = [], sessionWords2 = [],
  onBack, onWordComplete, sfxCorrect, sfxTap, speak,
}: Props) {
  const [pool1] = useState<PoolEntry[]>(() => buildPool(sessionWords, assignedVocab))
  const [pool2] = useState<PoolEntry[]>(() => isDuo ? buildPool(sessionWords2, assignedVocab2) : [])
  const isSession1 = sessionWords.length > 0
  const isSession2 = !!isDuo && sessionWords2.length > 0

  // Two independent finite queues of *targets* (session mode) — distractors
  // can repeat freely, but every session word is guaranteed to be the
  // target at least once for its own player before that player's queue
  // empties. Guarded ref-init (not a call in the render body) so re-renders
  // never silently drain it — the same bug class fixed in SpellTsumGame.
  const remaining1Ref = useRef<PoolEntry[] | undefined>(undefined)
  const remaining2Ref = useRef<PoolEntry[] | undefined>(undefined)
  const firstTargetRef = useRef<PoolEntry | undefined>(undefined)
  const done1Ref = useRef(false)
  const done2Ref = useRef(false)
  if (remaining1Ref.current === undefined) {
    const queue = shuffleArr([...pool1])
    firstTargetRef.current = queue.shift()!
    remaining1Ref.current = queue
  }
  if (isDuo && remaining2Ref.current === undefined) {
    remaining2Ref.current = shuffleArr([...pool2])
  }

  function getNextTargetFor(turnNum: 1 | 2): PoolEntry | null {
    const pool = turnNum === 1 ? pool1 : pool2
    const isSession = turnNum === 1 ? isSession1 : isSession2
    const remainingRef = turnNum === 1 ? remaining1Ref : remaining2Ref
    if (remainingRef.current!.length === 0) {
      if (isSession) { (turnNum === 1 ? done1Ref : done2Ref).current = true; return null }
      remainingRef.current = shuffleArr([...pool])
    }
    return remainingRef.current!.shift()!
  }

  const first = firstTargetRef.current!

  const [turn, setTurn] = useState<1 | 2>(1)
  const turnRef = useRef<1 | 2>(1)
  const [lanes, setLanes] = useState<LaneWord[]>(() => pickOptions(pool1, first))
  const [clue, setClue] = useState(first.clue)
  const [isEmojiClue, setIsEmojiClue] = useState(first.isEmoji)
  const [netLane, setNetLane] = useState(1)
  const [phase, setPhase] = useState<'playing' | 'caught' | 'end'>('playing')
  const [roundKey, setRoundKey] = useState(0)
  const [score, setScore] = useState(0)
  const [wordsCorrect, setWordsCorrect] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const fieldRef      = useRef<HTMLDivElement>(null)
  const bubbleElsRef  = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const laneXRef       = useRef<number[]>([0, 0, 0])
  const checkedRef     = useRef<boolean[]>([false, false, false])
  const netLaneRef     = useRef(1)
  const roundWonRef    = useRef(false)
  const draggingRef    = useRef(false)

  function resetLanePositions() {
    laneXRef.current = [0, 1, 2].map(() => FIELD_W + Math.random() * 60)
    checkedRef.current = [false, false, false]
    roundWonRef.current = false
  }

  // Seed positions once, same guarded style as the queue above.
  const posInitRef = useRef(false)
  if (!posInitRef.current) {
    posInitRef.current = true
    laneXRef.current = [0, 1, 2].map(() => FIELD_W + Math.random() * 60)
  }

  // Count-up timer
  useEffect(() => {
    if (phase === 'end') return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase === 'end'])

  // Game loop — direct DOM mutation for position (bypasses React state so 3
  // moving elements don't force a full re-render every frame); React state
  // only changes on discrete events (round setup, a catch, phase changes).
  useEffect(() => {
    if (phase !== 'playing') return
    let raf = 0
    let last = performance.now()
    function tick(now: number) {
      const dt = now - last
      last = now
      for (let i = 0; i < LANES; i++) {
        if (roundWonRef.current) break
        laneXRef.current[i] -= SPEED * dt
        if (laneXRef.current[i] <= NET_X + NET_W && !checkedRef.current[i]) {
          checkedRef.current[i] = true
          attemptCatch(i)
        }
        if (laneXRef.current[i] < -BUBBLE_W - 20) {
          laneXRef.current[i] = FIELD_W + Math.random() * 60
          checkedRef.current[i] = false
        }
        const el = bubbleElsRef.current[i]
        if (el) el.style.left = `${laneXRef.current[i]}px`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundKey])

  function attemptCatch(laneIdx: number) {
    if (netLaneRef.current !== laneIdx) return // net's in a different lane — word just sails past
    const opt = lanes[laneIdx]
    if (opt.isTarget) {
      roundWonRef.current = true
      sfxCorrect(); speak(opt.word)
      setScore(s => s + 100)
      setWordsCorrect(c => c + 1)
      onWordComplete?.()
      setPhase('caught')
      setTimeout(() => advanceRound(), 1300)
    } else {
      sfxTap() // harmless bounce — no penalty for a wrong-lane catch
    }
  }

  function advanceRound() {
    // Flip locally in sync with our own round cadence — not tied to the
    // parent's star-reward timer, which runs on a different delay.
    const nextTurn: 1 | 2 = isDuo && turnRef.current === 1 ? 2 : 1
    const next = getNextTargetFor(isDuo ? nextTurn : 1)
    if (!next) {
      // This player's queue just ran out — the round only truly ends once
      // every player who actually has session data has exhausted theirs.
      // A free-play player (no session for them) never blocks ending.
      const p1Finished = !isSession1 || done1Ref.current
      const p2Finished = !isDuo || !isSession2 || done2Ref.current
      if ((isSession1 || isSession2) && p1Finished && p2Finished) { setPhase('end'); return }
      // Otherwise just hand off to whichever player still has words left.
      const fallbackTurn: 1 | 2 = nextTurn === 1 ? 2 : 1
      const fallback = getNextTargetFor(isDuo ? fallbackTurn : 1)
      if (!fallback) { setPhase('end'); return }
      turnRef.current = fallbackTurn; setTurn(fallbackTurn)
      setLanes(pickOptions(fallbackTurn === 1 ? pool1 : pool2, fallback))
      setClue(fallback.clue); setIsEmojiClue(fallback.isEmoji)
      resetLanePositions(); setRoundKey(k => k + 1); setPhase('playing')
      setTimeout(() => speak(fallback.word.toLowerCase()), 400)
      return
    }
    turnRef.current = isDuo ? nextTurn : 1
    setTurn(turnRef.current)
    setLanes(pickOptions(turnRef.current === 1 ? pool1 : pool2, next))
    setClue(next.clue); setIsEmojiClue(next.isEmoji)
    resetLanePositions()
    setRoundKey(k => k + 1)
    setPhase('playing')
    setTimeout(() => speak(next.word.toLowerCase()), 400)
  }

  function setNetToClientY(clientY: number) {
    const field = fieldRef.current
    if (!field) return
    const rect = field.getBoundingClientRect()
    const y = clientY - rect.top
    const idx = Math.max(0, Math.min(LANES - 1, Math.floor(y / LANE_H)))
    netLaneRef.current = idx
    setNetLane(idx)
  }

  function moveNet(delta: number) {
    const idx = Math.max(0, Math.min(LANES - 1, netLaneRef.current + delta))
    netLaneRef.current = idx
    setNetLane(idx)
  }

  // Arrow keys as an alternative to dragging — same net, same lanes.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') { e.preventDefault(); moveNet(-1) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveNet(1) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function handlePointerDown(e: React.PointerEvent) {
    draggingRef.current = true
    setNetToClientY(e.clientY)
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    setNetToClientY(e.clientY)
  }
  function handlePointerUp() { draggingRef.current = false }

  const stars = wordsCorrect >= 10 ? 3 : wordsCorrect >= 5 ? 2 : wordsCorrect >= 1 ? 1 : 0
  const mm = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const ss = (elapsed % 60).toString().padStart(2, '0')

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '12px 12px 20px', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Catch and Match 🥅</div>
          <div style={{ fontSize: 13, color: '#A98B77' }}>ただしいことばをあみでキャッチ！</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#FFFFFF', borderRadius: 14, padding: '5px 12px', boxShadow: '0 3px 0 #E7D3C0', minWidth: 52 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#A98B77' }}>⏱</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#6B4F3F', lineHeight: 1 }}>{mm}:{ss}</div>
        </div>
      </div>

      {/* Clue */}
      <button onClick={() => speak(lanes.find(l => l.isTarget)?.word ?? '')}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontFamily: FONT, background: '#FFFFFF', borderRadius: 24, padding: '12px 32px', boxShadow: '0 8px 0 #EEDAC6' }}>
        {isEmojiClue
          ? <div style={{ fontSize: 60, lineHeight: 1, animation: 'kg-bounceIn .4s ease-out' }}>{clue}</div>
          : <div style={{ fontSize: 20, fontWeight: 800, color: '#6B4F3F', textAlign: 'center', lineHeight: 1.3 }}>{clue}</div>
        }
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#7FB8E0' }}>🔊 きく</div>
      </button>

      {/* Score */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#6B4F3F' }}>{score.toLocaleString()} pts</div>
        {isDuo && (
          <div style={{ fontSize: 13, fontWeight: 700, color: '#A98B77' }}>Player {turn}'s turn</div>
        )}
      </div>

      {/* Play field: 3 lanes, net on the left, words fly in from the right.
          Up/down tap buttons sit alongside as a guaranteed-reliable control
          for touch devices (and as a backup to the arrow-key listener). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          ref={fieldRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            position: 'relative', width: FIELD_W, height: LANE_H * LANES,
            background: 'linear-gradient(180deg, #EAF6FF 0%, #DCEEFB 100%)',
            borderRadius: 24, overflow: 'hidden', touchAction: 'none', cursor: 'grab',
            boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.04)',
          }}
        >
          {/* Lane dividers */}
          {[1, 2].map(i => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * LANE_H, height: 1, background: 'rgba(107,79,63,0.08)' }} />
          ))}

          {/* Net — mirrored so its opening faces right, toward the incoming words */}
          <div style={{
            position: 'absolute', left: NET_X, top: netLane * LANE_H + LANE_H / 2 - NET_W / 2,
            width: NET_W, height: NET_W, fontSize: NET_W, lineHeight: 1, zIndex: 2,
            transform: 'scaleX(-1)',
            transition: 'top .16s ease-out', pointerEvents: 'none', userSelect: 'none',
          }}>
            🥅
          </div>

          {/* Flying word bubbles */}
          {lanes.map((l, i) => (
            <div key={`${roundKey}-${i}`}
              ref={el => { bubbleElsRef.current[i] = el }}
              style={{
                position: 'absolute', top: i * LANE_H + (LANE_H - BUBBLE_H) / 2, left: laneXRef.current[i],
                width: BUBBLE_W, height: BUBBLE_H, borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: phase === 'caught' && l.isTarget ? '#EEFCF0' : '#FFFFFF',
                boxShadow: phase === 'caught' && l.isTarget ? '0 4px 0 #B8DFB8, 0 0 0 3px #5AB468' : '0 4px 0 #EEDAC6',
                fontWeight: 800, fontSize: 17, color: '#5A4336', userSelect: 'none',
                animation: phase === 'caught' && l.isTarget ? 'kg-pop .35s ease-out' : undefined,
              }}>
              {l.word}
            </div>
          ))}
        </div>

        {/* Up/down net controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => moveNet(-1)} aria-label="Move net up"
            style={{ border: 'none', cursor: 'pointer', width: 44, height: 44, borderRadius: 14, background: '#FFFFFF', boxShadow: '0 4px 0 #E7D3C0', fontSize: 20, color: '#6B4F3F' }}>
            ▲
          </button>
          <button onClick={() => moveNet(1)} aria-label="Move net down"
            style={{ border: 'none', cursor: 'pointer', width: 44, height: 44, borderRadius: 14, background: '#FFFFFF', boxShadow: '0 4px 0 #E7D3C0', fontSize: 20, color: '#6B4F3F' }}>
            ▼
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#A98B77', fontWeight: 700 }}>あみをうごかしてね · drag, tap ▲▼, or use ↑ ↓</div>

      {/* End screen */}
      {phase === 'end' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}>
          <div style={{ background: '#FFFBF4', borderRadius: 32, padding: '32px 44px', textAlign: 'center', fontFamily: FONT, boxShadow: '0 20px 60px rgba(0,0,0,.2)', animation: 'kg-pop .5s ease-out' }}>
            <div style={{ fontSize: 52 }}>{stars > 0 ? '⭐'.repeat(stars) : '💪'}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#5A4336', marginTop: 8 }}>おわり！</div>
            <div style={{ fontSize: 15, color: '#A98B77', marginTop: 6 }}>{wordsCorrect} words caught</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#E0A52E', marginTop: 10 }}>{score.toLocaleString()} pts</div>
            <button onClick={onBack} style={{ marginTop: 20, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 16, padding: '12px 28px', borderRadius: '999px', background: '#F2879B', color: '#fff', boxShadow: '0 5px 0 #D96C81' }}>
              おうちへ ←
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
