import React, { useEffect, useRef, useState } from 'react'
import type { VocabularyBankEntry } from '@/lib/types/database'

const COLS = 5, ROWS = 6, BALL = 54, GAP = 5
const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"

const BALL_POOL = [
  { emoji:'🐱', bg:'#FBD9E1', sh:'#E4BFCA' }, { emoji:'🐶', bg:'#FDE9C4', sh:'#E8D2A4' },
  { emoji:'🐻', bg:'#E8D8C8', sh:'#D0BCA8' }, { emoji:'🐰', bg:'#EDE4FF', sh:'#D4C8F0' },
  { emoji:'🐸', bg:'#D4F0DA', sh:'#B4D8BC' }, { emoji:'🐯', bg:'#FFF0C4', sh:'#E8D898' },
  { emoji:'🦊', bg:'#FFE4CC', sh:'#E8C8A4' }, { emoji:'🐨', bg:'#D8ECF8', sh:'#B8D4EC' },
  { emoji:'🐮', bg:'#F4F0D8', sh:'#DCD8B8' }, { emoji:'🐼', bg:'#E8E8E8', sh:'#D0D0D0' },
]
const LETTER_POOL = 'AAABBBCCDDDEEEFFGGGHHHIIIJJKKLLLMMMNNNOOOPPPRRRSSSTTTUUUVVWWXYYZ'

const FALLBACK = [
  { word:'CAT',   hint:'ねこ' },     { word:'DOG',   hint:'いぬ' },
  { word:'SUN',   hint:'たいよう' }, { word:'HAT',   hint:'ぼうし' },
  { word:'EGG',   hint:'たまご' },   { word:'CUP',   hint:'カップ' },
  { word:'BUS',   hint:'バス' },     { word:'FOX',   hint:'きつね' },
  { word:'BEE',   hint:'はち' },     { word:'COW',   hint:'うし' },
  { word:'PIG',   hint:'ぶた' },     { word:'ANT',   hint:'あり' },
  { word:'MAP',   hint:'ちず' },     { word:'BAG',   hint:'かばん' },
  { word:'KEY',   hint:'かぎ' },     { word:'BOX',   hint:'はこ' },
]

export type SessionWord = { word: string; hint: string }

type TsumBall = { id:number; char:string; emoji:string; bg:string; sh:string; row:number; col:number; popping:boolean }

function shuffleArr<T>(a: T[]): T[] {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildGrid(word: string): TsumBall[] {
  const positions = shuffleArr(Array.from({ length: COLS * ROWS }, (_, i) => i))
  const wordPos = new Set(positions.slice(0, word.length))
  // All word-letter balls share one emoji so the player can spot them at a glance
  const wordBp = BALL_POOL[Math.floor(Math.random() * BALL_POOL.length)]
  const fillerPool = BALL_POOL.filter(b => b.emoji !== wordBp.emoji)
  let wi = 0
  return Array.from({ length: COLS * ROWS }, (_, i) => {
    const isWord = wordPos.has(i)
    const bp = isWord ? wordBp : fillerPool[Math.floor(Math.random() * fillerPool.length)]
    return {
      id: i,
      char: isWord ? word[wi++] : LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)],
      emoji: bp.emoji, bg: bp.bg, sh: bp.sh,
      row: Math.floor(i / COLS), col: i % COLS, popping: false,
    }
  })
}

function findCorrectChain(word: string, balls: TsumBall[]): number[] {
  const used = new Set<number>()
  const ids: number[] = []
  for (const ch of word) {
    const ball = balls.find(b => b.char === ch && !used.has(b.id) && !b.popping)
    if (!ball) break
    used.add(ball.id); ids.push(ball.id)
  }
  return ids
}

interface Props {
  assignedVocab: VocabularyBankEntry[]
  sessionWords: SessionWord[]
  onBack: () => void
  onEnd?: (stats: { score: number; correct: number; attempted: number; streak: number }) => void
  onWordComplete?: () => void   // called once per correctly-spelled word — lets the
                                // parent alternate duo turns the same way Sing/Zoo/Words do
  sfxCorrect: () => void
  sfxWrong: () => void
  sfxTap: () => void
  speak: (t: string) => void
}

export function SpellTsumGame({ assignedVocab, sessionWords, onBack, onEnd, onWordComplete, sfxCorrect, sfxWrong, sfxTap, speak }: Props) {
  const [wordPool] = useState<SessionWord[]>(() => {
    if (sessionWords.length > 0) return sessionWords
    const spellable = assignedVocab.filter(e => {
      const w = e.word.trim()
      return w.length >= 2 && w.length <= 8 && /^[a-zA-Z]+$/.test(w)
    })
    if (spellable.length > 0) return spellable.map(e => ({
      word: e.word.trim().toUpperCase(),
      hint: e.definition_ja ?? e.definition_en ?? e.word,
    }))
    return FALLBACK
  })

  // Finite queue: one pass through all words, then end (if session) or reshuffle (if endless)
  const isSession = sessionWords.length > 0
  const remainingRef = useRef<SessionWord[] | undefined>(undefined)
  const firstWordRef = useRef<SessionWord | undefined>(undefined)
  // Pop the first word and seed the remaining queue exactly once. Guarded by
  // the ref (not a useState lazy initializer) so it stays correct even
  // though this runs in the render body: without the guard, every re-render
  // (the 1s elapsed timer, drag updates, etc.) would silently .shift() one
  // more word off the queue, draining a 5-word session before the child
  // ever finishes the first one and kicking the game to the end screen.
  if (remainingRef.current === undefined) {
    const queue = shuffleArr([...wordPool])
    firstWordRef.current = queue.shift()!
    remainingRef.current = queue
  }

  function getNext(): SessionWord | null {
    if (remainingRef.current!.length === 0) {
      if (isSession) return null
      remainingRef.current = shuffleArr([...wordPool])
    }
    return remainingRef.current!.shift()!
  }

  const first = firstWordRef.current!

  const [balls, setBalls]             = useState<TsumBall[]>(() => buildGrid(first.word))
  const [target, setTarget]           = useState<SessionWord>(first)
  const [chain, setChain]             = useState<number[]>([])
  const [dragPos, setDragPos]         = useState<{ x: number; y: number } | null>(null)
  const [score, setScore]             = useState(0)
  const [combo, setCombo]             = useState(1)
  const [streak, setStreak]           = useState(0)
  const [wordsAttempted, setWordsAttempted] = useState(0)
  const [wordsCorrect, setWordsCorrect]     = useState(0)
  const [elapsed, setElapsed]         = useState(0)
  const [phase, setPhase]             = useState<'playing' | 'end'>('playing')
  const [showStreak, setShowStreak]   = useState(false)
  const [wrongReveal, setWrongReveal] = useState(false)
  const [revealChain, setRevealChain] = useState<number[]>([])
  const [hintOn, setHintOn]           = useState(false)

  const gridRef        = useRef<HTMLDivElement>(null)
  const draggingRef    = useRef(false)
  const chainRef       = useRef<number[]>([])
  const revealingRef   = useRef(false)
  const wordStartRef   = useRef(Date.now())
  const streakBestRef  = useRef(0)

  useEffect(() => { chainRef.current = chain }, [chain])

  // Nudge a stuck child toward the next correct ball — covers both "hasn't
  // picked the first letter yet" (chain.length === 0) and "paused mid-word"
  // (chain.length > 0), since both just reset `chain`/`target` and restart
  // this same countdown. Cleared the instant they make progress or the word
  // changes, so it never fires while they're actively working.
  const HINT_DELAY_MS = 6000
  useEffect(() => {
    setHintOn(false)
    if (phase !== 'playing' || revealingRef.current) return
    const id = setTimeout(() => setHintOn(true), HINT_DELAY_MS)
    return () => clearTimeout(id)
  }, [chain, target, phase])

  // Count-up timer
  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'end') {
      onEnd?.({ score, correct: wordsCorrect, attempted: wordsAttempted, streak: streakBestRef.current })
    }
  // phase changing to 'end' is the only trigger we care about; values are committed by then
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => { setTimeout(() => speak(first.word.toLowerCase()), 400) }, [])

  function getBallAt(x: number, y: number): TsumBall | null {
    return balls.find(b => {
      if (b.popping) return false
      const cx = b.col * (BALL + GAP) + BALL / 2
      const cy = b.row * (BALL + GAP) + BALL / 2
      return Math.hypot(x - cx, y - cy) <= BALL / 2
    }) ?? null
  }

  function getGridXY(e: React.PointerEvent): { x: number; y: number } {
    const r = gridRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function advanceToNext() {
    revealingRef.current = false
    setWrongReveal(false); setRevealChain([])
    setChain([]); chainRef.current = []
    const nxt = getNext()
    if (!nxt) { setPhase('end'); return }
    setTarget(nxt)
    setBalls(buildGrid(nxt.word))
    wordStartRef.current = Date.now()
    speak(nxt.word.toLowerCase())
  }

  function retryCurrentWord(word: string) {
    revealingRef.current = false
    setWrongReveal(false); setRevealChain([])
    setChain([]); chainRef.current = []
    setBalls(buildGrid(word))
    wordStartRef.current = Date.now()
  }

  function handleDown(e: React.PointerEvent) {
    if (phase !== 'playing' || revealingRef.current) return
    e.preventDefault()
    const { x, y } = getGridXY(e)
    const ball = getBallAt(x, y)
    if (!ball || ball.char !== target.word[0]) return
    draggingRef.current = true
    setChain([ball.id]); chainRef.current = [ball.id]
    setDragPos({ x: ball.col * (BALL + GAP) + BALL / 2, y: ball.row * (BALL + GAP) + BALL / 2 })
    sfxTap()
    try { gridRef.current?.setPointerCapture(e.pointerId) } catch {}
  }

  function handleMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    const { x, y } = getGridXY(e)
    setDragPos({ x, y })
    const ball = getBallAt(x, y)
    if (!ball) return
    const cur = chainRef.current
    if (cur.includes(ball.id)) return
    if (ball.char !== target.word[cur.length]) return
    const nc = [...cur, ball.id]
    setChain(nc); chainRef.current = nc
    sfxTap()
  }

  function handleUp() {
    if (!draggingRef.current) return
    draggingRef.current = false; setDragPos(null)
    const cur = chainRef.current
    if (cur.length === target.word.length) {
      const secsTaken = Math.max(1, Math.round((Date.now() - wordStartRef.current) / 1000))
      const speedBonus = Math.max(0, 200 - secsTaken * 15)
      const nc = Math.min(4, +(combo + 0.5).toFixed(1))
      const pts = Math.round((100 + speedBonus) * nc)
      setScore(s => s + pts); setCombo(nc)
      const ns = streak + 1; setStreak(ns)
      if (ns > streakBestRef.current) streakBestRef.current = ns
      setWordsAttempted(w => w + 1); setWordsCorrect(w => w + 1)
      sfxCorrect(); speak(target.word.toLowerCase())
      onWordComplete?.()
      if (ns % 3 === 0) { setShowStreak(true); setTimeout(() => setShowStreak(false), 1800) }
      setBalls(bs => bs.map(b => cur.includes(b.id) ? { ...b, popping: true } : b))
      setTimeout(() => advanceToNext(), 420)
    } else if (cur.length > 0) {
      sfxWrong(); setCombo(1); setStreak(0)
      setWordsAttempted(w => w + 1)
      // Show correct answer briefly, then retry the same word
      revealingRef.current = true
      const correctIds = findCorrectChain(target.word, balls)
      setRevealChain(correctIds); setWrongReveal(true)
      setChain([]); chainRef.current = []
      const wordSnapshot = target.word
      setTimeout(() => retryCurrentWord(wordSnapshot), 2200)
    }
  }

  // Any ball matching the next needed character works (the game only checks
  // char, not a "designated" position), so reuse the same resolution the
  // wrong-answer reveal already uses to pick a real, selectable next ball.
  const hintBallId = hintOn && !wrongReveal && chain.length < target.word.length
    ? findCorrectChain(target.word, balls)[chain.length]
    : undefined

  const displayChain = wrongReveal ? revealChain : chain
  const chainPts = displayChain.map(id => {
    const b = balls.find(bb => bb.id === id)!
    return { x: b.col * (BALL + GAP) + BALL / 2, y: b.row * (BALL + GAP) + BALL / 2 }
  })
  const linePts = !wrongReveal && dragPos ? [...chainPts, dragPos] : chainPts

  const gridW   = COLS * (BALL + GAP) - GAP
  const gridH   = ROWS * (BALL + GAP) - GAP
  const stars   = wordsCorrect >= 10 ? 3 : wordsCorrect >= 5 ? 2 : wordsCorrect >= 1 ? 1 : 0
  const slotW   = Math.max(26, Math.min(36, Math.floor(180 / target.word.length)))
  const mm      = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const ss      = (elapsed % 60).toString().padStart(2, '0')
  const accuracy = wordsAttempted > 0 ? Math.round(wordsCorrect / wordsAttempted * 100) : 100

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '4px 12px 6px', fontFamily: FONT }}>

      {/* ── Top row: timer | slots | score ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: gridW + 40 }}>

        {/* Elapsed timer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#FFFFFF', borderRadius: 14, padding: '6px 12px', boxShadow: '0 3px 0 #E7D3C0', minWidth: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A98B77' }}>⏱</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#6B4F3F' }}>{mm}:{ss}</div>
        </div>

        {/* Letter slots */}
        <div style={{ display: 'flex', gap: 4 }}>
          {target.word.split('').map((ch, i) => {
            const filled  = wrongReveal ? i < revealChain.length : i < chain.length
            const isWrong = wrongReveal && filled
            return (
              <div key={i} style={{
                width: slotW, height: 38, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: Math.min(20, slotW - 4), fontFamily: FONT,
                background: isWrong ? '#FFF0C0' : filled ? '#F2879B' : '#FFFFFF',
                color: isWrong ? '#C07000' : filled ? '#fff' : '#EEDAC6',
                boxShadow: isWrong ? '0 3px 0 #D4A800' : filled ? '0 3px 0 #D96C81' : '0 3px 0 #E0CAB4',
                transition: 'background .15s',
              }}>{filled ? ch : ''}</div>
            )
          })}
        </div>

        {/* Score + combo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#6B4F3F' }}>{score.toLocaleString()}</div>
          {combo > 1 && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#F2879B', background: '#FBD9E1', padding: '2px 8px', borderRadius: '999px' }}>
              ×{combo.toFixed(1)}
            </div>
          )}
        </div>
      </div>

      {/* ── Japanese hint ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 20, fontWeight: 800, color: '#5A4336', letterSpacing: 1 }}>
        {target.hint}
        <button onClick={() => speak(target.word.toLowerCase())}
          style={{ border: 'none', cursor: 'pointer', background: 'none', fontSize: 16, padding: 0, lineHeight: 1 }}>
          🔊
        </button>
      </div>

      {/* ── Wrong reveal banner ── */}
      {wrongReveal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF8DC', border: '2px solid #F0D060', borderRadius: 14, padding: '6px 16px', fontSize: 14, fontWeight: 700, color: '#8B6000' }}>
          <span>💡 こたえ：</span>
          <span style={{ fontSize: 18, letterSpacing: 3, color: '#C07000' }}>{target.word}</span>
        </div>
      )}

      {/* ── Ball grid ── */}
      <div
        ref={gridRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        style={{ position: 'relative', width: gridW, height: gridH, touchAction: 'none', cursor: revealingRef.current ? 'default' : 'crosshair', flexShrink: 0 }}
      >
        {balls.map(b => {
          const inChain   = displayChain.includes(b.id)
          const isReveal  = wrongReveal && inChain
          const isHint    = b.id === hintBallId
          return (
            <div key={b.id} style={{
              position: 'absolute',
              left: b.col * (BALL + GAP), top: b.row * (BALL + GAP),
              width: BALL, height: BALL, borderRadius: '50%',
              background: isReveal ? '#FFF0C0' : b.bg,
              boxShadow: isReveal ? '0 4px 0 #D4A800, 0 0 0 3px #F0D060' : isHint ? `0 4px 0 ${b.sh}, 0 0 0 4px #F2879B` : `0 4px 0 ${b.sh}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              transition: 'transform .15s, opacity .3s',
              transform: b.popping ? 'scale(0)' : inChain ? 'scale(1.12)' : 'scale(1)',
              animation: isHint ? 'kg-twinkle .8s ease-in-out infinite' : undefined,
              opacity: b.popping ? 0 : 1,
              userSelect: 'none',
            }}>
              <div style={{ fontSize: 15, lineHeight: 1 }}>{b.emoji}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: isReveal ? '#8B6000' : '#5A4336', lineHeight: 1, fontFamily: FONT }}>
                {b.char}
              </div>
            </div>
          )
        })}

        {/* Chain line SVG */}
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={gridW} height={gridH}>
          {linePts.length > 1 && (
            <polyline
              points={linePts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={wrongReveal ? 'rgba(200,160,0,0.65)' : 'rgba(242,135,155,0.75)'}
              strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
            />
          )}
          {chainPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={BALL / 2 + 3}
              fill="none"
              stroke={wrongReveal ? 'rgba(200,160,0,0.5)' : 'rgba(242,135,155,0.5)'}
              strokeWidth={4} />
          ))}
        </svg>
      </div>

      {/* ── Hot streak banner ── */}
      {showStreak && (
        <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9999, pointerEvents: 'none', animation: 'kg-pop .4s ease-out', background: 'rgba(255,255,255,.96)', padding: '16px 32px', borderRadius: 28, boxShadow: '0 12px 40px rgba(0,0,0,.15)', textAlign: 'center', fontFamily: FONT }}>
          <div style={{ fontSize: 40 }}>🔥</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#F2879B' }}>れんぞく！すごい！</div>
        </div>
      )}

      {/* ── End screen ── */}
      {phase === 'end' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}>
          <div style={{ background: '#FFFBF4', borderRadius: 32, padding: '32px 44px', textAlign: 'center', fontFamily: FONT, boxShadow: '0 20px 60px rgba(0,0,0,.2)', animation: 'kg-pop .5s ease-out' }}>
            <div style={{ fontSize: 52 }}>{stars > 0 ? '⭐'.repeat(stars) : '💪'}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#5A4336', marginTop: 8 }}>おわり！</div>
            <div style={{ display: 'flex', gap: 20, marginTop: 10, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#F2879B' }}>{wordsCorrect}</div>
                <div style={{ fontSize: 12, color: '#A98B77' }}>せいかい</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#7FB8E0' }}>{accuracy}%</div>
                <div style={{ fontSize: 12, color: '#A98B77' }}>せいかいりつ</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#8BC273' }}>{mm}:{ss}</div>
                <div style={{ fontSize: 12, color: '#A98B77' }}>じかん</div>
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#E0A52E', marginTop: 10 }}>
              {score.toLocaleString()} pts
            </div>
            <button onClick={onBack} style={{ marginTop: 20, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 16, padding: '12px 28px', borderRadius: '999px', background: '#F2879B', color: '#fff', boxShadow: '0 5px 0 #D96C81' }}>
              おうちへ ←
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
