import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getStudentVocab } from '@/lib/api/lessons'
import type { VocabularyBankEntry } from '@/lib/types/database'

// ── Data ──────────────────────────────────────────────────────────

const WORDS: [string, string, string][] = [
  ['A','Apple','🍎'],['B','Ball','⚽'],['C','Cat','🐱'],['D','Dog','🐶'],['E','Egg','🥚'],
  ['F','Fish','🐟'],['G','Guitar','🎸'],['H','Hat','🎩'],['I','Igloo','🧊'],['J','Juice','🧃'],
  ['K','Kite','🪁'],['L','Lion','🦁'],['M','Music','🎵'],['N','Nest','🪺'],['O','Orange','🍊'],
  ['P','Piano','🎹'],['Q','Queen','👑'],['R','Rabbit','🐰'],['S','Sun','☀️'],['T','Tea','🍵'],
  ['U','Umbrella','☂️'],['V','Violin','🎻'],['W','Water','💧'],['X','Xylophone','🎼'],['Y','Yo-yo','🪀'],['Z','Zebra','🦓'],
]

const VOCAB: [string, string][] = [
  ['Apple','🍎'],['Cat','🐱'],['Dog','🐶'],['Fish','🐟'],['Ball','⚽'],['Guitar','🎸'],
  ['Hat','🎩'],['Sun','☀️'],['Tea','🍵'],['Cake','🍰'],['Star','⭐'],['Lion','🦁'],
  ['Rabbit','🐰'],['Kite','🪁'],['Egg','🥚'],['Piano','🎹'],['Bird','🐦'],['Flower','🌸'],
]

const SPELL: [string, string][] = [
  ['Cat','🐱'],['Dog','🐶'],['Sun','☀️'],['Hat','🎩'],['Tea','🍵'],['Egg','🥚'],
  ['Cup','☕'],['Pig','🐷'],['Bus','🚌'],['Fox','🦊'],['Bee','🐝'],['Cow','🐮'],
]

const STROKES: Record<string, number[][][]> = {
  A:[[[.5,0],[.1,1]],[[.5,0],[.9,1]],[[.23,.62],[.77,.62]]],
  B:[[[.2,0],[.2,1]],[[.2,0],[.62,.04],[.78,.25],[.62,.46],[.2,.5]],[[.2,.5],[.68,.54],[.85,.75],[.68,.96],[.2,1]]],
  C:[[[.85,.2],[.6,.03],[.3,.06],[.12,.32],[.1,.68],[.3,.94],[.6,.97],[.85,.8]]],
  D:[[[.2,0],[.2,1]],[[.2,0],[.58,.05],[.85,.3],[.85,.7],[.58,.95],[.2,1]]],
  E:[[[.2,0],[.2,1]],[[.2,0],[.82,0]],[[.2,.5],[.68,.5]],[[.2,1],[.82,1]]],
  F:[[[.2,0],[.2,1]],[[.2,0],[.82,0]],[[.2,.5],[.68,.5]]],
  G:[[[.85,.2],[.6,.03],[.3,.06],[.12,.32],[.1,.68],[.3,.94],[.62,.97],[.85,.8],[.85,.58],[.62,.58]]],
  H:[[[.2,0],[.2,1]],[[.8,0],[.8,1]],[[.2,.5],[.8,.5]]],
  I:[[[.3,0],[.7,0]],[[.5,0],[.5,1]],[[.3,1],[.7,1]]],
  J:[[[.45,0],[.85,0]],[[.7,0],[.7,.76],[.5,.96],[.28,.92],[.18,.72]]],
  K:[[[.2,0],[.2,1]],[[.78,0],[.2,.55]],[[.38,.42],[.8,1]]],
  L:[[[.2,0],[.2,1],[.8,1]]],
  M:[[[.14,1],[.14,0],[.5,.62],[.86,0],[.86,1]]],
  N:[[[.18,1],[.18,0],[.82,1],[.82,0]]],
  O:[[[.5,.03],[.22,.13],[.09,.42],[.12,.68],[.32,.94],[.6,.97],[.85,.78],[.9,.45],[.74,.13],[.5,.03]]],
  P:[[[.2,1],[.2,0],[.64,.04],[.8,.26],[.64,.48],[.2,.52]]],
  Q:[[[.5,.03],[.22,.13],[.09,.42],[.12,.68],[.32,.94],[.6,.97],[.85,.78],[.9,.45],[.74,.13],[.5,.03]],[[.6,.7],[.92,1.02]]],
  R:[[[.2,1],[.2,0],[.64,.04],[.8,.26],[.64,.48],[.2,.52]],[[.42,.52],[.82,1]]],
  S:[[[.83,.16],[.6,.03],[.32,.06],[.2,.26],[.36,.46],[.62,.56],[.8,.72],[.68,.95],[.38,.97],[.15,.82]]],
  T:[[[.12,0],[.88,0]],[[.5,0],[.5,1]]],
  U:[[[.18,0],[.18,.68],[.36,.94],[.64,.94],[.82,.68],[.82,0]]],
  V:[[[.12,0],[.5,1],[.88,0]]],
  W:[[[.07,0],[.3,1],[.5,.36],[.7,1],[.93,0]]],
  X:[[[.18,0],[.82,1]],[[.82,0],[.18,1]]],
  Y:[[[.18,0],[.5,.52]],[[.82,0],[.5,.52],[.5,1]]],
  Z:[[[.15,0],[.85,0],[.15,1],[.85,1]]],
}

const LSTROKES: Record<string, number[][][]> = {
  a:[[[.60,.50],[.46,.42],[.32,.50],[.30,.66],[.40,.80],[.56,.80],[.62,.70]],[[.62,.44],[.62,.82]]],
  b:[[[.30,.06],[.30,.82]],[[.30,.52],[.46,.45],[.60,.52],[.62,.66],[.50,.80],[.30,.80]]],
  c:[[[.62,.52],[.47,.42],[.32,.48],[.27,.64],[.34,.79],[.52,.82],[.64,.74]]],
  d:[[[.60,.50],[.46,.42],[.32,.50],[.30,.66],[.40,.80],[.56,.80],[.62,.72]],[[.62,.06],[.62,.82]]],
  e:[[[.28,.63],[.63,.62],[.60,.50],[.46,.42],[.32,.48],[.27,.64],[.36,.79],[.54,.82],[.65,.73]]],
  f:[[[.62,.14],[.50,.06],[.40,.12],[.39,.30],[.39,.82]],[[.24,.42],[.56,.42]]],
  g:[[[.60,.50],[.46,.42],[.32,.50],[.30,.64],[.40,.76],[.56,.76],[.62,.66]],[[.62,.44],[.62,.86],[.50,.98],[.34,.96],[.26,.86]]],
  h:[[[.30,.06],[.30,.82]],[[.30,.54],[.44,.44],[.58,.50],[.60,.64],[.60,.82]]],
  i:[[[.46,.42],[.46,.82]],[[.46,.24],[.46,.31]]],
  j:[[[.54,.42],[.54,.86],[.44,.98],[.30,.96],[.23,.86]],[[.54,.24],[.54,.31]]],
  k:[[[.30,.06],[.30,.82]],[[.60,.46],[.30,.64]],[[.40,.58],[.62,.82]]],
  l:[[[.46,.06],[.46,.82]]],
  m:[[[.20,.42],[.20,.82]],[[.20,.50],[.31,.44],[.42,.50],[.42,.82]],[[.42,.50],[.54,.44],[.66,.50],[.66,.82]]],
  n:[[[.30,.42],[.30,.82]],[[.30,.50],[.42,.44],[.56,.50],[.58,.62],[.58,.82]]],
  o:[[[.46,.42],[.31,.50],[.27,.64],[.35,.78],[.50,.82],[.64,.73],[.66,.57],[.57,.45],[.46,.42]]],
  p:[[[.30,.42],[.30,1.0]],[[.30,.50],[.46,.44],[.60,.52],[.62,.66],[.50,.80],[.30,.80]]],
  q:[[[.60,.50],[.46,.42],[.32,.50],[.30,.64],[.40,.78],[.56,.80],[.62,.72]],[[.62,.42],[.62,1.0],[.72,.92]]],
  r:[[[.32,.42],[.32,.82]],[[.32,.52],[.45,.44],[.58,.46]]],
  s:[[[.62,.50],[.48,.42],[.34,.46],[.34,.56],[.48,.62],[.60,.68],[.58,.78],[.44,.82],[.30,.76]]],
  t:[[[.45,.20],[.45,.74],[.55,.82],[.65,.78]],[[.26,.42],[.62,.42]]],
  u:[[[.30,.42],[.30,.70],[.42,.80],[.56,.78],[.62,.68]],[[.62,.42],[.62,.82]]],
  v:[[[.28,.42],[.46,.82],[.64,.42]]],
  w:[[[.20,.42],[.32,.82],[.44,.54],[.56,.82],[.68,.42]]],
  x:[[[.30,.42],[.62,.82]],[[.62,.42],[.30,.82]]],
  y:[[[.30,.42],[.46,.74]],[[.62,.42],[.46,.74],[.40,.92],[.28,.99]]],
  z:[[[.30,.42],[.62,.42],[.30,.82],[.64,.82]]],
}

type Screen = 'hub' | 'sing' | 'trace' | 'words' | 'spell'
type SlotEntry = { ch: string; tileId: number }
type Tile = { id: number; ch: string; used: boolean }

function shuffleArr<T>(a: T[]): T[] {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"
const BG = 'radial-gradient(120% 80% at 50% -10%, #FFFBF4 0%, #FBEFE0 55%, #F6E3CF 100%)'

const ARROW_BTN: React.CSSProperties = {
  border: 'none', cursor: 'pointer', fontFamily: FONT, width: 64, height: 64,
  borderRadius: '50%', background: '#FFFFFF', color: '#F2879B', fontSize: 40,
  fontWeight: 800, boxShadow: '0 5px 0 #EEDAC6', display: 'flex',
  alignItems: 'center', justifyContent: 'center', lineHeight: '1',
}
const BIG_BTN: React.CSSProperties = {
  border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800,
  fontSize: 20, padding: '16px 26px', borderRadius: '999px', color: '#fff',
  display: 'flex', alignItems: 'center', gap: 8,
}

// ── Main component ─────────────────────────────────────────────────

export function KidsGame() {
  // Core state
  const [screen, setScreen] = useState<Screen>('hub')
  const [stars, setStars] = useState(0)
  const [player, setPlayer] = useState<'solo' | 'duo'>('solo')
  const [turn, setTurn] = useState(1)
  const [stars1, setStars1] = useState(0)
  const [stars2, setStars2] = useState(0)
  const [sfxOn, setSfxOn] = useState(true)
  const [justRewarded, setJustRewarded] = useState(false)
  const [scorer, setScorer] = useState(0)

  // Sing / Trace
  const [letterIndex, setLetterIndex] = useState(0)
  const [traceCase, setTraceCase] = useState<'upper' | 'lower'>('upper')
  const [activeStroke, setActiveStroke] = useState(0)

  // Words
  const [wTarget, setWTarget] = useState('')
  const [wClue, setWClue] = useState('')   // emoji char OR definition text
  const [wIsEmoji, setWIsEmoji] = useState(true)
  const [wOptions, setWOptions] = useState<string[]>([])
  const [wWrong, setWWrong] = useState<string | null>(null)

  // Spell
  const [sWord, setSWord] = useState('')
  const [sEmoji, setSEmoji] = useState('')  // emoji char, empty when using assigned vocab
  const [sClue, setSClue] = useState('')    // definition hint when using assigned vocab
  const [sSlots, setSSlots] = useState<Array<SlotEntry | null>>([])
  const [sTiles, setSTiles] = useState<Tile[]>([])
  const [sShake, setSShake] = useState(false)

  // Assigned vocabulary
  const { user } = useAuth()
  const [assignedVocab, setAssignedVocab] = useState<VocabularyBankEntry[]>([])

  // Refs
  const guideCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const drawCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const prevPointRef = useRef<{ x: number; y: number } | null>(null)
  const acRef = useRef<AudioContext | null>(null)
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wordsQueueRef = useRef<{ key: string; indices: number[] }>({ key: '', indices: [] })
  const spellQueueRef = useRef<{ key: string; indices: number[] }>({ key: '', indices: [] })

  // Stable refs for values used inside intervals/callbacks
  const screenRef = useRef(screen)
  const letterIndexRef = useRef(letterIndex)
  const traceCaseRef = useRef(traceCase)
  const activeStrokeRef = useRef(activeStroke)

  useEffect(() => { screenRef.current = screen }, [screen])
  useEffect(() => { letterIndexRef.current = letterIndex }, [letterIndex])
  useEffect(() => { traceCaseRef.current = traceCase }, [traceCase])
  useEffect(() => { activeStrokeRef.current = activeStroke }, [activeStroke])
  useEffect(() => { clearDrawCanvas() }, [letterIndex, traceCase])

  // ── Load assigned vocabulary ───────────────────────────────────
  useEffect(() => {
    if (!user) return
    getStudentVocab(user.id).then(({ entries }) => {
      if (entries?.length) setAssignedVocab(entries)
    })
  }, [user])

  // ── Inject font + animations ───────────────────────────────────
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap'
    document.head.appendChild(link)

    if (!document.getElementById('kids-game-anims')) {
      const style = document.createElement('style')
      style.id = 'kids-game-anims'
      style.textContent = [
        '@keyframes kg-pop{0%{transform:scale(.4);opacity:0}50%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:1}}',
        '@keyframes kg-floaty{0%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-10px) rotate(4deg)}100%{transform:translateY(0) rotate(-4deg)}}',
        '@keyframes kg-twinkle{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.25);opacity:1}}',
        '@keyframes kg-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}',
        '@keyframes kg-bounceIn{0%{transform:scale(.6)}60%{transform:scale(1.08)}100%{transform:scale(1)}}',
      ].join('')
      document.head.appendChild(style)
    }

    return () => {
      try { document.head.removeChild(link) } catch {}
    }
  }, [])

  // ── Stroke animation interval ──────────────────────────────────
  useEffect(() => {
    if (screen !== 'trace') return
    const key = traceCase === 'lower'
      ? WORDS[letterIndex][0].toLowerCase()
      : WORDS[letterIndex][0]
    const S = (traceCase === 'lower' ? LSTROKES : STROKES)[key]
    if (!S || S.length < 2) return
    const id = setInterval(() => {
      if (screenRef.current !== 'trace') return
      setActiveStroke(s => {
        const next = (s + 1) % S.length
        activeStrokeRef.current = next
        return next
      })
    }, 1500)
    return () => clearInterval(id)
  }, [screen, letterIndex, traceCase])

  // ── Redraw guide when trace state changes ──────────────────────
  useEffect(() => {
    if (screen !== 'trace') return
    const t = setTimeout(() => drawGuide(), 30)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, letterIndex, traceCase, activeStroke])

  // ── Audio helpers ──────────────────────────────────────────────
  function ensureAudio() {
    if (!sfxOn) return false
    if (!acRef.current) {
      try { acRef.current = new (window.AudioContext || (window as any).webkitAudioContext)() } catch { return false }
    }
    if (acRef.current.state === 'suspended') acRef.current.resume()
    return true
  }

  function beep(freq: number, t0: number, dur: number, type: OscillatorType = 'sine', vol = 0.18) {
    const ac = acRef.current; if (!ac) return
    const o = ac.createOscillator(), g = ac.createGain()
    o.type = type; o.frequency.value = freq
    o.connect(g); g.connect(ac.destination)
    const t = ac.currentTime + t0
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t); o.stop(t + dur + 0.03)
  }

  function sfxCorrect() { if (!ensureAudio()) return; [523.25, 659.25, 783.99].forEach((f, k) => beep(f, k * 0.1, 0.2, 'triangle', 0.18)); beep(1046.5, 0.3, 0.25, 'triangle', 0.12) }
  function sfxWrong()   { if (!ensureAudio()) return; beep(311.13, 0, 0.16, 'sine', 0.14); beep(246.94, 0.13, 0.22, 'sine', 0.14) }
  function sfxTap()     { if (!ensureAudio()) return; beep(680, 0, 0.06, 'square', 0.06) }

  function speak(text: string) {
    try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.8; u.pitch = 1.1; window.speechSynthesis.speak(u) } catch {}
  }

  // ── Star / reward ──────────────────────────────────────────────
  function grantStar(advance: boolean) {
    sfxCorrect()
    const isDuo = player === 'duo'
    setScorer(isDuo ? turn : 0)
    setJustRewarded(true)
    if (isDuo) { if (turn === 1) setStars1(s => s + 1); else setStars2(s => s + 1) }
    else setStars(s => s + 1)

    if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current)
    const capturedTurn = turn; const capturedDuo = isDuo
    rewardTimerRef.current = setTimeout(() => {
      setJustRewarded(false)
      if (capturedDuo) setTurn(capturedTurn === 1 ? 2 : 1)
      if (advance) {
        const next = (letterIndexRef.current + 1) % 26
        setLetterIndex(next); letterIndexRef.current = next
        setActiveStroke(0); activeStrokeRef.current = 0
        clearDrawCanvas()
        setTimeout(() => drawGuide(), 40)
      }
    }, 1150)
  }

  // ── Trace canvas ───────────────────────────────────────────────
  function getStrokes() {
    const lower = traceCaseRef.current === 'lower'
    const key = lower ? WORDS[letterIndexRef.current][0].toLowerCase() : WORDS[letterIndexRef.current][0]
    return (lower ? LSTROKES : STROKES)[key]
  }

  function clearDrawCanvas() {
    const d = drawCanvasRef.current
    if (d) d.getContext('2d')?.clearRect(0, 0, d.width, d.height)
  }

  function drawArrow(ctx: CanvasRenderingContext2D, from: number[], to: number[], color: string) {
    const ang = Math.atan2(to[1] - from[1], to[0] - from[0]), len = 20
    ctx.save(); ctx.fillStyle = color; ctx.beginPath()
    ctx.moveTo(to[0], to[1])
    ctx.lineTo(to[0] - len * Math.cos(ang - 0.5), to[1] - len * Math.sin(ang - 0.5))
    ctx.lineTo(to[0] - len * Math.cos(ang + 0.5), to[1] - len * Math.sin(ang + 0.5))
    ctx.closePath(); ctx.fill(); ctx.restore()
  }

  function drawStrokeGuide(ctx: CanvasRenderingContext2D, S: number[][][]) {
    const L = 130, R = 390, T = 95, B = 425
    const mp = (p: number[]) => [L + p[0] * (R - L), T + p[1] * (B - T)]
    const active = ((activeStrokeRef.current % S.length) + S.length) % S.length
    S.forEach((stroke, si) => {
      const pts = stroke.map(mp)
      ctx.save(); ctx.lineWidth = 36; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = si === active ? 'rgba(127,184,224,0.42)' : 'rgba(127,184,224,0.13)'
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1])
      ctx.stroke(); ctx.restore()
    })
    const pts = S[active].map(mp)
    drawArrow(ctx, pts[pts.length - 2], pts[pts.length - 1], '#4E90C4')
    const s = pts[0]
    ctx.save(); ctx.fillStyle = '#4E90C4'; ctx.beginPath(); ctx.arc(s[0], s[1], 18, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = '800 23px "M PLUS Rounded 1c", sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(active + 1), s[0], s[1] + 1); ctx.restore()
  }

  function drawGuide() {
    const c = guideCanvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    const S = getStrokes()
    if (S) { drawStrokeGuide(ctx, S); return }
    const lower = traceCaseRef.current === 'lower'
    const ch = lower ? WORDS[letterIndexRef.current][0].toLowerCase() : WORDS[letterIndexRef.current][0]
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `800 ${lower ? 340 : 400}px "M PLUS Rounded 1c", system-ui, sans-serif`
    ctx.fillStyle = 'rgba(242,135,155,0.16)'; ctx.fillText(ch, c.width / 2, c.height / 2 + 18)
    ctx.lineWidth = 3; ctx.setLineDash([12, 16]); ctx.strokeStyle = 'rgba(242,135,155,0.55)'
    ctx.strokeText(ch, c.width / 2, c.height / 2 + 18); ctx.restore()
  }

  function posOf(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget, r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }

  function traceDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawCtxRef.current = e.currentTarget.getContext('2d')
    drawingRef.current = true
    const p = posOf(e), ctx = drawCtxRef.current!
    ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#F2879B'
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
    prevPointRef.current = p
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }
  function traceMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !drawCtxRef.current) return
    const p = posOf(e)
    const prev = prevPointRef.current
    if (!prev) { prevPointRef.current = p; return }
    const ctx = drawCtxRef.current
    const mid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 }
    ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(mid.x, mid.y)
    prevPointRef.current = p
  }
  function traceUp() { drawingRef.current = false; prevPointRef.current = null }

  // ── Letter navigation ──────────────────────────────────────────
  function setLetter(i: number) {
    setLetterIndex(i); letterIndexRef.current = i
    setActiveStroke(0); activeStrokeRef.current = 0
    clearDrawCanvas()
    setTimeout(() => drawGuide(), 40)
  }
  function nextLetter() { setLetter((letterIndex + 1) % 26) }
  function prevLetter() { setLetter((letterIndex + 25) % 26) }

  // ── Tea-Time Words ─────────────────────────────────────────────
  function nextFromQueue(ref: React.MutableRefObject<{ key: string; indices: number[] }>, poolSize: number, poolKey: string): number {
    const q = ref.current
    if (q.key !== poolKey || q.indices.length === 0) {
      const all = Array.from({ length: poolSize }, (_, i) => i)
      ref.current = { key: poolKey, indices: shuffleArr(all) }
    }
    return ref.current.indices.pop()!
  }

  function setupWords() {
    const useAssigned = assignedVocab.length >= 3
    if (useAssigned) {
      const pool = assignedVocab
      const ti = nextFromQueue(wordsQueueRef, pool.length, `assigned:${pool.length}`)
      const target = pool[ti]
      const others = shuffleArr(pool.filter((_, k) => k !== ti)).slice(0, 2)
      const opts = shuffleArr([target, ...others]).map(x => x.word)
      const clue = target.definition_ja ?? target.definition_en ?? target.reading ?? target.word
      setWTarget(target.word); setWClue(clue); setWIsEmoji(false)
      setWOptions(opts); setWWrong(null)
      setScreen('words')
      setTimeout(() => speak(target.word), 350)
    } else {
      const ti = nextFromQueue(wordsQueueRef, VOCAB.length, `vocab:${VOCAB.length}`)
      const target = VOCAB[ti]
      const others = shuffleArr(VOCAB.filter((_, k) => k !== ti)).slice(0, 2)
      const opts = shuffleArr([target, ...others]).map(x => x[0])
      setWTarget(target[0]); setWClue(target[1]); setWIsEmoji(true)
      setWOptions(opts); setWWrong(null)
      setScreen('words')
      setTimeout(() => speak(target[0]), 350)
    }
  }

  function checkWord(label: string) {
    if (label === wTarget) { speak(label); grantStar(false); setTimeout(() => setupWords(), 1250) }
    else { sfxWrong(); setWWrong(label); setTimeout(() => setWWrong(null), 550) }
  }

  // ── Spelling Stage ─────────────────────────────────────────────
  function setupSpell() {
    const spellable = assignedVocab.filter(e => {
      const w = e.word.trim()
      return w.length >= 2 && w.length <= 8 && /^[a-zA-Z]+$/.test(w)
    })
    if (spellable.length > 0) {
      const ti = nextFromQueue(spellQueueRef, spellable.length, `assigned:${spellable.length}`)
      const entry = spellable[ti]
      const word = entry.word.trim().toUpperCase()
      const tiles = shuffleArr(word.split('').map((ch, k) => ({ id: k, ch, used: false })))
      const clue = entry.definition_en ?? entry.definition_ja ?? entry.reading ?? ''
      setSWord(word); setSEmoji(''); setSClue(clue); setSTiles(tiles)
      setSSlots(word.split('').map(() => null)); setSShake(false)
      setScreen('spell')
      setTimeout(() => speak(entry.word), 350)
    } else {
      const ti = nextFromQueue(spellQueueRef, SPELL.length, `spell:${SPELL.length}`)
      const word = SPELL[ti][0].toUpperCase()
      const tiles = shuffleArr(word.split('').map((ch, k) => ({ id: k, ch, used: false })))
      setSWord(word); setSEmoji(SPELL[ti][1]); setSClue(''); setSTiles(tiles)
      setSSlots(word.split('').map(() => null)); setSShake(false)
      setScreen('spell')
      setTimeout(() => speak(SPELL[ti][0]), 350)
    }
  }

  function tapTile(id: number) {
    const tile = sTiles.find(t => t.id === id); if (!tile || tile.used) return
    const slotIdx = sSlots.findIndex(s => s === null); if (slotIdx < 0) return
    sfxTap()
    const newSlots = sSlots.slice(); newSlots[slotIdx] = { ch: tile.ch, tileId: id }
    const newTiles = sTiles.map(t => t.id === id ? { ...t, used: true } : t)
    setSSlots(newSlots); setSTiles(newTiles)
    checkSpellSlots(newSlots)
  }

  function tapSlot(idx: number) {
    const slot = sSlots[idx]; if (!slot) return
    setSTiles(tiles => tiles.map(t => t.id === slot.tileId ? { ...t, used: false } : t))
    const newSlots = sSlots.slice(); newSlots[idx] = null; setSSlots(newSlots)
  }

  function checkSpellSlots(slots: Array<SlotEntry | null>) {
    if (slots.some(s => s === null)) return
    const built = slots.map(s => s!.ch).join('')
    if (built === sWord) {
      speak(sWord); grantStar(false)
      setTimeout(() => setupSpell(), 1300)
    } else {
      sfxWrong(); setSShake(true)
      setTimeout(() => {
        setSShake(false)
        setSSlots(s => s.map(() => null))
        setSTiles(t => t.map(ti => ({ ...ti, used: false })))
      }, 750)
    }
  }

  function clearSpell() {
    setSSlots(s => s.map(() => null))
    setSTiles(t => t.map(ti => ({ ...ti, used: false })))
  }

  // ── Derived display values ─────────────────────────────────────
  const curLetter = WORDS[letterIndex][0]
  const curWord   = WORDS[letterIndex][1]
  const curEmoji  = WORDS[letterIndex][2]
  const duo = player === 'duo'

  const chipStyle = (idx: number): React.CSSProperties => idx === letterIndex
    ? { border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, width: 42, height: 42, borderRadius: 14, fontSize: 20, background: '#F2879B', color: '#fff', boxShadow: '0 3px 0 #D96C81' }
    : { border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, width: 42, height: 42, borderRadius: 14, fontSize: 20, background: '#FFFFFF', color: '#C7A892', boxShadow: '0 3px 0 #EEDAC6' }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', background: BG, fontFamily: FONT, color: '#6B4F3F', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', minHeight: 600 }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 12, flexWrap: 'wrap' }}>
        {/* Title / Back */}
        {screen === 'hub' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 22, color: '#F2879B' }}>
            <span>⭐</span><span>Kids English</span>
          </div>
        ) : (
          <button onClick={() => setScreen('hub')} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#FFFFFF', color: '#6B4F3F', fontFamily: FONT, fontWeight: 700, fontSize: 16, padding: '10px 18px', borderRadius: '999px', boxShadow: '0 4px 0 #E7D3C0' }}>
            ← Home <span style={{ opacity: .55, fontSize: 13 }}>おうち</span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* SFX */}
          <button onClick={() => setSfxOn(v => !v)} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, width: 44, height: 44, borderRadius: '50%', fontSize: 20, background: sfxOn ? '#FFFFFF' : '#EFE4D8', boxShadow: '0 3px 0 #E7D3C0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {sfxOn ? '🔊' : '🔇'}
          </button>

          {/* Solo/Duo */}
          <div style={{ display: 'flex', gap: 4, background: '#FFFFFF', padding: 5, borderRadius: '999px', boxShadow: '0 3px 0 #E7D3C0' }}>
            {(['solo', 'duo'] as const).map(mode => (
              <button key={mode} onClick={() => { setPlayer(mode); if (mode === 'duo') setTurn(1) }}
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 15, padding: '7px 13px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: 5, background: player === mode ? '#F2879B' : 'transparent', color: player === mode ? '#fff' : '#B79A86' }}>
                {mode === 'solo' ? '👧' : '👩‍👧'} <span style={{ fontSize: 12 }}>{mode === 'solo' ? 'ひとり' : 'いっしょ'}</span>
              </button>
            ))}
          </div>

          {/* Stars */}
          {!duo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF6DD', padding: '8px 14px', borderRadius: '999px', boxShadow: '0 3px 0 #F0DFA8' }}>
              <span style={{ fontSize: 20, animation: 'kg-twinkle 2.4s ease-in-out infinite' }}>⭐</span>
              <span style={{ fontWeight: 800, fontSize: 20, color: '#E0A52E' }}>{stars}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[1, 2].map(p => {
                const active = turn === p
                const s = p === 1 ? stars1 : stars2
                return (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: '999px', fontSize: 18, background: active ? (p === 1 ? '#FBD9E1' : '#E7DCF5') : '#FFFFFF', color: active ? (p === 1 ? '#D96C81' : '#7A5AC0') : '#B79A86', boxShadow: active ? `0 0 0 3px ${p === 1 ? '#F2879B' : '#9B7FD4'}` : '0 3px 0 #E7D3C0' }}>
                    {p === 1 ? '👧' : '👩'} <span style={{ fontWeight: 800 }}>{s}</span> <span style={{ fontSize: 15 }}>⭐</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── DUO TURN BANNER ── */}
      {duo && screen !== 'hub' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px 8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 18, padding: '8px 20px', borderRadius: '999px', background: turn === 1 ? '#FBD9E1' : '#E7DCF5', color: turn === 1 ? '#D96C81' : '#7A5AC0', boxShadow: '0 4px 0 rgba(0,0,0,.05)' }}>
            {turn === 1 ? '👧' : '👩'} {turn === 1 ? 'Player 1' : 'Player 2'} <span style={{ opacity: .85, fontWeight: 600, fontSize: 14 }}>{turn === 1 ? 'きみのばん' : 'ともだちのばん'}</span>
          </div>
        </div>
      )}

      {/* ═══════════════ HUB ═══════════════ */}
      {screen === 'hub' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 20px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#6B4F3F' }}>Pick a game! 🎶</div>
            <div style={{ fontSize: 16, color: '#A98B77', marginTop: 4 }}>どのあそびにする？</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 16, width: '100%', maxWidth: 800 }}>
            {([
              { key: 'sing'  as Screen, title: 'ABC Song',      jp: 'えいごのうた', skill: '🗣 Speaking', emoji: '🎤', bg: '#FBD9E1' },
              { key: 'trace' as Screen, title: 'Trace Letters', jp: 'もじをなぞる', skill: '✏️ Writing',  emoji: '✏️', bg: '#FBE7B6' },
              { key: 'words' as Screen, title: 'Word Match',    jp: 'たんごあそび', skill: '🍰 Vocabulary',emoji: '🍰', bg: '#D8ECC4' },
              { key: 'spell' as Screen, title: 'Spelling',      jp: 'スペリング',   skill: '🎸 Spelling',  emoji: '🎸', bg: '#CFE7F6' },
            ] as const).map(s => (
              <button key={s.key}
                onClick={() => {
                  if (s.key === 'words') setupWords()
                  else if (s.key === 'spell') setupSpell()
                  else { setScreen(s.key); if (s.key === 'trace') setTimeout(() => drawGuide(), 40) }
                }}
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left', padding: 18, borderRadius: 24, boxShadow: '0 8px 0 rgba(0,0,0,.06)', background: s.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, boxShadow: '0 4px 10px rgba(0,0,0,.10)', flexShrink: 0 }}>
                    {s.emoji}
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#5A4336', lineHeight: 1.2 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: '#9A7B66', marginTop: 2 }}>{s.jp}</div>
                    <div style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700, color: '#7A5C49', background: 'rgba(255,255,255,.7)', padding: '4px 10px', borderRadius: '999px' }}>{s.skill}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ SING ═══════════════ */}
      {screen === 'sing' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '6px 20px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Listen and say it! 🎤</div>
            <div style={{ fontSize: 15, color: '#A98B77' }}>きいて、いってみよう</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={prevLetter} style={ARROW_BTN}>‹</button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#FFFFFF', borderRadius: 32, padding: '22px 40px', boxShadow: '0 10px 0 #EEDAC6', minWidth: 280 }}>
              <div style={{ fontSize: 130, fontWeight: 800, lineHeight: 1, color: '#F2879B' }}>
                {curLetter}<span style={{ color: '#F6B8C4' }}>{curLetter.toLowerCase()}</span>
              </div>
              <div style={{ fontSize: 72, margin: '6px 0 2px', animation: 'kg-floaty 3s ease-in-out infinite' }}>{curEmoji}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#6B4F3F' }}>{curWord}</div>
            </div>
            <button onClick={nextLetter} style={ARROW_BTN}>›</button>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => speak(curLetter)} style={{ ...BIG_BTN, background: '#7FB8E0', boxShadow: '0 5px 0 #5E9BC7' }}>🔊 Hear letter <span style={{ opacity: .7, fontSize: 13 }}>もじ</span></button>
            <button onClick={() => speak(curWord)}   style={{ ...BIG_BTN, background: '#8BC273', boxShadow: '0 5px 0 #6FA458' }}>🔊 Hear word <span style={{ opacity: .7, fontSize: 13 }}>たんご</span></button>
            <button onClick={() => grantStar(true)}  style={{ ...BIG_BTN, background: '#F2879B', boxShadow: '0 5px 0 #D96C81' }}>✓ I said it! <span style={{ opacity: .85, fontSize: 13 }}>いえた！</span></button>
          </div>
          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 700 }}>
            {WORDS.map((w, idx) => <button key={idx} onClick={() => setLetter(idx)} style={chipStyle(idx)}>{w[0]}</button>)}
          </div>
        </div>
      )}

      {/* ═══════════════ TRACE ═══════════════ */}
      {screen === 'trace' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '6px 20px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Trace the letter ✏️</div>
            <div style={{ fontSize: 15, color: '#A98B77' }}>ゆびで なぞってみよう</div>
          </div>
          <div style={{ display: 'flex', gap: 8, background: '#FFFFFF', padding: 5, borderRadius: '999px', boxShadow: '0 3px 0 #EEDAC6', marginBottom: 10 }}>
            {(['upper', 'lower'] as const).map(c => (
              <button key={c} onClick={() => { setTraceCase(c); traceCaseRef.current = c; setActiveStroke(0); activeStrokeRef.current = 0; clearDrawCanvas(); setTimeout(() => drawGuide(), 40) }}
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 20, padding: '7px 16px', borderRadius: '999px', background: traceCase === c ? '#F2879B' : 'transparent', color: traceCase === c ? '#fff' : '#C7A892', display: 'flex', alignItems: 'center', gap: 4 }}>
                {c === 'upper' ? 'A' : 'a'} <span style={{ fontSize: 12 }}>{c === 'upper' ? '大もじ' : '小もじ'}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: '#A98B77', marginBottom: 8, fontWeight: 600 }}>①②③ Watch the order, then trace — ばんごうの じゅんに かいてね</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={prevLetter} style={ARROW_BTN}>‹</button>
            <div style={{ background: '#FFFFFF', borderRadius: 28, padding: 12, boxShadow: '0 8px 0 #EEDAC6' }}>
              <div style={{ position: 'relative', width: 'min(44vh,360px)', height: 'min(44vh,360px)' }}>
                <canvas ref={guideCanvasRef} width={520} height={520} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 18, background: '#FFFDF8' }} />
                <canvas ref={drawCanvasRef} width={520} height={520}
                  onPointerDown={traceDown} onPointerMove={traceMove} onPointerUp={traceUp} onPointerLeave={traceUp}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 18, background: 'transparent', touchAction: 'none', cursor: 'crosshair' }} />
              </div>
            </div>
            <button onClick={nextLetter} style={ARROW_BTN}>›</button>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => speak(curLetter)}  style={{ ...BIG_BTN, background: '#7FB8E0', boxShadow: '0 5px 0 #5E9BC7' }}>🔊 Hear it <span style={{ opacity: .7, fontSize: 13 }}>きく</span></button>
            <button onClick={clearDrawCanvas}         style={{ ...BIG_BTN, background: '#C9BBB0', boxShadow: '0 5px 0 #A89789' }}>🧽 Clear <span style={{ opacity: .7, fontSize: 13 }}>けす</span></button>
            <button onClick={() => grantStar(true)}   style={{ ...BIG_BTN, background: '#F2879B', boxShadow: '0 5px 0 #D96C81' }}>✓ Done! <span style={{ opacity: .85, fontSize: 13 }}>できた！</span></button>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 700 }}>
            {WORDS.map((w, idx) => <button key={idx} onClick={() => setLetter(idx)} style={chipStyle(idx)}>{w[0]}</button>)}
          </div>
        </div>
      )}

      {/* ═══════════════ WORDS ═══════════════ */}
      {screen === 'words' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '6px 20px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>What is it? 🍰</div>
            <div style={{ fontSize: 15, color: '#A98B77' }}>これは なに？　いって、タップ</div>
          </div>
          <button onClick={() => speak(wTarget)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, border: 'none', cursor: 'pointer', fontFamily: FONT, background: '#FFFFFF', borderRadius: 32, padding: '22px 50px', boxShadow: '0 10px 0 #EEDAC6', maxWidth: 340 }}>
            {wIsEmoji
              ? <div style={{ fontSize: 110, lineHeight: 1, animation: 'kg-bounceIn .4s ease-out' }}>{wClue}</div>
              : <div style={{ fontSize: 26, fontWeight: 800, color: '#6B4F3F', textAlign: 'center', lineHeight: 1.4, minHeight: 80, display: 'flex', alignItems: 'center' }}>{wClue}</div>
            }
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#7FB8E0' }}>🔊 Hear it <span style={{ color: '#A98B77', fontWeight: 500, fontSize: 13 }}>きく</span></div>
          </button>
          <div style={{ display: 'flex', gap: 14, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
            {wOptions.map(label => (
              <button key={label} onClick={() => checkWord(label)}
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 24, padding: '16px 26px', borderRadius: 20, minWidth: 140, boxShadow: '0 6px 0 #EEDAC6', background: wWrong === label ? '#FBD9D9' : '#FFFFFF', color: wWrong === label ? '#D96C81' : '#6B4F3F', animation: wWrong === label ? 'kg-shake .45s' : undefined }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ SPELL ═══════════════ */}
      {screen === 'spell' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '6px 20px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Spell the word! 🎸</div>
            <div style={{ fontSize: 15, color: '#A98B77' }}>ことばを つくろう</div>
          </div>
          <button onClick={() => speak(sWord)} style={{ display: 'flex', alignItems: 'center', gap: 14, border: 'none', cursor: 'pointer', fontFamily: FONT, background: '#FFFFFF', borderRadius: 24, padding: '14px 28px', boxShadow: '0 8px 0 #EEDAC6', maxWidth: 360 }}>
            {sEmoji
              ? <span style={{ fontSize: 64, lineHeight: 1, animation: 'kg-bounceIn .4s ease-out' }}>{sEmoji}</span>
              : sClue
                ? <span style={{ fontSize: 18, fontWeight: 700, color: '#6B4F3F', lineHeight: 1.4, textAlign: 'left', maxWidth: 220 }}>{sClue}</span>
                : null
            }
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 15, fontWeight: 700, color: '#7FB8E0', flexShrink: 0 }}>🔊 <span style={{ color: '#A98B77', fontWeight: 500, fontSize: 13 }}>きく</span></span>
          </button>
          {/* Slots */}
          <div style={{ display: 'flex', gap: 12, marginTop: 22, justifyContent: 'center', animation: sShake ? 'kg-shake .5s' : undefined }}>
            {sSlots.map((slot, idx) => (
              <div key={idx} onClick={() => tapSlot(idx)}
                style={{ width: 58, height: 68, border: slot ? '3px solid #F2879B' : '3px dashed #E3C9B6', borderRadius: 16, background: slot ? '#FFF' : '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, color: '#F2879B', cursor: 'pointer' }}>
                {slot?.ch ?? ''}
              </div>
            ))}
          </div>
          {/* Tiles */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 520 }}>
            {sTiles.map(t => (
              <button key={t.id} onClick={() => tapTile(t.id)}
                style={{ border: 'none', cursor: t.used ? 'default' : 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 28, width: 58, height: 58, borderRadius: 16, background: t.used ? '#F3EADb' : '#FCE9B8', color: t.used ? 'transparent' : '#6B4F3F', boxShadow: t.used ? 'inset 0 2px 6px rgba(0,0,0,.06)' : '0 4px 0 #E6CE8F', pointerEvents: t.used ? 'none' : 'auto' }}>
                {t.ch}
              </button>
            ))}
          </div>
          <button onClick={clearSpell} style={{ ...BIG_BTN, background: '#C9BBB0', boxShadow: '0 5px 0 #A89789', marginTop: 22 }}>
            🧽 Clear <span style={{ opacity: .7, fontSize: 13 }}>けす</span>
          </button>
        </div>
      )}

      {/* ═══════════════ REWARD OVERLAY ═══════════════ */}
      {justRewarded && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 9999 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.95)', padding: '30px 48px', borderRadius: 36, boxShadow: '0 16px 50px rgba(0,0,0,.18)', animation: 'kg-pop .5s ease-out' }}>
            <div style={{ fontSize: 80 }}>⭐</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#E0A52E' }}>Great! <span style={{ color: '#F2879B' }}>じょうず！</span></div>
            <div style={{ fontSize: 16, color: '#A98B77' }}>
              {duo ? `${scorer === 1 ? '👧 Player 1' : '👩 Player 2'}  +1 ⭐` : '+1 star'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
