import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getStudentVocab, rateVocabCard } from '@/lib/api/lessons'
import { getClassmates, saveKidSession, type Classmate } from '@/lib/api/kids'
import { supabase } from '@/lib/supabase'
import type { VocabularyBankEntry } from '@/lib/types/database'
import { LikeGame } from './LikeGame'
import { SpellTsumGame, type SessionWord } from './SpellTsumGame'
import { PhonicsGame } from './phonics/PhonicsGame'

type StudyCard = SessionWord & Pick<VocabularyBankEntry, 'id' | 'mastery_level' | 'interval_days' | 'ease_factor'>

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
  L:[[[.2,0],[.2,1]],[[.2,1],[.8,1]]],
  M:[[[.14,0],[.14,1]],[[.14,0],[.5,.56]],[[.5,.56],[.86,0]],[[.86,0],[.86,1]]],
  N:[[[.18,0],[.18,1]],[[.18,0],[.82,1]],[[.82,0],[.82,1]]],
  O:[[[.5,.03],[.3,.06],[.12,.22],[.07,.46],[.1,.7],[.28,.92],[.5,.97],[.72,.92],[.9,.7],[.93,.46],[.88,.22],[.7,.06],[.5,.03]]],
  P:[[[.2,0],[.2,1]],[[.2,0],[.64,.04],[.8,.26],[.64,.48],[.2,.52]]],
  Q:[[[.5,.03],[.22,.13],[.09,.42],[.12,.68],[.32,.94],[.6,.97],[.85,.78],[.9,.45],[.74,.13],[.5,.03]],[[.6,.7],[.92,1.02]]],
  R:[[[.2,0],[.2,1]],[[.2,0],[.64,.04],[.8,.26],[.64,.48],[.2,.52]],[[.42,.52],[.82,1]]],
  S:[[[.83,.16],[.6,.03],[.32,.06],[.2,.26],[.36,.46],[.62,.56],[.8,.72],[.68,.95],[.38,.97],[.15,.82]]],
  T:[[[.12,0],[.88,0]],[[.5,0],[.5,1]]],
  U:[[[.18,0],[.18,.68],[.36,.94],[.64,.94],[.82,.68],[.82,0]]],
  V:[[[.12,0],[.5,1]],[[.5,1],[.88,0]]],
  W:[[[.07,0],[.3,1]],[[.3,1],[.5,.36]],[[.5,.36],[.7,1]],[[.7,1],[.93,0]]],
  X:[[[.18,0],[.82,1]],[[.82,0],[.18,1]]],
  Y:[[[.18,0],[.5,.52]],[[.82,0],[.5,.52]],[[.5,.52],[.5,1]]],
  Z:[[[.15,0],[.85,0]],[[.85,0],[.15,1]],[[.15,1],[.85,1]]],
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
  i:[[[.46,.42],[.46,.82]],[[.46,.265],[.46,.27]]],
  j:[[[.54,.42],[.54,.86],[.44,.98],[.30,.96],[.23,.86]],[[.54,.265],[.54,.27]]],
  k:[[[.30,.06],[.30,.82]],[[.60,.46],[.30,.64]],[[.40,.58],[.62,.82]]],
  l:[[[.46,.06],[.46,.82]]],
  m:[[[.20,.42],[.20,.82]],[[.20,.50],[.31,.44],[.42,.50],[.42,.82]],[[.42,.50],[.54,.44],[.66,.50],[.66,.82]]],
  n:[[[.30,.42],[.30,.82]],[[.30,.50],[.42,.44],[.56,.50],[.58,.62],[.58,.82]]],
  o:[[[.46,.42],[.35,.44],[.27,.52],[.25,.64],[.30,.76],[.42,.82],[.54,.80],[.64,.72],[.67,.60],[.64,.48],[.54,.42],[.46,.42]]],
  p:[[[.30,.42],[.30,1.0]],[[.30,.50],[.46,.44],[.60,.52],[.62,.66],[.50,.80],[.30,.80]]],
  q:[[[.60,.50],[.46,.42],[.32,.50],[.30,.64],[.40,.78],[.56,.80],[.62,.72]],[[.62,.42],[.62,1.0],[.72,.92]]],
  r:[[[.32,.42],[.32,.82]],[[.32,.52],[.45,.44],[.58,.46]]],
  s:[[[.62,.50],[.48,.42],[.34,.46],[.34,.56],[.48,.62],[.60,.68],[.58,.78],[.44,.82],[.30,.76]]],
  t:[[[.45,.20],[.45,.74],[.55,.82],[.65,.78]],[[.26,.42],[.62,.42]]],
  u:[[[.30,.42],[.30,.70],[.42,.80],[.56,.78],[.62,.68]],[[.62,.42],[.62,.82]]],
  v:[[[.28,.42],[.46,.82]],[[.46,.82],[.64,.42]]],
  w:[[[.20,.42],[.32,.82]],[[.32,.82],[.44,.54]],[[.44,.54],[.56,.82]],[[.56,.82],[.68,.42]]],
  x:[[[.30,.42],[.62,.82]],[[.62,.42],[.30,.82]]],
  y:[[[.30,.42],[.46,.74]],[[.62,.42],[.46,.74],[.40,.92],[.28,.99]]],
  z:[[[.30,.42],[.62,.42]],[[.62,.42],[.30,.82]],[[.30,.82],[.64,.82]]],
}

type ZooEntry = { animal: string; animalEmoji: string; food: string; foodEmoji: string; sound: 'chomp' | 'gulp' }
const ZOO_DATA: ZooEntry[] = [
  { animal:'Alligator',  animalEmoji:'🐊', food:'Apple',      foodEmoji:'🍎', sound:'chomp' },
  { animal:'Bear',       animalEmoji:'🐻', food:'Banana',     foodEmoji:'🍌', sound:'chomp' },
  { animal:'Cat',        animalEmoji:'🐱', food:'Carrot',     foodEmoji:'🥕', sound:'chomp' },
  { animal:'Dog',        animalEmoji:'🐶', food:'Donut',      foodEmoji:'🍩', sound:'chomp' },
  { animal:'Elephant',   animalEmoji:'🐘', food:'Egg',        foodEmoji:'🥚', sound:'gulp'  },
  { animal:'Fox',        animalEmoji:'🦊', food:'Fish',       foodEmoji:'🐟', sound:'chomp' },
  { animal:'Gorilla',    animalEmoji:'🦍', food:'Grapes',     foodEmoji:'🍇', sound:'chomp' },
  { animal:'Horse',      animalEmoji:'🐴', food:'Hay',        foodEmoji:'🌾', sound:'chomp' },
  { animal:'Iguana',     animalEmoji:'🦎', food:'Ice Cream',  foodEmoji:'🍦', sound:'gulp'  },
  { animal:'Jaguar',     animalEmoji:'🐆', food:'Juice',      foodEmoji:'🧃', sound:'gulp'  },
  { animal:'Kangaroo',   animalEmoji:'🦘', food:'Kiwi',       foodEmoji:'🥝', sound:'chomp' },
  { animal:'Lion',       animalEmoji:'🦁', food:'Lemon',      foodEmoji:'🍋', sound:'chomp' },
  { animal:'Monkey',     animalEmoji:'🐒', food:'Mango',      foodEmoji:'🥭', sound:'chomp' },
  { animal:'Narwhal',    animalEmoji:'🦭', food:'Noodles',    foodEmoji:'🍜', sound:'gulp'  },
  { animal:'Owl',        animalEmoji:'🦉', food:'Orange',     foodEmoji:'🍊', sound:'chomp' },
  { animal:'Penguin',    animalEmoji:'🐧', food:'Pear',       foodEmoji:'🍐', sound:'gulp'  },
  { animal:'Quail',      animalEmoji:'🐦', food:'Quinoa',     foodEmoji:'🥣', sound:'gulp'  },
  { animal:'Rabbit',     animalEmoji:'🐰', food:'Rice',       foodEmoji:'🍚', sound:'chomp' },
  { animal:'Snake',      animalEmoji:'🐍', food:'Strawberry', foodEmoji:'🍓', sound:'gulp'  },
  { animal:'Tiger',      animalEmoji:'🐯', food:'Tomato',     foodEmoji:'🍅', sound:'chomp' },
  { animal:'Unicorn',    animalEmoji:'🦄', food:'Udon',       foodEmoji:'🍝', sound:'gulp'  },
  { animal:'Vulture',    animalEmoji:'🦅', food:'Vegetables', foodEmoji:'🥦', sound:'chomp' },
  { animal:'Wolf',       animalEmoji:'🐺', food:'Watermelon', foodEmoji:'🍉', sound:'chomp' },
  { animal:'X-ray Fish', animalEmoji:'🐠', food:'Worm',       foodEmoji:'🪱', sound:'gulp'  },
  { animal:'Yak',        animalEmoji:'🐃', food:'Yam',        foodEmoji:'🍠', sound:'chomp' },
  { animal:'Zebra',      animalEmoji:'🦓', food:'Zucchini',   foodEmoji:'🥒', sound:'chomp' },
]

type Screen = 'hub' | 'sing' | 'trace' | 'words' | 'spell' | 'like' | 'zoo' | 'study' | 'phonics'
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
  border: 'none', cursor: 'pointer', fontFamily: FONT, width: 52, height: 52,
  borderRadius: '50%', background: '#FFFFFF', color: '#F2879B', fontSize: 32,
  fontWeight: 800, boxShadow: '0 5px 0 #EEDAC6', display: 'flex',
  alignItems: 'center', justifyContent: 'center', lineHeight: '1',
}
const BIG_BTN: React.CSSProperties = {
  border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800,
  fontSize: 16, padding: '11px 18px', borderRadius: '999px', color: '#fff',
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

  // Multi-student
  const [player1Name, setPlayer1Name] = useState('Player 1')
  const [player2Name, setPlayer2Name] = useState('Player 2')
  const [player2Id, setPlayer2Id] = useState<string | null>(null)
  const [classmates, setClassmates] = useState<Classmate[]>([])
  const [showPicker, setShowPicker] = useState(false)

  // Sing / Trace
  const [letterIndex, setLetterIndex] = useState(0)
  const [traceCase, setTraceCase] = useState<'upper' | 'lower'>('upper')
  const [activeStroke, setActiveStroke] = useState(0)

  // Sing / Letter recognition
  const [singTarget, setSingTarget] = useState('')
  const [singOptions, setSingOptions] = useState<string[]>([])
  const [singWrong, setSingWrong] = useState<string | null>(null)
  const [singElapsed, setSingElapsed] = useState(0)
  const [singDone, setSingDone] = useState(false)
  const singCountRef = useRef(0)

  // Words
  const [wTarget, setWTarget] = useState('')
  const [wClue, setWClue] = useState('')   // emoji char OR definition text
  const [wIsEmoji, setWIsEmoji] = useState(true)
  const [wOptions, setWOptions] = useState<string[]>([])
  const [wWrong, setWWrong] = useState<string | null>(null)
  const [wElapsed, setWElapsed] = useState(0)

  // Session / Study
  const [sessionWords, setSessionWords] = useState<SessionWord[]>([])
  const [studyPool, setStudyPool] = useState<StudyCard[]>([])
  const [studyIdx, setStudyIdx] = useState(0)
  const [studyFlipped, setStudyFlipped] = useState(false)
  const [studyTurn, setStudyTurn] = useState<1 | 2>(1)
  const [p1StudyDone, setP1StudyDone] = useState(false)
  const [p2StudyDone, setP2StudyDone] = useState(false)

  // Zoo
  const [zooPhase, setZooPhase] = useState<'trace' | 'feed'>('trace')
  const [zooAccuracy, setZooAccuracy] = useState(0)
  const [zooFed, setZooFed] = useState(false)
  const [zooDragPos, setZooDragPos] = useState<{ x: number; y: number } | null>(null)
  const [zooDragging, setZooDragging] = useState(false)
  const [zooDone, setZooDone] = useState(false)
  const zooFedSetRef = useRef<Set<number>>(new Set())

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
  const zooAnimalRef = useRef<HTMLDivElement>(null)
  const zooDragStartRef = useRef<{ ox: number; oy: number; ex: number; ey: number } | null>(null)

  const guideCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const drawCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const prevPointRef = useRef<{ x: number; y: number } | null>(null)
  const acRef = useRef<AudioContext | null>(null)
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wordsQueueRef = useRef<{ key: string; indices: number[] }>({ key: '', indices: [] })
  const spellQueueRef = useRef<{ key: string; indices: number[] }>({ key: '', indices: [] })
  const singQueueRef  = useRef<{ key: string; indices: number[] }>({ key: '', indices: [] })
  const wStartRef     = useRef(Date.now())
  const singStartRef  = useRef(Date.now())

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

  // ── Word Match timer — resets each time a new word is shown ──
  useEffect(() => {
    if (screen !== 'words') return
    setWElapsed(0); wStartRef.current = Date.now()
    const id = setInterval(() => setWElapsed(Math.floor((Date.now() - wStartRef.current) / 1000)), 200)
    return () => clearInterval(id)
  }, [screen, wTarget])

  // ── Letter recognition timer — resets each new letter ──
  useEffect(() => {
    if (screen !== 'sing') return
    setSingElapsed(0); singStartRef.current = Date.now()
    const id = setInterval(() => setSingElapsed(Math.floor((Date.now() - singStartRef.current) / 1000)), 200)
    return () => clearInterval(id)
  }, [screen, singTarget])

  // ── Load assigned vocabulary ───────────────────────────────────
  useEffect(() => {
    if (!user) return
    getStudentVocab(user.id).then(({ entries }) => {
      // Phonics-sourced words ride the same SRS table but shouldn't surface
      // in these generic vocab minigames — Phonics Quest reviews them itself.
      if (entries?.length) setAssignedVocab(entries.filter(e => !e.is_phonics))
    })
    supabase.from('profiles').select('full_name').eq('id', user.id).single()
      .then(({ data }) => { if (data?.full_name) setPlayer1Name(data.full_name.split(' ')[0]) })
    getClassmates(user.id).then(list => setClassmates(list))
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
        '.kg-hub-scroll{overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(200,170,150,0.5) transparent}',
        '.kg-hub-scroll::-webkit-scrollbar{width:8px}',
        '.kg-hub-scroll::-webkit-scrollbar-track{background:transparent}',
        '.kg-hub-scroll::-webkit-scrollbar-thumb{background:rgba(200,170,150,0.45);border-radius:4px}',
        '.kg-hub-scroll::-webkit-scrollbar-thumb:hover{background:rgba(200,170,150,0.75)}',
      ].join('')
      document.head.appendChild(style)
    }

    return () => {
      try { document.head.removeChild(link) } catch {}
    }
  }, [])

  // ── Stroke animation interval ──────────────────────────────────
  useEffect(() => {
    if (screen !== 'trace' && screen !== 'zoo') return
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
    if (screen !== 'trace' && screen !== 'zoo') return
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
  function sfxChomp() {
    if (!ensureAudio()) return
    ;[0, 0.07, 0.14].forEach(t => { beep(220, t, 0.07, 'square', 0.11); beep(170, t + 0.03, 0.05, 'square', 0.07) })
  }
  function sfxGulp() {
    if (!ensureAudio()) return
    beep(340, 0, 0.04, 'sine', 0.14); beep(210, 0.05, 0.12, 'sine', 0.17); beep(110, 0.16, 0.2, 'sine', 0.11)
  }

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
      const n = pts.length
      const isClosed = n > 2 && Math.abs(pts[0][0] - pts[n-1][0]) < 1 && Math.abs(pts[0][1] - pts[n-1][1]) < 1
      ctx.save(); ctx.lineWidth = 36; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = si === active ? 'rgba(127,184,224,0.42)' : 'rgba(127,184,224,0.13)'
      ctx.beginPath()
      if (isClosed) {
        const c = n - 1
        const mid0 = [(pts[c-1][0] + pts[0][0]) / 2, (pts[c-1][1] + pts[0][1]) / 2]
        ctx.moveTo(mid0[0], mid0[1])
        for (let k = 0; k < c; k++) {
          const nx = (k + 1) % c
          const mid = [(pts[k][0] + pts[nx][0]) / 2, (pts[k][1] + pts[nx][1]) / 2]
          ctx.quadraticCurveTo(pts[k][0], pts[k][1], mid[0], mid[1])
        }
        ctx.closePath()
      } else if (n > 2) {
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let k = 1; k < n - 1; k++) {
          const mid = [(pts[k][0] + pts[k+1][0]) / 2, (pts[k][1] + pts[k+1][1]) / 2]
          ctx.quadraticCurveTo(pts[k][0], pts[k][1], mid[0], mid[1])
        }
        ctx.lineTo(pts[n-1][0], pts[n-1][1])
      } else {
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let k = 1; k < n; k++) ctx.lineTo(pts[k][0], pts[k][1])
      }
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

  function calcAccuracy(): number {
    const draw = drawCanvasRef.current; if (!draw) return 0
    const drawCtx = draw.getContext('2d'); if (!drawCtx) return 0
    const { data: drawData } = drawCtx.getImageData(0, 0, 520, 520)
    const hasAlpha = (px: number, py: number) => {
      const x = Math.round(px), y = Math.round(py)
      if (x < 0 || x >= 520 || y < 0 || y >= 520) return false
      return drawData[(y * 520 + x) * 4 + 3] > 30
    }
    const S = getStrokes()
    const L = 130, R = 390, T = 95, B = 425
    if (!S) return 0
    let total = 0, covered = 0
    S.forEach(stroke => {
      for (let si = 0; si < stroke.length - 1; si++) {
        const [ax, ay] = stroke[si], [bx, by] = stroke[si + 1]
        const px0 = L + ax * (R - L), py0 = T + ay * (B - T)
        const px1 = L + bx * (R - L), py1 = T + by * (B - T)
        const steps = Math.max(1, Math.floor(Math.hypot(px1 - px0, py1 - py0) / 10))
        for (let k = 0; k <= steps; k++) {
          const fx = px0 + (px1 - px0) * (k / steps), fy = py0 + (py1 - py0) * (k / steps)
          total++
          let hit = false
          outer: for (let dx = -18; dx <= 18; dx += 3) {
            for (let dy = -18; dy <= 18; dy += 3) {
              if (hasAlpha(fx + dx, fy + dy)) { hit = true; break outer }
            }
          }
          if (hit) covered++
        }
      }
    })
    return total === 0 ? 0 : Math.min(100, Math.round(covered / total * 100))
  }

  // ── Letter navigation ──────────────────────────────────────────
  function setLetter(i: number) {
    setLetterIndex(i); letterIndexRef.current = i
    setActiveStroke(0); activeStrokeRef.current = 0
    clearDrawCanvas()
    setTimeout(() => drawGuide(), 40)
  }
  function nextLetter() { setLetter((letterIndex + 1) % 26) }
  function prevLetter() { setLetter((letterIndex + 25) % 26) }

  // ── Letter Recognition ────────────────────────────────────────
  function startSing() {
    singCountRef.current = 0
    setSingDone(false)
    setupSing()
  }

  function setupSing() {
    const idx = nextFromQueue(singQueueRef, 26, 'abc:26')
    const letter = WORDS[idx][0]
    const wrongs = shuffleArr(WORDS.filter((_, i) => i !== idx)).slice(0, 3).map(w => w[0])
    setSingTarget(letter)
    setSingOptions(shuffleArr([letter, ...wrongs]))
    setSingWrong(null)
    setScreen('sing')
    setTimeout(() => speak(letter), 350)
  }

  function checkSing(letter: string) {
    if (letter === singTarget) {
      speak(letter); grantStar(false)
      singCountRef.current += 1
      if (singCountRef.current >= 26) setTimeout(() => setSingDone(true), 1250)
      else setTimeout(() => setupSing(), 1250)
    } else {
      sfxWrong(); setSingWrong(letter)
      setTimeout(() => setSingWrong(null), 550)
    }
  }

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
    if (sessionWords.length >= 3) {
      const pool = sessionWords
      const ti = nextFromQueue(wordsQueueRef, pool.length, `session:${pool.length}`)
      const target = pool[ti]
      const others = shuffleArr(pool.filter((_, k) => k !== ti)).slice(0, 2)
      const opts = shuffleArr([target, ...others]).map(x => x.word)
      setWTarget(target.word); setWClue(target.hint); setWIsEmoji(false)
      setWOptions(opts); setWWrong(null)
      setScreen('words')
      setTimeout(() => speak(target.word.toLowerCase()), 350)
      return
    }
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

  // ── Alphabet Zoo ───────────────────────────────────────────────
  function startZoo() {
    zooFedSetRef.current = new Set()
    setZooDone(false)
    setupZoo()
  }

  function setupZoo() {
    setZooPhase('trace'); setZooAccuracy(0); setZooFed(false)
    setZooDragPos(null); setZooDragging(false)
    clearDrawCanvas(); setScreen('zoo')
    setTimeout(() => drawGuide(), 40)
  }

  function zooTraceDone() {
    const acc = calcAccuracy()
    setZooAccuracy(acc); setZooPhase('feed')
    speak(ZOO_DATA[letterIndexRef.current].animal)
  }

  function zooFoodDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    zooDragStartRef.current = { ox: r.left + r.width / 2, oy: r.top + r.height / 2, ex: e.clientX, ey: e.clientY }
    setZooDragging(true)
    setZooDragPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }

  function zooFoodMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!zooDragStartRef.current) return
    const { ox, oy, ex, ey } = zooDragStartRef.current
    setZooDragPos({ x: ox + e.clientX - ex, y: oy + e.clientY - ey })
  }

  function zooFoodUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!zooDragStartRef.current) return
    const { ox, oy, ex, ey } = zooDragStartRef.current
    const dropX = ox + e.clientX - ex, dropY = oy + e.clientY - ey
    zooDragStartRef.current = null; setZooDragging(false); setZooDragPos(null)
    const animal = zooAnimalRef.current; if (!animal || zooFed) return
    const r = animal.getBoundingClientRect(); const pad = 50
    const hit = dropX >= r.left - pad && dropX <= r.right + pad && dropY >= r.top - pad && dropY <= r.bottom + pad
    if (hit) {
      setZooFed(true)
      const zoo = ZOO_DATA[letterIndexRef.current]
      if (zoo.sound === 'chomp') sfxChomp(); else sfxGulp()
      setTimeout(() => grantStar(true), 300)
      zooFedSetRef.current.add(letterIndexRef.current)
      const zooFinished = zooFedSetRef.current.size >= 26
      setTimeout(() => {
        if (zooFinished) { setZooDone(true); return }
        setZooPhase('trace'); setZooAccuracy(0); setZooFed(false)
        clearDrawCanvas(); setTimeout(() => drawGuide(), 40)
      }, 1500)
    }
  }

  // ── Derived display values ─────────────────────────────────────
  const curLetter = WORDS[letterIndex][0]
  const curWord   = WORDS[letterIndex][1]
  const curEmoji  = WORDS[letterIndex][2]
  const duo = player === 'duo'

  const chipStyle = (idx: number): React.CSSProperties => idx === letterIndex
    ? { border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, width: 36, height: 36, borderRadius: 12, fontSize: 17, background: '#F2879B', color: '#fff', boxShadow: '0 3px 0 #D96C81' }
    : { border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, width: 36, height: 36, borderRadius: 12, fontSize: 17, background: '#FFFFFF', color: '#C7A892', boxShadow: '0 3px 0 #EEDAC6' }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', background: BG, fontFamily: FONT, color: '#6B4F3F', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', height: 'calc(100vh - 110px)', minHeight: 520 }}>

      {/* ── TOP BAR ── */}
      {screen !== 'like' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 12, flexWrap: 'wrap' }}>
        {/* Title / Back + duo turn pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {screen === 'hub' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 22, color: '#F2879B' }}>
              <span>⭐</span><span>Kids English</span>
            </div>
          ) : (
            <button onClick={() => setScreen('hub')} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#FFFFFF', color: '#6B4F3F', fontFamily: FONT, fontWeight: 700, fontSize: 16, padding: '10px 18px', borderRadius: '999px', boxShadow: '0 4px 0 #E7D3C0' }}>
              ← Home <span style={{ opacity: .55, fontSize: 13 }}>おうち</span>
            </button>
          )}
          {duo && screen !== 'hub' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 14, padding: '6px 14px', borderRadius: '999px', background: turn === 1 ? '#FBD9E1' : '#E7DCF5', color: turn === 1 ? '#D96C81' : '#7A5AC0', boxShadow: '0 3px 0 rgba(0,0,0,.06)' }}>
              {turn === 1 ? '👧' : '👩'} {turn === 1 ? player1Name : player2Name} <span style={{ opacity: .75, fontWeight: 600, fontSize: 12 }}>{turn === 1 ? 'きみのばん' : 'ともだちのばん'}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* SFX */}
          <button onClick={() => setSfxOn(v => !v)} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, width: 44, height: 44, borderRadius: '50%', fontSize: 20, background: sfxOn ? '#FFFFFF' : '#EFE4D8', boxShadow: '0 3px 0 #E7D3C0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {sfxOn ? '🔊' : '🔇'}
          </button>

          {/* Solo/Duo */}
          <div style={{ display: 'flex', gap: 4, background: '#FFFFFF', padding: 5, borderRadius: '999px', boxShadow: '0 3px 0 #E7D3C0' }}>
            {(['solo', 'duo'] as const).map(mode => (
              <button key={mode} onClick={() => {
                if (mode === 'solo') { setPlayer('solo'); setPlayer2Id(null); setPlayer2Name('Player 2') }
                else setShowPicker(true)
              }}
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
                    {p === 1 ? '👧' : '👩'} <span style={{ fontWeight: 700, fontSize: 12, maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p === 1 ? player1Name : player2Name}</span> <span style={{ fontWeight: 800 }}>{s}</span> <span style={{ fontSize: 15 }}>⭐</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>}


{/* ═══════════════ HUB ═══════════════ */}
      {screen === 'hub' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Pinned header */}
          <div style={{ textAlign: 'center', padding: '12px 20px 10px', flexShrink: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#6B4F3F' }}>Pick a game! 🎶</div>
            <div style={{ fontSize: 16, color: '#A98B77', marginTop: 4 }}>どのあそびにする？</div>
            {duo ? (
              (p1StudyDone || p2StudyDone) && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, background: '#D4ECF8', color: '#2E7DA8', fontWeight: 700, fontSize: 13, padding: '5px 14px', borderRadius: '999px' }}>
                  📚
                  <span>{player1Name} {p1StudyDone ? '✓' : '—'}</span>
                  <span style={{ opacity: .4 }}>·</span>
                  <span>{player2Name} {p2StudyDone ? '✓' : '—'}</span>
                  {sessionWords.length > 0 && <><span style={{ opacity: .4 }}>·</span><span>{sessionWords.length} words</span></>}
                </div>
              )
            ) : (
              sessionWords.length > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: '#D4ECF8', color: '#2E7DA8', fontWeight: 700, fontSize: 13, padding: '5px 14px', borderRadius: '999px' }}>
                  📚 セッション中 · {sessionWords.length} words ready
                </div>
              )
            )}
          </div>
          {/* Scrollable grid */}
          <div className="kg-hub-scroll" style={{ flex: 1, padding: '4px 20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 16, width: '100%', maxWidth: 800, margin: '0 auto' }}>
            {([
              { key: 'study' as Screen, title: 'Study Words',   jp: 'たんごれんしゅう', skill: '📚 Review', emoji: '📚', bg: sessionWords.length > 0 ? '#D4ECF8' : '#EDE4FF' },
              { key: 'sing'  as Screen, title: 'ABC Listen',     jp: 'もじをきこう', skill: '👂 Listening', emoji: '👂', bg: '#FBD9E1' },
              { key: 'zoo'   as Screen, title: 'Alphabet Zoo',  jp: 'どうぶつえん', skill: '✏️ Writing',  emoji: '🦁', bg: '#D4F0D8' },
              { key: 'words' as Screen, title: 'Word Match',    jp: 'たんごあそび', skill: '🍰 Vocabulary',emoji: '🍰', bg: '#D8ECC4' },
              { key: 'spell' as Screen, title: 'Spelling',      jp: 'スペリング',   skill: '🎸 Spelling',  emoji: '🎸', bg: '#CFE7F6' },
              { key: 'like'  as Screen, title: 'Like & Dislike',jp: 'すきなもの',   skill: '💬 Speaking',  emoji: '🔮', bg: '#F0E0FF' },
              { key: 'phonics' as Screen, title: 'Phonics Quest', jp: 'フォニックス', skill: '🔤 Reading', emoji: '🦆', bg: '#FFE4C4' },
            ] as const).map(s => (
              <button key={s.key}
                onClick={() => {
                  if (s.key === 'words') setupWords()
                  else if (s.key === 'sing') startSing()
                  else if (s.key === 'spell') setScreen('spell')
                  else if (s.key === 'zoo') startZoo()
                  else if (s.key === 'study') {
                    const pool = shuffleArr(
                      assignedVocab
                        .map(e => ({ id: e.id, word: e.word.trim().toUpperCase(), hint: e.definition_ja ?? e.definition_en ?? e.word, mastery_level: e.mastery_level, interval_days: e.interval_days, ease_factor: e.ease_factor }))
                        .filter(e => e.word.length > 0 && /^[A-Z]/.test(e.word))
                    ).slice(0, 5)
                    setStudyPool(pool); setStudyTurn(1)
                    setP1StudyDone(false); setP2StudyDone(false)
                    setStudyIdx(0); setStudyFlipped(false); setScreen('study')
                  }
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
        </div>
      )}

      {/* ═══ scrollable wrapper for all game screens ═══ */}
      {screen !== 'hub' && (
      <div className="kg-hub-scroll" style={{ flex: 1, overflowY: 'auto' }}>

      {/* ═══════════════ ABC LISTEN ═══════════════ */}
      {screen === 'sing' && singDone && (
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 60 }}>🎉</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#5A4336' }}>ぜんぶきけた！</div>
          <div style={{ fontSize: 15, color: '#A98B77' }}>All 26 letters done!</div>
          <button onClick={startSing}
            style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 16, padding: '12px 28px', borderRadius: '999px', background: '#F2879B', color: '#fff', boxShadow: '0 5px 0 #D96C81' }}>
            もう一度あそぶ · Play Again
          </button>
        </div>
      )}

      {screen === 'sing' && !singDone && (
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 24px 20px', gap: 20 }}>
          {/* Header + timer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Which letter? 👂</div>
              <div style={{ fontSize: 13, color: '#A98B77' }}>きこえたもじをえらぼう！ · Say it too!</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#FFFFFF', borderRadius: 14, padding: '5px 12px', boxShadow: '0 3px 0 #E7D3C0', minWidth: 52 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#A98B77' }}>⏱</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#6B4F3F', lineHeight: 1 }}>{singElapsed}s</div>
            </div>
          </div>

          {/* Listen button */}
          <button onClick={() => speak(singTarget)}
            style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, background: '#FFFFFF', borderRadius: 28, padding: '18px 52px', boxShadow: '0 10px 0 #EEDAC6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 56, lineHeight: 1, animation: 'kg-floaty 2.4s ease-in-out infinite' }}>🔊</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7FB8E0' }}>もう一度きく · Listen again</div>
          </button>

          {/* Wrong-answer nudge */}
          {singWrong && (
            <div style={{ fontSize: 14, fontWeight: 800, color: '#D96C81', animation: 'kg-pop .25s ease-out' }}>
              ちがう！ Try again 👆
            </div>
          )}

          {/* 2×2 letter choice grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, width: '100%', maxWidth: 360 }}>
            {singOptions.map(letter => (
              <button key={letter} onClick={() => checkSing(letter)}
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 72, lineHeight: 1, padding: '18px 0', borderRadius: 24, background: singWrong === letter ? '#FBD9D9' : '#FFFFFF', color: singWrong === letter ? '#D96C81' : '#F2879B', boxShadow: singWrong === letter ? '0 6px 0 #E4BFCA' : '0 8px 0 #EEDAC6', animation: singWrong === letter ? 'kg-shake .45s' : undefined }}>
                {letter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ TRACE ═══════════════ */}
      {screen === 'trace' && (
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 8px' }}>
          {/* Title + case toggle on one row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>Trace ✏️ </span>
            <div style={{ display: 'flex', gap: 6, background: '#FFFFFF', padding: 3, borderRadius: '999px', boxShadow: '0 3px 0 #EEDAC6' }}>
              {(['upper', 'lower'] as const).map(c => (
                <button key={c} onClick={() => { setTraceCase(c); traceCaseRef.current = c; setActiveStroke(0); activeStrokeRef.current = 0; clearDrawCanvas(); setTimeout(() => drawGuide(), 40) }}
                  style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 14, padding: '4px 12px', borderRadius: '999px', background: traceCase === c ? '#F2879B' : 'transparent', color: traceCase === c ? '#fff' : '#C7A892', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {c === 'upper' ? 'A' : 'a'} <span style={{ fontSize: 10 }}>{c === 'upper' ? '大もじ' : '小もじ'}</span>
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: '#A98B77', fontWeight: 600 }}>①②③ trace in order</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {/* ‹ canvas › */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={prevLetter} style={ARROW_BTN}>‹</button>
              <div style={{ background: '#FFFFFF', borderRadius: 22, padding: 8, boxShadow: '0 8px 0 #EEDAC6' }}>
                <div style={{ position: 'relative', width: 'min(38vh,260px)', height: 'min(38vh,260px)' }}>
                  <canvas ref={guideCanvasRef} width={520} height={520} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 14, background: '#FFFDF8' }} />
                  <canvas ref={drawCanvasRef} width={520} height={520}
                    onPointerDown={traceDown} onPointerMove={traceMove} onPointerUp={traceUp} onPointerLeave={traceUp}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 14, background: 'transparent', touchAction: 'none', cursor: 'crosshair' }} />
                </div>
              </div>
              <button onClick={nextLetter} style={ARROW_BTN}>›</button>
            </div>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => speak(curLetter)}  style={{ ...BIG_BTN, background: '#7FB8E0', boxShadow: '0 4px 0 #5E9BC7' }}>🔊 <span style={{ fontSize: 11 }}>きく</span></button>
              <button onClick={clearDrawCanvas}         style={{ ...BIG_BTN, background: '#C9BBB0', boxShadow: '0 4px 0 #A89789' }}>🧽 <span style={{ fontSize: 11 }}>けす</span></button>
              <button onClick={() => grantStar(true)}   style={{ ...BIG_BTN, background: '#F2879B', boxShadow: '0 4px 0 #D96C81' }}>✓ <span style={{ fontSize: 11 }}>できた！</span></button>
            </div>
          </div>
          {/* A–M / N–Z */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {WORDS.slice(0, 13).map((w, idx) => <button key={idx} onClick={() => setLetter(idx)} style={chipStyle(idx)}>{w[0]}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {WORDS.slice(13).map((w, idx) => <button key={idx + 13} onClick={() => setLetter(idx + 13)} style={chipStyle(idx + 13)}>{w[0]}</button>)}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ WORDS ═══════════════ */}
      {screen === 'words' && (
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '20px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>What is it? 🍰</div>
              <div style={{ fontSize: 13, color: '#A98B77' }}>これは なに？　いって、タップ</div>
            </div>
            {/* Count-up timer */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#FFFFFF', borderRadius: 14, padding: '5px 12px', boxShadow: '0 3px 0 #E7D3C0', minWidth: 52 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#A98B77' }}>⏱</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#6B4F3F', lineHeight: 1 }}>{wElapsed}s</div>
            </div>
          </div>
          <button onClick={() => speak(wTarget)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, background: '#FFFFFF', borderRadius: 28, padding: '14px 40px', boxShadow: '0 10px 0 #EEDAC6', maxWidth: 320 }}>
            {wIsEmoji
              ? <div style={{ fontSize: 84, lineHeight: 1, animation: 'kg-bounceIn .4s ease-out' }}>{wClue}</div>
              : <div style={{ fontSize: 22, fontWeight: 800, color: '#6B4F3F', textAlign: 'center', lineHeight: 1.4, minHeight: 64, display: 'flex', alignItems: 'center' }}>{wClue}</div>
            }
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#7FB8E0' }}>🔊 Hear it <span style={{ color: '#A98B77', fontWeight: 500, fontSize: 12 }}>きく</span></div>
          </button>
          {/* Wrong-answer nudge */}
          {wWrong && (
            <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: '#D96C81', animation: 'kg-pop .25s ease-out' }}>
              もう一度！ Try again 👆
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {wOptions.map(label => (
              <button key={label} onClick={() => checkWord(label)}
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 20, padding: '13px 22px', borderRadius: 18, minWidth: 120, boxShadow: '0 6px 0 #EEDAC6', background: wWrong === label ? '#FBD9D9' : '#FFFFFF', color: wWrong === label ? '#D96C81' : '#6B4F3F', animation: wWrong === label ? 'kg-shake .45s' : undefined }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ SPELL ═══════════════ */}
      {screen === 'spell' && (
        <SpellTsumGame
          assignedVocab={assignedVocab}
          sessionWords={sessionWords}
          onBack={() => setScreen('hub')}
          onEnd={stats => {
            if (user) saveKidSession({
              player1Id: user.id, player2Id,
              game: 'spell-tsum',
              score: stats.score, wordsCorrect: stats.correct,
              wordsAttempted: stats.attempted, streakBest: stats.streak,
            })
          }}
          onWordComplete={() => { if (player === 'duo') grantStar(false) }}
          sfxCorrect={sfxCorrect}
          sfxWrong={sfxWrong}
          sfxTap={sfxTap}
          speak={speak}
        />
      )}

      {/* ═══════════════ STUDY ═══════════════ */}
      {screen === 'study' && (() => {
        if (studyPool.length === 0) return (
          <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>📚</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#6B4F3F' }}>No vocabulary yet!</div>
            <div style={{ fontSize: 14, color: '#A98B77' }}>先生にたんごを追加してもらおう</div>
          </div>
        )

        const allDone = studyIdx >= studyPool.length
        const card    = studyPool[Math.min(studyIdx, studyPool.length - 1)]
        const isLast  = studyIdx === studyPool.length - 1

        if (allDone) {
          // Duo mode: P1 just finished → hand off to P2 before going to hub
          if (duo && studyTurn === 1 && !p2StudyDone) return (
            <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 64 }}>🤝</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#5A4336' }}>{player1Name}、よくできました！</div>
              <div style={{ fontSize: 15, color: '#A98B77', lineHeight: 1.6 }}>
                {player2Name}にデバイスをわたしてね<br/>
                <span style={{ fontSize: 13 }}>Pass the device to {player2Name}</span>
              </div>
              <button
                onClick={() => { setP1StudyDone(true); setStudyTurn(2); setStudyIdx(0); setStudyFlipped(false) }}
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 17, padding: '14px 32px', borderRadius: '999px', background: '#F2879B', color: '#fff', boxShadow: '0 5px 0 #D96C81' }}>
                {player2Name}の番 →
              </button>
              <button
                onClick={() => { setP1StudyDone(true); setSessionWords(studyPool); setScreen('hub') }}
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: '999px', background: '#F5EDE6', color: '#B79A86' }}>
                スキップしてゲームへ
              </button>
            </div>
          )

          // Solo, or duo P2 finished
          return (
            <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 60 }}>🎉</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#5A4336' }}>ぜんぶおわった！</div>
              <div style={{ fontSize: 15, color: '#A98B77' }}>{studyPool.length} words reviewed — ready to play!</div>
              <button
                onClick={() => {
                  if (duo && studyTurn === 2) setP2StudyDone(true); else setP1StudyDone(true)
                  setSessionWords(studyPool); setScreen('hub')
                }}
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 17, padding: '14px 32px', borderRadius: '999px', background: '#8BC273', color: '#fff', boxShadow: '0 5px 0 #6FA458' }}>
                ゲームをはじめよう →
              </button>
            </div>
          )
        }

        return (
          <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 16px' }}>
            {/* Progress bar */}
            <div style={{ width: '100%', maxWidth: 400 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#A98B77', marginBottom: 6 }}>
                <span>{duo ? `${studyTurn === 1 ? player1Name : player2Name}の` : ''}たんごれんしゅう 📚</span>
                <span>{studyIdx + 1} / {studyPool.length}</span>
              </div>
              <div style={{ height: 8, background: '#EDE0D4', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(studyIdx / studyPool.length) * 100}%`, background: '#8BC273', borderRadius: 8, transition: 'width .3s' }} />
              </div>
            </div>

            {/* Flashcard */}
            <div onClick={() => { if (!studyFlipped) { setStudyFlipped(true); speak(card.word.toLowerCase()) } }}
              style={{ width: '100%', maxWidth: 380, background: '#FFFFFF', borderRadius: 28, padding: '32px 28px', boxShadow: '0 10px 0 #EEDAC6', textAlign: 'center', cursor: studyFlipped ? 'default' : 'pointer', userSelect: 'none', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              {/* Japanese hint — always visible */}
              <div style={{ fontSize: 28, fontWeight: 800, color: '#5A4336', lineHeight: 1.3 }}>{card.hint}</div>
              {!studyFlipped && (
                <div style={{ fontSize: 14, fontWeight: 700, color: '#C7A892', marginTop: 4 }}>タップして英語を見る 👆</div>
              )}
              {studyFlipped && (
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

            {/* Navigation / SRS Rating */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 380 }}>
              {studyFlipped ? (
                <>
                  <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#A98B77' }}>
                    どのくらいわかった？ · How well did you know it?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {([
                      { r: 'again' as const, label: 'もう一度', sub: 'Again', bg: '#FFF0F0', col: '#D96C81', sh: '#E4B8C4' },
                      { r: 'hard'  as const, label: 'むずかしい', sub: 'Hard', bg: '#FFF5E6', col: '#D9893A', sh: '#E4C49A' },
                      { r: 'good'  as const, label: 'よかった',  sub: 'Good', bg: '#EEF8FF', col: '#3FA7E8', sh: '#B0D8F5' },
                      { r: 'easy'  as const, label: 'かんたん',  sub: 'Easy', bg: '#EEFCF0', col: '#5AB468', sh: '#B8DFB8' },
                    ]).map(btn => (
                      <button key={btn.r} onClick={() => {
                        rateVocabCard(card.id, card.mastery_level, btn.r, card.interval_days, card.ease_factor)
                        setStudyIdx(i => i + 1)
                        setStudyFlipped(false)
                      }} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, background: btn.bg, borderRadius: 16, padding: '12px 8px', boxShadow: `0 4px 0 ${btn.sh}`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: btn.col }}>{btn.label}</div>
                        <div style={{ fontSize: 11, color: btn.col, opacity: 0.75 }}>{btn.sub}</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                studyIdx > 0 && (
                  <button onClick={() => { setStudyIdx(i => i - 1); setStudyFlipped(false) }}
                    style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 15, padding: '10px 20px', borderRadius: '999px', background: '#FFFFFF', color: '#6B4F3F', boxShadow: '0 4px 0 #E7D3C0' }}>
                    ← もどる
                  </button>
                )
              )}
            </div>
          </div>
        )
      })()}

      {/* ═══════════════ LIKE & DISLIKE ═══════════════ */}
      {screen === 'like' && (
        <LikeGame
          onBack={() => setScreen('hub')}
          isDuo={duo}
          player1Name={player1Name}
          player2Name={player2Name}
          onRoundComplete={() => { if (player === 'duo') grantStar(false) }}
        />
      )}

      {/* ═══════════════ ZOO ═══════════════ */}
      {screen === 'zoo' && (() => {
        const zoo = ZOO_DATA[letterIndex]
        const accColor = zooAccuracy >= 80 ? '#8BC273' : zooAccuracy >= 50 ? '#E0A52E' : '#F2879B'
        const zooChipClick = (i: number) => {
          setLetter(i); setZooPhase('trace'); setZooAccuracy(0); setZooFed(false); setZooDragPos(null)
        }
        if (zooDone) return (
          <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 60 }}>🎉</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#5A4336' }}>ぜんぶかけた！</div>
            <div style={{ fontSize: 15, color: '#A98B77' }}>All 26 animals fed!</div>
            <button onClick={startZoo}
              style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 16, padding: '12px 28px', borderRadius: '999px', background: '#F2879B', color: '#fff', boxShadow: '0 5px 0 #D96C81' }}>
              もう一度あそぶ · Play Again
            </button>
          </div>
        )
        return (
          <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 8px' }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {zooPhase === 'trace' ? (
                <>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>Trace & Feed! 🦁</span>
                  <div style={{ display: 'flex', gap: 6, background: '#FFFFFF', padding: 3, borderRadius: '999px', boxShadow: '0 3px 0 #EEDAC6' }}>
                    {(['upper', 'lower'] as const).map(c => (
                      <button key={c} onClick={() => { setTraceCase(c); traceCaseRef.current = c; setActiveStroke(0); activeStrokeRef.current = 0; clearDrawCanvas(); setTimeout(() => drawGuide(), 40) }}
                        style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 14, padding: '4px 12px', borderRadius: '999px', background: traceCase === c ? '#F2879B' : 'transparent', color: traceCase === c ? '#fff' : '#C7A892', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {c === 'upper' ? 'A' : 'a'} <span style={{ fontSize: 10 }}>{c === 'upper' ? '大もじ' : '小もじ'}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>Feed the {zoo.animal}! 🍽️</span>
                  <div style={{ background: accColor, color: '#fff', fontWeight: 800, fontSize: 14, padding: '4px 12px', borderRadius: '999px' }}>
                    ✏️ {zooAccuracy}%
                  </div>
                </div>
              )}
            </div>

            {/* Main area */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {zooPhase === 'trace' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={prevLetter} style={ARROW_BTN}>‹</button>
                    <div style={{ background: '#FFFFFF', borderRadius: 22, padding: 8, boxShadow: '0 8px 0 #EEDAC6' }}>
                      <div style={{ position: 'relative', width: 'min(38vh,260px)', height: 'min(38vh,260px)' }}>
                        <canvas ref={guideCanvasRef} width={520} height={520} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 14, background: '#FFFDF8' }} />
                        <canvas ref={drawCanvasRef} width={520} height={520}
                          onPointerDown={traceDown} onPointerMove={traceMove} onPointerUp={traceUp} onPointerLeave={traceUp}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 14, background: 'transparent', touchAction: 'none', cursor: 'crosshair' }} />
                      </div>
                    </div>
                    <button onClick={nextLetter} style={ARROW_BTN}>›</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => speak(curLetter)} style={{ ...BIG_BTN, background: '#7FB8E0', boxShadow: '0 4px 0 #5E9BC7' }}>🔊 <span style={{ fontSize: 11 }}>きく</span></button>
                    <button onClick={clearDrawCanvas} style={{ ...BIG_BTN, background: '#C9BBB0', boxShadow: '0 4px 0 #A89789' }}>🧽 <span style={{ fontSize: 11 }}>けす</span></button>
                    <button onClick={zooTraceDone} style={{ ...BIG_BTN, background: '#8BC273', boxShadow: '0 4px 0 #6FA458' }}>🦁 Feed! <span style={{ fontSize: 11 }}>えさをあげよう</span></button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 48, padding: '8px 0' }}>
                  {/* Draggable food */}
                  {!zooFed && (
                    <div
                      onPointerDown={zooFoodDown}
                      onPointerMove={zooFoodMove}
                      onPointerUp={zooFoodUp}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        userSelect: 'none', touchAction: 'none',
                        cursor: zooDragging ? 'grabbing' : 'grab',
                        ...(zooDragging && zooDragPos ? {
                          position: 'fixed' as const,
                          left: zooDragPos.x, top: zooDragPos.y,
                          transform: 'translate(-50%,-50%)',
                          zIndex: 9998,
                        } : {
                          animation: 'kg-floaty 2.5s ease-in-out infinite',
                        }),
                      }}
                    >
                      <div style={{ fontSize: 64, lineHeight: 1 }}>{zoo.foodEmoji}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#5A4336' }}>{zoo.food}</div>
                    </div>
                  )}
                  {/* Animal + name */}
                  <div ref={zooAnimalRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 90, lineHeight: 1, animation: zooFed ? 'kg-pop .4s ease-out' : 'kg-floaty 2s ease-in-out infinite' }}>
                      {zoo.animalEmoji}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#5A4336' }}>{zoo.animal}</div>
                    {!zooFed && <div style={{ fontSize: 13, color: '#A98B77' }}>Drag {zoo.foodEmoji} to me!</div>}
                    {zooFed && <div style={{ fontSize: 18, fontWeight: 800, color: '#8BC273', animation: 'kg-pop .3s ease-out' }}>Yummy! 😋</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Letter chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {WORDS.slice(0, 13).map((w, idx) => <button key={idx} onClick={() => zooChipClick(idx)} style={chipStyle(idx)}>{w[0]}</button>)}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {WORDS.slice(13).map((w, idx) => <button key={idx + 13} onClick={() => zooChipClick(idx + 13)} style={chipStyle(idx + 13)}>{w[0]}</button>)}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════ PHONICS QUEST ═══════════════ */}
      {screen === 'phonics' && (
        <PhonicsGame />
      )}

      </div>)} {/* end scrollable game wrapper */}

      {/* ═══════════════ PLAYER PICKER ═══════════════ */}
      {showPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9997, padding: '16px' }}>
          <div style={{ background: '#FFFBF4', borderRadius: 32, padding: '24px 28px', fontFamily: FONT, boxShadow: '0 20px 60px rgba(0,0,0,.2)', width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'kg-pop .4s ease-out' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#5A4336', textAlign: 'center' }}>いっしょにあそぼう！</div>
            <div style={{ fontSize: 13, color: '#A98B77', textAlign: 'center', marginBottom: 16, marginTop: 3 }}>Who is Player 2?</div>
            {classmates.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#A98B77', fontSize: 14, padding: '12px 0' }}>No classmates found</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14, overflowY: 'auto' }}>
                {classmates.map(c => {
                  const firstName = (c.full_name ?? 'Student').split(' ')[0]
                  return (
                    <button key={c.id} onClick={() => {
                      setPlayer2Id(c.id); setPlayer2Name(firstName)
                      setPlayer('duo'); setTurn(1); setShowPicker(false)
                    }} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 13, padding: '10px 6px', borderRadius: 14, background: '#EDE4FF', color: '#5A4336', boxShadow: '0 4px 0 #D0BEFF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 26 }}>👩</span>
                      <span style={{ lineHeight: 1.2, wordBreak: 'break-word', textAlign: 'center' }}>{firstName}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                setPlayer2Id(null); setPlayer2Name('Player 2')
                setPlayer('duo'); setTurn(1); setShowPicker(false)
              }} style={{ flex: 1, border: '2px dashed #E7D3C0', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '10px 8px', borderRadius: 12, background: 'transparent', color: '#B79A86' }}>
                スキップ
              </button>
              <button onClick={() => setShowPicker(false)} style={{ flex: 1, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '10px 8px', borderRadius: 12, background: '#F5EDE6', color: '#B79A86' }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ REWARD OVERLAY ═══════════════ */}
      {justRewarded && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 9999 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.95)', padding: '30px 48px', borderRadius: 36, boxShadow: '0 16px 50px rgba(0,0,0,.18)', animation: 'kg-pop .5s ease-out' }}>
            <div style={{ fontSize: 80 }}>⭐</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#E0A52E' }}>Great! <span style={{ color: '#F2879B' }}>じょうず！</span></div>
            <div style={{ fontSize: 16, color: '#A98B77' }}>
              {duo ? `${scorer === 1 ? `👧 ${player1Name}` : `👩 ${player2Name}`} +1 ⭐` : '+1 star'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
