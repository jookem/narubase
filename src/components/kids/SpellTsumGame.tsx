import React, { useEffect, useRef, useState } from 'react'
import type { VocabularyBankEntry } from '@/lib/types/database'

const COLS = 5, ROWS = 6, BALL = 54, GAP = 5
const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"
const TOTAL_TIME = 60

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

type TsumBall = { id:number; char:string; emoji:string; bg:string; sh:string; row:number; col:number; popping:boolean }
type WordEntry = { word:string; hint:string }

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
  let wi = 0
  return Array.from({ length: COLS * ROWS }, (_, i) => {
    const bp = BALL_POOL[Math.floor(Math.random() * BALL_POOL.length)]
    return {
      id: i,
      char: wordPos.has(i) ? word[wi++] : LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)],
      emoji: bp.emoji, bg: bp.bg, sh: bp.sh,
      row: Math.floor(i / COLS), col: i % COLS, popping: false,
    }
  })
}

interface Props {
  assignedVocab: VocabularyBankEntry[]
  onBack: () => void
  sfxCorrect: () => void
  sfxWrong: () => void
  sfxTap: () => void
  speak: (t: string) => void
}

export function SpellTsumGame({ assignedVocab, onBack, sfxCorrect, sfxWrong, sfxTap, speak }: Props) {
  const wordPool: WordEntry[] = (() => {
    const spellable = assignedVocab.filter(e => {
      const w = e.word.trim()
      return w.length >= 2 && w.length <= 8 && /^[a-zA-Z]+$/.test(w)
    })
    if (spellable.length > 0) return spellable.map(e => ({
      word: e.word.trim().toUpperCase(),
      hint: e.definition_ja ?? e.definition_en ?? e.word,
    }))
    return FALLBACK
  })()

  const queueRef = useRef<WordEntry[]>([])
  function nextWord(): WordEntry {
    if (queueRef.current.length === 0) queueRef.current = shuffleArr([...wordPool])
    return queueRef.current.pop()!
  }

  const first = nextWord()
  const [balls, setBalls]         = useState<TsumBall[]>(() => buildGrid(first.word))
  const [target, setTarget]       = useState<WordEntry>(first)
  const [chain, setChain]         = useState<number[]>([])
  const [dragPos, setDragPos]     = useState<{ x: number; y: number } | null>(null)
  const [score, setScore]         = useState(0)
  const [combo, setCombo]         = useState(1)
  const [streak, setStreak]       = useState(0)
  const [timeLeft, setTimeLeft]   = useState(TOTAL_TIME)
  const [phase, setPhase]         = useState<'playing' | 'end'>('playing')
  const [wordsCount, setWordsCount] = useState(0)
  const [showStreak, setShowStreak] = useState(false)
  const [wrongFlash, setWrongFlash] = useState(false)

  const gridRef     = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const chainRef    = useRef<number[]>([])
  useEffect(() => { chainRef.current = chain }, [chain])

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return
    if (timeLeft <= 0) { setPhase('end'); return }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, phase])

  // Speak first word on mount
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

  function handleDown(e: React.PointerEvent) {
    if (phase !== 'playing') return
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
      const ns = streak + 1
      const nc = Math.min(4, +(combo + 0.5).toFixed(1))
      const pts = Math.round(target.word.length * 100 * nc)
      setScore(s => s + pts); setCombo(nc); setStreak(ns); setWordsCount(w => w + 1)
      sfxCorrect(); speak(target.word.toLowerCase())
      if (ns % 3 === 0) {
        setShowStreak(true); setTimeLeft(t => Math.min(TOTAL_TIME, t + 5))
        setTimeout(() => setShowStreak(false), 1800)
      }
      setBalls(bs => bs.map(b => cur.includes(b.id) ? { ...b, popping: true } : b))
      setTimeout(() => {
        const nxt = nextWord(); setTarget(nxt)
        setBalls(buildGrid(nxt.word))
        setChain([]); chainRef.current = []
        speak(nxt.word.toLowerCase())
      }, 420)
    } else if (cur.length > 0) {
      sfxWrong(); setCombo(1); setStreak(0)
      setWrongFlash(true); setTimeout(() => setWrongFlash(false), 400)
      setChain([]); chainRef.current = []
    }
  }

  const chainPts = chain.map(id => {
    const b = balls.find(bb => bb.id === id)!
    return { x: b.col * (BALL + GAP) + BALL / 2, y: b.row * (BALL + GAP) + BALL / 2 }
  })
  const linePts = dragPos ? [...chainPts, dragPos] : chainPts
  const gridW = COLS * (BALL + GAP) - GAP
  const gridH = ROWS * (BALL + GAP) - GAP
  const stars  = wordsCount >= 10 ? 3 : wordsCount >= 5 ? 2 : wordsCount >= 1 ? 1 : 0
  const R = 22, circ = 2 * Math.PI * R
  const slotW = Math.max(26, Math.min(36, Math.floor(180 / target.word.length)))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '4px 12px 6px', fontFamily: FONT }}>

      {/* ── Top row: timer | slots | score ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: gridW + 40 }}>

        {/* Circular countdown */}
        <svg width={56} height={56}>
          <circle cx={28} cy={28} r={R} fill={timeLeft <= 10 ? '#F2879B' : '#7FB8E0'} />
          <circle cx={28} cy={28} r={R} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={5}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - timeLeft / TOTAL_TIME)}
            strokeLinecap="round" transform="rotate(-90 28 28)" />
          <text x={28} y={33} textAnchor="middle" fill="white" fontSize={19} fontWeight={800}
            fontFamily={FONT}>{timeLeft}</text>
        </svg>

        {/* Letter slots */}
        <div style={{ display: 'flex', gap: 4, animation: wrongFlash ? 'kg-shake .35s' : undefined }}>
          {target.word.split('').map((ch, i) => (
            <div key={i} style={{
              width: slotW, height: 38, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: Math.min(20, slotW - 4), fontFamily: FONT,
              background: chain.length > i ? '#F2879B' : '#FFFFFF',
              color: chain.length > i ? '#fff' : '#EEDAC6',
              boxShadow: chain.length > i ? '0 3px 0 #D96C81' : '0 3px 0 #E0CAB4',
              transition: 'background .15s',
            }}>{chain.length > i ? ch : ''}</div>
          ))}
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

      {/* ── Ball grid ── */}
      <div
        ref={gridRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        style={{ position: 'relative', width: gridW, height: gridH, touchAction: 'none', cursor: 'crosshair', flexShrink: 0 }}
      >
        {balls.map(b => (
          <div key={b.id} style={{
            position: 'absolute',
            left: b.col * (BALL + GAP), top: b.row * (BALL + GAP),
            width: BALL, height: BALL, borderRadius: '50%',
            background: b.bg, boxShadow: `0 4px 0 ${b.sh}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            transition: 'transform .15s, opacity .3s',
            transform: b.popping ? 'scale(0)' : chain.includes(b.id) ? 'scale(1.12)' : 'scale(1)',
            opacity: b.popping ? 0 : 1,
            userSelect: 'none',
          }}>
            <div style={{ fontSize: 15, lineHeight: 1 }}>{b.emoji}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#5A4336', lineHeight: 1, fontFamily: FONT }}>{b.char}</div>
          </div>
        ))}

        {/* Chain line SVG overlay */}
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={gridW} height={gridH}>
          {linePts.length > 1 && (
            <polyline
              points={linePts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="rgba(242,135,155,0.75)" strokeWidth={7}
              strokeLinecap="round" strokeLinejoin="round"
            />
          )}
          {chainPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={BALL / 2 + 3}
              fill="none" stroke="rgba(242,135,155,0.5)" strokeWidth={4} />
          ))}
        </svg>
      </div>

      {/* ── Hot streak banner ── */}
      {showStreak && (
        <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9999, pointerEvents: 'none', animation: 'kg-pop .4s ease-out', background: 'rgba(255,255,255,.96)', padding: '16px 32px', borderRadius: 28, boxShadow: '0 12px 40px rgba(0,0,0,.15)', textAlign: 'center', fontFamily: FONT }}>
          <div style={{ fontSize: 40 }}>🔥</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#F2879B' }}>Hot Streak! +5s</div>
          <div style={{ fontSize: 14, color: '#A98B77' }}>すごい！れんぞく！</div>
        </div>
      )}

      {/* ── End screen ── */}
      {phase === 'end' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}>
          <div style={{ background: '#FFFBF4', borderRadius: 32, padding: '32px 44px', textAlign: 'center', fontFamily: FONT, boxShadow: '0 20px 60px rgba(0,0,0,.2)', animation: 'kg-pop .5s ease-out' }}>
            <div style={{ fontSize: 52 }}>{stars > 0 ? '⭐'.repeat(stars) : '💪'}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#5A4336', marginTop: 8 }}>おわり！</div>
            <div style={{ fontSize: 16, color: '#A98B77', marginTop: 6 }}>
              {wordsCount} words · {score.toLocaleString()} pts
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
