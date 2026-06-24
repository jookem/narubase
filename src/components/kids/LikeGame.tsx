import { useState, useEffect, useRef } from 'react'

// ── Style injection ───────────────────────────────────────────────────────────

function injectLikeGameStyles() {
  if (document.getElementById('lg-styles')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap'
  document.head.appendChild(link)
  const s = document.createElement('style')
  s.id = 'lg-styles'
  s.textContent = [
    '@keyframes lg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}',
    '@keyframes lg-happy{0%{transform:scale(1)}25%{transform:translateY(-18px) scale(1.1) rotate(-6deg)}50%{transform:scale(1)}70%{transform:translateY(-10px) scale(1.05) rotate(5deg)}100%{transform:scale(1)}}',
    '@keyframes lg-sad{0%{transform:translateX(0)}20%{transform:translateX(-8px) rotate(-4deg)}40%{transform:translateX(8px) rotate(4deg)}60%{transform:translateX(-5px)}100%{transform:translateX(0)}}',
    '@keyframes lg-pop{0%{transform:scale(0.7)}60%{transform:scale(1.08)}100%{transform:scale(1)}}',
    '@keyframes lg-jiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}',
    '@keyframes lg-pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.06);opacity:1}}',
    '@keyframes lg-floatup{0%{transform:translateY(0) scale(.6);opacity:0}20%{opacity:1;transform:translateY(-10px) scale(1)}100%{transform:translateY(-160px) scale(1.1) rotate(20deg);opacity:0}}',
    '@keyframes lg-fall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(110vh) rotate(540deg)}}',
  ].join('')
  document.head.appendChild(s)
}

// ── Data ──────────────────────────────────────────────────────────────────────

interface Friend { name: string; emoji: string; color: string }
interface TopicItem { en: string; jp: string; swatch?: string; icon?: string }
interface GameItem extends TopicItem { liked: boolean; revealed: boolean; guess: boolean | null }
interface QuizItem extends TopicItem { answer: boolean }
interface Topic { label: string; jp: string; emoji: string; items: TopicItem[] }

const FRIENDS: Friend[] = [
  { name: 'Neko', emoji: '🐱', color: '#FF8FB7' },
  { name: 'Usa',  emoji: '🐰', color: '#6FD6C2' },
  { name: 'Kuma', emoji: '🐻', color: '#F4A75C' },
  { name: 'Pyon', emoji: '🐸', color: '#86CF63' },
  { name: 'Hiyo', emoji: '🐥', color: '#FFC93C' },
  { name: 'Pen',  emoji: '🐧', color: '#67B2EC' },
]

const TOPICS: Record<string, Topic> = {
  Colors: {
    label: 'Colors', jp: 'いろ', emoji: '🎨',
    items: [
      { en: 'red',    jp: 'あか',     swatch: '#FF5A5A' },
      { en: 'blue',   jp: 'あお',     swatch: '#4DA6FF' },
      { en: 'yellow', jp: 'きいろ',   swatch: '#FFD23F' },
      { en: 'green',  jp: 'みどり',   swatch: '#5BD16A' },
      { en: 'pink',   jp: 'ピンク',   swatch: '#FF8FC7' },
      { en: 'purple', jp: 'むらさき', swatch: '#B07BE8' },
    ],
  },
  Sports: {
    label: 'Sports', jp: 'スポーツ', emoji: '⚽',
    items: [
      { en: 'soccer',     jp: 'サッカー',     icon: '⚽' },
      { en: 'baseball',   jp: 'やきゅう',     icon: '⚾' },
      { en: 'basketball', jp: 'バスケ',       icon: '🏀' },
      { en: 'swimming',   jp: 'すいえい',     icon: '🏊' },
      { en: 'tennis',     jp: 'テニス',       icon: '🎾' },
      { en: 'dodgeball',  jp: 'ドッジボール', icon: '🤾' },
    ],
  },
  Food: {
    label: 'Food', jp: 'たべもの', emoji: '🍙',
    items: [
      { en: 'pizza',        jp: 'ピザ',         icon: '🍕' },
      { en: 'sushi',        jp: 'おすし',       icon: '🍣' },
      { en: 'ice cream',    jp: 'アイス',       icon: '🍦' },
      { en: 'strawberries', jp: 'いちご',       icon: '🍓' },
      { en: 'ramen',        jp: 'ラーメン',     icon: '🍜' },
      { en: 'broccoli',     jp: 'ブロッコリー', icon: '🥦' },
    ],
  },
}

const PREFS: Record<number, Record<string, string[]>> = {
  0: { Colors: ['pink','red','purple'],    Food: ['sushi','ice cream'],              Sports: ['tennis','basketball'] },
  1: { Colors: ['green','pink','blue'],    Food: ['strawberries','broccoli'],        Sports: ['soccer','tennis','basketball'] },
  2: { Colors: ['red','yellow','green'],   Food: ['sushi','ramen','pizza'],          Sports: ['swimming','baseball','soccer'] },
  3: { Colors: ['green','blue'],           Food: ['broccoli','ramen'],               Sports: ['swimming','soccer','dodgeball'] },
  4: { Colors: ['yellow','pink','red'],    Food: ['strawberries','ice cream','pizza'],Sports: ['dodgeball','tennis','baseball'] },
  5: { Colors: ['blue','purple'],          Food: ['sushi','ice cream'],              Sports: ['swimming','soccer','basketball'] },
}

const PLAYERS_META = [
  { name: 'Player 1', emoji: '🌸', color: '#FF5C8A', soft: '#FFE3ED', jp: 'プレイヤー１' },
  { name: 'Player 2', emoji: '⚡', color: '#3FA7E8', soft: '#DCEEFB', jp: 'プレイヤー２' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

function likeSet(friendIdx: number, topicKey: string): Set<string> {
  const p = PREFS[friendIdx]?.[topicKey]
  if (p?.length) return new Set(p)
  return new Set(shuffle(TOPICS[topicKey].items.map(x => x.en)).slice(0, 3))
}

function buildItems(topicKey: string, friendIdx: number): GameItem[] {
  const items = shuffle([...TOPICS[topicKey].items])
  const likes = likeSet(friendIdx, topicKey)
  return items.map(it => ({ ...it, liked: likes.has(it.en), revealed: false, guess: null }))
}

function buildQuestions(topicKey: string, friendIdx: number, count = 5): QuizItem[] {
  const items = shuffle([...TOPICS[topicKey].items]).slice(0, count)
  const likes = likeSet(friendIdx, topicKey)
  return items.map(it => ({ ...it, answer: likes.has(it.en) }))
}

function roundsFor(topicKey: string) {
  return FRIENDS.map((_, i) => ({ friend: i, topic: topicKey }))
}

// ── Audio ─────────────────────────────────────────────────────────────────────

let _ac: AudioContext | null = null
function getAC() {
  if (!_ac) _ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  if (_ac.state === 'suspended') _ac.resume()
  return _ac
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2) {
  try {
    const ac = getAC()
    const o = ac.createOscillator(), g = ac.createGain()
    o.type = type; o.frequency.value = freq
    o.connect(g); g.connect(ac.destination)
    const t = ac.currentTime + start
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t); o.stop(t + dur + 0.03)
  } catch { /* ignore */ }
}

const SFX = {
  pop:     () => tone(880, 0, 0.06, 'sine', 0.16),
  like:    () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.13, 'triangle', 0.22)); tone(1568, 0.3, 0.2, 'sine', 0.08) },
  dislike: () => { [392, 330, 247].forEach((f, i) => tone(f, i * 0.14, 0.2, 'sawtooth', 0.1)) },
  win:     () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.32, 'triangle', 0.2)); [523, 659, 784, 1047].forEach(f => tone(f, 0.62, 0.7, 'triangle', 0.14)) },
  star:    () => { tone(1047, 0, 0.1, 'triangle', 0.18); tone(1319, 0.07, 0.1, 'triangle', 0.18); tone(1568, 0.14, 0.16, 'sine', 0.16) },
  buzz:    () => { tone(311, 0, 0.16, 'sine', 0.12); tone(262, 0.13, 0.22, 'sine', 0.12) },
}

// ── Style constants ───────────────────────────────────────────────────────────

const FONT       = "'Fredoka', 'M PLUS Rounded 1c', sans-serif"
const JP         = "'M PLUS Rounded 1c', sans-serif"
const EMOJI_FONT = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"
const INK  = '#5B4750'
const INK_SOFT = '#9A8590'
const SHADOW = 'rgba(120, 80, 95, 0.18)'

// ── Shared sub-components ─────────────────────────────────────────────────────

function ItemFace({ it }: { it: TopicItem }) {
  if (it.swatch) return <div style={{ width: 44, height: 44, borderRadius: '50%', background: it.swatch, boxShadow: 'inset 0 -4px 8px rgba(0,0,0,.12)', flexShrink: 0 }} />
  return <div style={{ fontSize: 34, lineHeight: 1, fontFamily: EMOJI_FONT }}>{it.icon}</div>
}

function InlineItem({ it }: { it: TopicItem }) {
  if (it.swatch) return <span style={{ display: 'inline-block', width: '0.9em', height: '0.9em', borderRadius: '50%', background: it.swatch, verticalAlign: '-0.08em' }} />
  return <span style={{ fontFamily: EMOJI_FONT }}>{it.icon}</span>
}

function MiniItem({ it }: { it: TopicItem }) {
  if (it.swatch) return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', background: it.swatch, boxShadow: 'inset 0 -3px 6px rgba(0,0,0,.1)', verticalAlign: 'middle' }} title={it.en} />
  return <span title={it.en} style={{ fontSize: 26, fontFamily: EMOJI_FONT }}>{it.icon}</span>
}

function Particles({ kind }: { kind: 'hearts' | 'confetti' }) {
  const emojis = ['💗', '✨', '💛', '⭐', '💚']
  const colors  = ['#FF7FA8', '#FFC93C', '#43C98C', '#5FB0E8', '#B07BE8', '#FF8F5A']
  if (kind === 'hearts') return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', fontSize: 30, left: `${12 + Math.random() * 76}%`, top: `${40 + Math.random() * 20}%`, animation: `lg-floatup 1.3s ease-out ${(Math.random() * 0.25).toFixed(2)}s forwards` }}>
          {emojis[i % emojis.length]}
        </div>
      ))}
    </div>
  )
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
      {Array.from({ length: 44 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', top: -20, left: `${Math.random() * 100}%`, width: 8 + Math.random() * 8, height: 12 + Math.random() * 10, background: colors[i % colors.length], borderRadius: 3, animation: `lg-fall ${(1.6 + Math.random() * 1.6).toFixed(2)}s linear ${(Math.random() * 0.5).toFixed(2)}s forwards` }} />
      ))}
    </div>
  )
}

function CharPod({ friend, reaction }: { friend: Friend; reaction: string }) {
  const anim = reaction === 'happy' ? 'lg-happy 0.7s ease' : reaction === 'sad' ? 'lg-sad 0.7s ease' : 'lg-bob 2.6s ease-in-out infinite'
  return (
    <div style={{ position: 'relative', width: 90, height: 90, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: friend.color + '33', boxShadow: `0 8px 0 ${friend.color}44, inset 0 -6px 14px rgba(255,255,255,.5)`, flexShrink: 0 }}>
      <div style={{ fontSize: 58, lineHeight: 1, animation: anim }}>{friend.emoji}</div>
      <div style={{ position: 'absolute', bottom: '-0.4em', left: '50%', transform: 'translateX(-50%)', background: '#fff', color: INK, fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 999, boxShadow: `0 3px 0 ${SHADOW}`, whiteSpace: 'nowrap', fontFamily: FONT }}>
        {friend.name}
      </div>
    </div>
  )
}

function SpeechBubble({ variant, children }: { variant: '' | 'like' | 'dislike' | 'ask'; children: React.ReactNode }) {
  const bg    = variant === 'like' ? '#EAFBF2' : variant === 'dislike' ? '#EEF3FA' : variant === 'ask' ? '#F6EEFE' : '#fff'
  const bdCol = variant === 'like' ? '#46C98A' : variant === 'dislike' ? '#8FA9C6' : variant === 'ask' ? '#B07BE8' : '#fff'
  return (
    <div style={{ position: 'relative', background: bg, borderRadius: 22, padding: '10px 22px', boxShadow: `0 6px 0 ${SHADOW}`, textAlign: 'center', border: `4px solid ${bdCol}`, width: '100%' }}>
      <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '13px solid transparent', borderRight: '13px solid transparent', borderBottom: `18px solid ${bdCol}` }} />
      {children}
    </div>
  )
}

function CardItem({ it, mode, onReveal, onGuess }: { it: GameItem; mode: 'reveal' | 'guess'; onReveal: () => void; onGuess: (g: boolean) => void }) {
  const [hov, setHov] = useState(false)
  const decided = it.revealed
  const border = decided ? `4px solid ${it.liked ? '#46C98A' : '#8FA9C6'}` : '4px solid #fff'
  const bg     = decided ? (it.liked ? '#F2FCF7' : '#F4F7FB') : '#fff'
  const shadow = !decided && hov ? `0 11px 0 ${SHADOW}` : `0 7px 0 ${SHADOW}`

  const base: React.CSSProperties = { position: 'relative', background: bg, borderRadius: 18, padding: '8px 6px', boxShadow: shadow, border, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minHeight: 90, justifyContent: 'center', fontFamily: FONT, opacity: decided && !it.liked ? 0.72 : 1, filter: decided && !it.liked ? 'saturate(0.6)' : undefined, transition: 'opacity .3s, filter .3s', transform: !decided && hov ? 'translateY(-3px)' : undefined }

  if (!decided && mode === 'guess') return (
    <div style={base}>
      <ItemFace it={it} />
      <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize', color: INK }}>{it.en}</div>
      <div style={{ color: INK_SOFT, fontSize: 11, fontFamily: JP }}>{it.jp}</div>
      <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4 }}>
        <button onClick={e => { e.stopPropagation(); onGuess(true) }} style={{ flex: 1, fontFamily: FONT, fontWeight: 800, border: '3px solid #46C98A', color: '#2FAE75', borderRadius: 12, padding: '5px 2px', fontSize: 20, background: '#fff', cursor: 'pointer', boxShadow: `0 4px 0 ${SHADOW}` }}>💗</button>
        <button onClick={e => { e.stopPropagation(); onGuess(false) }} style={{ flex: 1, fontFamily: FONT, fontWeight: 800, border: '3px solid #8FA9C6', color: '#4592cf', borderRadius: 12, padding: '5px 2px', fontSize: 20, background: '#fff', cursor: 'pointer', boxShadow: `0 4px 0 ${SHADOW}` }}>🙅</button>
      </div>
    </div>
  )

  return (
    <div onClick={() => !decided && mode === 'reveal' && onReveal()} onMouseEnter={() => !decided && setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...base, cursor: decided ? 'default' : 'pointer', animation: decided && it.liked ? 'lg-jiggle .5s ease' : undefined }}>
      {decided && (
        <div style={{ position: 'absolute', top: -14, right: -10, width: 34, height: 34, borderRadius: '50%', background: it.liked ? '#46C98A' : '#8FA9C6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, boxShadow: `0 4px 0 ${SHADOW}`, animation: 'lg-pop .4s ease' }}>
          {it.liked ? '💗' : '🙅'}
        </div>
      )}
      {decided && it.guess !== null && (
        <div style={{ position: 'absolute', top: -14, left: -10, width: 30, height: 30, borderRadius: '50%', background: it.guess === it.liked ? '#46C98A' : '#FF7A59', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 700, boxShadow: `0 4px 0 ${SHADOW}`, animation: 'lg-pop .4s ease' }}>
          {it.guess === it.liked ? '✓' : '✕'}
        </div>
      )}
      <ItemFace it={it} />
      <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize', color: INK }}>{it.en}</div>
      <div style={{ color: INK_SOFT, fontSize: 11, fontFamily: JP }}>{it.jp}</div>
    </div>
  )
}

// ── Player / score UI ─────────────────────────────────────────────────────────

function PlayerToggle({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, background: '#fff', padding: 5, borderRadius: 999, boxShadow: `0 4px 0 ${SHADOW}` }}>
      {[1, 2].map(n => (
        <button key={n} onClick={() => { SFX.pop(); onChange(n) }}
          style={{ fontFamily: FONT, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 16px', fontSize: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2, gap: 1, background: value === n ? '#FF5C8A' : 'transparent', color: value === n ? '#fff' : INK_SOFT }}>
          <span>{n === 1 ? '👤 1 Player' : '👥 2 Players'}</span>
          <span style={{ fontSize: 11, fontFamily: JP }}>{n === 1 ? 'ひとり' : 'ふたり'}</span>
        </button>
      ))}
    </div>
  )
}

function Scoreboard({ scores, turn }: { scores: number[]; turn: number }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {PLAYERS_META.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: `3px solid ${turn === i ? p.color : p.soft}`, borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 15, boxShadow: `0 4px 0 ${SHADOW}`, transform: turn === i ? 'translateY(-2px) scale(1.05)' : undefined, transition: 'all .15s', fontFamily: FONT }}>
          <span>{p.emoji}</span><span style={{ color: p.color }}>{scores[i]}</span>
        </div>
      ))}
    </div>
  )
}

function TurnBanner({ turn }: { turn: number }) {
  const p = PLAYERS_META[turn]
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: p.soft, color: p.color, fontWeight: 700, fontSize: 15, padding: '6px 16px', borderRadius: 999, boxShadow: `0 4px 0 ${SHADOW}`, border: `3px solid ${p.color}`, animation: 'lg-pulse 1.4s ease-in-out infinite', fontFamily: FONT }}>
      <span style={{ fontSize: 17 }}>{p.emoji}</span> {p.name}'s turn! <span style={{ fontFamily: JP, fontWeight: 500, fontSize: 12, color: INK, opacity: 0.7 }}>{p.jp}のばん</span>
    </div>
  )
}

function ScoreStrip({ scores }: { scores: number[] }) {
  const tie = scores[0] === scores[1]
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {PLAYERS_META.map((p, i) => {
        const lead = !tie && scores[i] > scores[1 - i]
        return (
          <div key={i} style={{ background: '#fff', border: `4px solid ${lead ? p.color : p.soft}`, borderRadius: 22, padding: '12px 22px', boxShadow: `0 6px 0 ${SHADOW}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 110, transform: lead ? 'translateY(-5px)' : undefined, transition: 'all .2s', fontFamily: FONT }}>
            <div style={{ fontSize: 36 }}>{p.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: INK }}>{p.name}</div>
            <div style={{ fontWeight: 700, fontSize: 40, color: p.color, lineHeight: 1 }}>{scores[i]}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Game bar ──────────────────────────────────────────────────────────────────

interface GameBarProps {
  onHome: () => void; onRestart: () => void; onTopics: () => void
  topic: Topic; dots: number; roundIdx: number; right?: React.ReactNode
}

function GameBar({ onHome, onRestart, onTopics, topic, dots, roundIdx, right }: GameBarProps) {
  const btn: React.CSSProperties = { width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 18, color: INK, boxShadow: `0 4px 0 ${SHADOW}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, flexShrink: 0 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', flexWrap: 'wrap' }}>
      <button style={btn} onClick={onHome}>🏠</button>
      <button style={btn} onClick={onTopics}>🎲</button>
      <div style={{ flex: 1 }} />
      <div style={{ background: '#fff', borderRadius: 999, padding: '5px 12px', fontWeight: 600, fontSize: 14, boxShadow: `0 4px 0 ${SHADOW}`, display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT }}>
        <span style={{ fontFamily: EMOJI_FONT }}>{topic.emoji}</span> {topic.label} <span style={{ color: INK_SOFT, fontFamily: JP, fontWeight: 500, fontSize: 12 }}>{topic.jp}</span>
      </div>
      <div style={{ background: '#fff', borderRadius: 999, padding: '5px 10px', boxShadow: `0 4px 0 ${SHADOW}`, display: 'flex', alignItems: 'center', gap: 4 }}>
        {Array.from({ length: dots }).map((_, i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < roundIdx ? '#FF7FA8' : i === roundIdx ? '#FFC93C' : '#FFE6D2', transform: i === roundIdx ? 'scale(1.2)' : undefined }} />
        ))}
      </div>
      {right}
      <button style={btn} onClick={onRestart}>↺</button>
    </div>
  )
}

// ── Overlays ──────────────────────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(91,71,80,.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 4vw', zIndex: 30 }}>
      {children}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFF1E2', borderRadius: 34, padding: '28px 40px', boxShadow: '0 16px 0 rgba(120,80,95,.25)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 640, animation: 'lg-pop .45s ease', fontFamily: FONT }}>
      {children}
    </div>
  )
}

function RoundEnd({ friend, items, onNext, last, players, scores, turn }: { friend: Friend; items: GameItem[]; onNext: () => void; last: boolean; players: number; scores: number[]; turn: number }) {
  const likes    = items.filter(x => x.liked)
  const dislikes = items.filter(x => !x.liked)
  const got      = items.filter(x => x.guess === x.liked).length
  const me       = PLAYERS_META[turn]
  return (
    <Overlay>
      <Particles kind="confetti" />
      <Panel>
        <div style={{ fontSize: 72, animation: 'lg-happy .8s ease infinite alternate' }}>{friend.emoji}</div>
        <h2 style={{ fontWeight: 700, fontSize: 28, letterSpacing: -1, color: INK, margin: 0 }}>
          {players === 2 ? `${me.emoji} ${me.name} got ${got}/${items.length}!` : `You read ${friend.name}'s mind! 🎉`}
        </h2>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '10px 18px', boxShadow: `0 5px 0 ${SHADOW}` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#2FAE75', marginBottom: 6 }}>💗 {friend.name} likes</div>
            <div style={{ display: 'flex', gap: 8 }}>{likes.map((it, i) => <MiniItem key={i} it={it} />)}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 18, padding: '10px 18px', boxShadow: `0 5px 0 ${SHADOW}` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#4592cf', marginBottom: 6 }}>🙅 doesn't like</div>
            <div style={{ display: 'flex', gap: 8 }}>{dislikes.map((it, i) => <MiniItem key={i} it={it} />)}</div>
          </div>
        </div>
        {players === 2 && <ScoreStrip scores={scores} />}
        <button onClick={onNext} style={{ fontFamily: FONT, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 999, color: '#fff', fontSize: 18, padding: '11px 26px', background: '#43C98C', boxShadow: '0 6px 0 #2FAE75' }}>
          {last ? 'Finish 🏆' : 'Next Friend →'}
        </button>
      </Panel>
    </Overlay>
  )
}

function QuizRoundEnd({ friend, correct, total, onNext, last, players, scores }: { friend: Friend; correct: number; total: number; onNext: () => void; last: boolean; players: number; scores: number[] }) {
  return (
    <Overlay>
      <Particles kind="confetti" />
      <Panel>
        <div style={{ fontSize: 72, animation: 'lg-happy .8s ease infinite alternate' }}>{friend.emoji}</div>
        <h2 style={{ fontWeight: 700, fontSize: 28, letterSpacing: -1, color: INK, margin: 0 }}>
          {players === 2 ? 'Round done! 🎉' : `You guessed ${correct}/${total}! 🎉`}
        </h2>
        {players === 2
          ? <ScoreStrip scores={scores} />
          : <div style={{ display: 'flex', gap: 3, fontSize: 30 }}>{Array.from({ length: total }).map((_, i) => <span key={i}>{i < correct ? '⭐' : '☆'}</span>)}</div>
        }
        <button onClick={onNext} style={{ fontFamily: FONT, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 999, color: '#fff', fontSize: 18, padding: '11px 26px', background: '#B07BE8', boxShadow: '0 6px 0 #8E5BC9' }}>
          {last ? 'Finish 🏆' : 'Next Friend →'}
        </button>
      </Panel>
    </Overlay>
  )
}

function WinPanel({ title, jp, onReplay, onHome, onTopics, players, scores }: { title: string; jp: string; onReplay: () => void; onHome: () => void; onTopics: () => void; players: number; scores: number[] }) {
  let wEmoji = '🏆', wTitle = title, wJp = jp
  if (players === 2) {
    if (scores[0] === scores[1]) { wEmoji = '🤝'; wTitle = "It's a tie!"; wJp = 'ひきわけ！' }
    else { const w = scores[0] > scores[1] ? 0 : 1; wEmoji = PLAYERS_META[w].emoji; wTitle = `${PLAYERS_META[w].name} wins!`; wJp = `${PLAYERS_META[w].jp}のかち！` }
  }
  const ghost: React.CSSProperties = { fontFamily: FONT, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 999, color: INK, fontSize: 16, padding: '10px 20px', background: '#fff', boxShadow: `0 5px 0 ${SHADOW}` }
  return (
    <Overlay>
      <Particles kind="confetti" />
      <Panel>
        <div style={{ fontSize: 72, animation: 'lg-happy .8s ease infinite alternate' }}>{wEmoji}</div>
        <h2 style={{ fontWeight: 700, fontSize: 28, letterSpacing: -1, color: INK, margin: 0 }}>{wTitle}</h2>
        <div style={{ color: INK_SOFT, fontFamily: JP, fontWeight: 700 }}>{wJp}</div>
        {players === 2 ? <ScoreStrip scores={scores} /> : <div style={{ fontSize: 48, display: 'flex', gap: 6 }}>🐱🐰🐻🐥🐧</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button style={ghost} onClick={onHome}>🏠 Home</button>
          <button style={ghost} onClick={onTopics}>🎲 Topics</button>
          <button style={{ ...ghost, background: '#FF7FA8', color: '#fff', boxShadow: '0 5px 0 #EA5C8C' }} onClick={onReplay}>Play Again ↺</button>
        </div>
      </Panel>
    </Overlay>
  )
}

// ── Game hub & topic picker ───────────────────────────────────────────────────

function GameHub({ onPick, onBack }: { onPick: (g: 'mind' | 'quiz') => void; onBack: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 16 }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#fff', color: INK, fontFamily: FONT, fontWeight: 700, fontSize: 14, padding: '9px 16px', borderRadius: 999, boxShadow: `0 4px 0 ${SHADOW}` }}>
        ← Kids
      </button>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontWeight: 700, fontSize: 32, letterSpacing: -1, background: 'linear-gradient(180deg,#FF7FA8,#EA5C8C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: 0 }}>Choose a Game!</h1>
        <div style={{ fontFamily: JP, fontWeight: 700, color: INK, fontSize: 14, marginTop: 2 }}>どっちであそぶ？</div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {([
          { key: 'mind' as const, emoji: '🔮', title: 'Mind Reader', jp: 'こころをよもう',  phrase: '"I like…"\n"I don\'t like…"', orbBg: '#FFE3ED', col: '#EA5C8C' },
          { key: 'quiz' as const, emoji: '🎤', title: 'Yes or No?',  jp: 'クイズであてよう', phrase: '"Do you like…?"\n"Yes, I do / No, I don\'t"', orbBg: '#EEE2FB', col: '#8E5BC9' },
        ]).map(g => (
          <button key={g.key} onClick={() => { SFX.pop(); onPick(g.key) }}
            style={{ fontFamily: FONT, border: 'none', cursor: 'pointer', background: '#fff', borderRadius: 26, padding: '18px 22px', boxShadow: `0 10px 0 ${SHADOW}`, width: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: g.orbBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>{g.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: g.col }}>{g.title}</div>
            <div style={{ fontFamily: JP, fontWeight: 700, color: INK_SOFT, fontSize: 12 }}>{g.jp}</div>
            <div style={{ background: '#FFF1E2', borderRadius: 12, padding: '6px 10px', fontWeight: 600, fontSize: 11, color: INK, textAlign: 'center', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{g.phrase}</div>
          </button>
        ))}
      </div>
      <p style={{ color: INK_SOFT, fontWeight: 600, fontSize: 13, textAlign: 'center', margin: 0 }}>Say every sentence together! 🗣️<br /><span style={{ fontFamily: JP }}>すべての文を一緒に言ってください！</span></p>
    </div>
  )
}

function TopicPicker({ accent, players, onSetPlayers, onPick, onHome }: { accent: 'mind' | 'quiz'; players: number; onSetPlayers: (n: number) => void; onPick: (key: string) => void; onHome: () => void }) {
  const col    = accent === 'quiz' ? '#8E5BC9' : '#EA5C8C'
  const orbBg  = accent === 'quiz' ? '#EEE2FB' : '#FFE3ED'
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 16px' }}>
      <button onClick={onHome} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#fff', color: INK, fontFamily: FONT, fontWeight: 700, fontSize: 14, padding: '9px 16px', borderRadius: 999, boxShadow: `0 4px 0 ${SHADOW}` }}>
        🏠 Home
      </button>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontWeight: 700, fontSize: 28, letterSpacing: -1, background: `linear-gradient(180deg,${col},${col})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: 0 }}>Pick a Topic!</h1>
        <div style={{ fontFamily: JP, fontWeight: 700, color: INK, fontSize: 14, marginTop: 2 }}>トピックをえらぼう</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontWeight: 700, color: INK, fontSize: 14, fontFamily: FONT }}>Players: <span style={{ fontFamily: JP, fontWeight: 500, color: INK_SOFT, fontSize: 12 }}>なんにん？</span></span>
        <PlayerToggle value={players} onChange={onSetPlayers} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {Object.entries(TOPICS).map(([key, t]) => (
          <button key={key} onClick={() => { SFX.pop(); onPick(key) }}
            style={{ fontFamily: FONT, border: 'none', cursor: 'pointer', background: '#fff', borderRadius: 22, padding: '14px 18px', boxShadow: `0 10px 0 ${SHADOW}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 120 }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: orbBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontFamily: EMOJI_FONT }}>{t.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: col }}>{t.label}</div>
            <div style={{ fontFamily: JP, fontWeight: 700, color: INK_SOFT, fontSize: 12 }}>{t.jp}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Mind Reader game ──────────────────────────────────────────────────────────

function MindReader({ onHome }: { onHome: () => void }) {
  const [topicKey, setTopicKey] = useState<string | null>(null)
  const [roundIdx, setRoundIdx] = useState(0)
  const [players, setPlayers] = useState(1)
  const [scores, setScores] = useState([0, 0])
  const [items, setItems] = useState<GameItem[]>([])
  const [current, setCurrent] = useState<(GameItem & { correct: boolean | null }) | null>(null)
  const [reaction, setReaction] = useState('idle')
  const [burst, setBurst] = useState<{ id: number; kind: 'hearts' | 'confetti' } | null>(null)
  const [popKey, setPopKey] = useState(0)
  const [gameScreen, setGameScreen] = useState<'play' | 'roundEnd' | 'win'>('play')
  const reactTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rounds  = topicKey ? roundsFor(topicKey) : []
  const total   = rounds.length
  const round   = total ? rounds[roundIdx % total] : null
  const friend  = round ? FRIENDS[round.friend] : null
  const topic   = topicKey ? TOPICS[topicKey] : null
  const turn    = players === 2 ? roundIdx % 2 : 0

  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(null), 1400)
    return () => clearTimeout(t)
  }, [burst])

  function chooseTopic(key: string) {
    setTopicKey(key); setRoundIdx(0); setItems(buildItems(key, 0))
    setScores([0, 0]); setCurrent(null); setReaction('idle'); setBurst(null); setGameScreen('play')
  }

  function startRound(idx: number) {
    const r = rounds[idx % total]
    setItems(buildItems(r.topic, r.friend))
    setCurrent(null); setReaction('idle'); setBurst(null); setGameScreen('play')
  }

  function reveal(i: number, guess: boolean | null = null) {
    const it = items[i]; if (!it || it.revealed) return
    const correct = guess === null ? null : guess === it.liked
    setCurrent({ ...it, guess, correct }); setPopKey(k => k + 1)
    setReaction(it.liked ? 'happy' : 'sad')
    if (players === 2) {
      if (correct) { SFX.star(); setBurst({ id: Date.now(), kind: 'hearts' }); setScores(s => { const n = s.slice(); n[turn] += 1; return n }) }
      else { SFX.buzz(); setBurst(null) }
    } else {
      if (it.liked) { SFX.like(); setBurst({ id: Date.now(), kind: 'hearts' }) }
      else { SFX.dislike(); setBurst(null) }
    }
    if (reactTimer.current) clearTimeout(reactTimer.current)
    reactTimer.current = setTimeout(() => setReaction('idle'), 750)
    setItems(prev => {
      if (prev[i].revealed) return prev
      const next = prev.map((x, k) => k === i ? { ...x, revealed: true, guess } : x)
      if (next.every(x => x.revealed)) setTimeout(() => { SFX.win(); setGameScreen('roundEnd') }, 1100)
      return next
    })
  }

  function nextRound() {
    SFX.pop(); const ni = roundIdx + 1
    if (ni >= total) { setGameScreen('win'); return }
    setRoundIdx(ni); startRound(ni)
  }

  function restart() { SFX.pop(); setRoundIdx(0); setScores([0, 0]); startRound(0) }

  if (!topicKey || !topic || !friend) {
    return <TopicPicker accent="mind" players={players} onSetPlayers={setPlayers} onPick={chooseTopic} onHome={onHome} />
  }

  const foundLikes = items.filter(x => x.revealed && x.liked).length
  const totalLikes = items.filter(x => x.liked).length

  let speechVariant: '' | 'like' | 'dislike' = ''
  let sentColor = INK
  let sentence: React.ReactNode = <span>Read my mind!</span>
  let subJp = 'なにがすきかな？'
  let showCue = false

  if (current) {
    if (current.liked) {
      speechVariant = 'like'; sentColor = '#2FAE75'; showCue = true
      sentence = <>I like <InlineItem it={current} /> {current.en}!</>
      subJp = `${current.jp} がすき！`
    } else {
      speechVariant = 'dislike'; sentColor = '#4592cf'; showCue = true
      sentence = <>I don't like <InlineItem it={current} /> {current.en}.</>
      subJp = `${current.jp} はすきじゃない…`
    }
  }

  const pill: React.CSSProperties = { background: '#fff', borderRadius: 999, padding: '5px 12px', fontWeight: 600, fontSize: 14, boxShadow: `0 4px 0 ${SHADOW}`, fontFamily: FONT }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
      <GameBar onHome={onHome} onRestart={restart} onTopics={() => { SFX.pop(); setTopicKey(null) }} topic={topic} dots={total} roundIdx={roundIdx}
        right={players === 2
          ? <Scoreboard scores={scores} turn={turn} />
          : <div style={{ ...pill, color: '#2FAE75' }}>💗 {foundLikes}/{totalLikes}</div>}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 12px 12px', minHeight: 0, overflowY: 'auto' }}>
        <CharPod friend={friend} reaction={reaction} />
        <div key={popKey} style={{ animation: 'lg-pop .4s ease', width: '100%', maxWidth: 680 }}>
          <SpeechBubble variant={speechVariant}>
            <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: -0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', color: sentColor }}>{sentence}</div>
            <div style={{ fontFamily: JP, fontWeight: 700, color: INK_SOFT, fontSize: 15, marginTop: 5 }}>{subJp}</div>
            {current && players === 2 && <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4, color: current.correct ? '#2FAE75' : '#FF7A59' }}>{current.correct ? '⭐ Correct guess!' : '❌ Not quite!'}</div>}
            {showCue && <div style={{ marginTop: 5, fontWeight: 600, color: '#EA5C8C', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 5, animation: 'lg-pulse 1.4s ease-in-out infinite' }}>🗣️ Say it together! みんなでいってみよう！</div>}
          </SpeechBubble>
        </div>
        {players === 2 && <TurnBanner turn={turn} />}
        {!current && <div style={{ fontWeight: 600, color: INK_SOFT, fontSize: 14, fontFamily: FONT }}>👆 {players === 2 ? 'Tap 💗 or 🙅 to guess　こたえをよそう' : 'Tap a card　カードをタップ'}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: 680 }}>
          {items.map((it, i) => <CardItem key={i} it={it} mode={players === 2 ? 'guess' : 'reveal'} onReveal={() => reveal(i)} onGuess={g => reveal(i, g)} />)}
        </div>
      </div>
      {burst && <Particles kind={burst.kind} />}
      {gameScreen === 'roundEnd' && friend && <RoundEnd friend={friend} items={items} onNext={nextRound} last={roundIdx + 1 >= total} players={players} scores={scores} turn={turn} />}
      {gameScreen === 'win' && <WinPanel title="Mind Reader Master!" jp="すごい！ぜんぶよめたね！" onReplay={restart} onHome={onHome} onTopics={() => { SFX.pop(); setTopicKey(null) }} players={players} scores={scores} />}
    </div>
  )
}

// ── Yes or No quiz ────────────────────────────────────────────────────────────

function QuizShow({ onHome }: { onHome: () => void }) {
  const [topicKey, setTopicKey] = useState<string | null>(null)
  const [roundIdx, setRoundIdx] = useState(0)
  const [players, setPlayers] = useState(1)
  const [scores, setScores] = useState([0, 0])
  const [questions, setQuestions] = useState<QuizItem[]>([])
  const [qIdx, setQIdx] = useState(0)
  const [phase, setPhase] = useState<'ask' | 'revealed'>('ask')
  const [guess, setGuess] = useState<boolean | null>(null)
  const [roundCorrect, setRoundCorrect] = useState(0)
  const [stars, setStars] = useState(0)
  const [reaction, setReaction] = useState('idle')
  const [burst, setBurst] = useState<{ id: number; kind: 'hearts' | 'confetti' } | null>(null)
  const [popKey, setPopKey] = useState(0)
  const [gameScreen, setGameScreen] = useState<'play' | 'roundEnd' | 'win'>('play')
  const reactTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rounds = topicKey ? roundsFor(topicKey) : []
  const total  = rounds.length
  const round  = total ? rounds[roundIdx % total] : null
  const friend = round ? FRIENDS[round.friend] : null
  const topic  = topicKey ? TOPICS[topicKey] : null
  const cur    = questions[qIdx]
  const turn   = players === 2 ? roundIdx % 2 : 0

  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(null), 1400)
    return () => clearTimeout(t)
  }, [burst])

  function chooseTopic(key: string) {
    setTopicKey(key); setRoundIdx(0); setQuestions(buildQuestions(key, 0))
    setQIdx(0); setPhase('ask'); setGuess(null); setRoundCorrect(0); setStars(0)
    setScores([0, 0]); setReaction('idle'); setBurst(null); setGameScreen('play')
  }

  function onGuess(g: boolean) {
    if (phase !== 'ask' || !cur) return
    const correct = g === cur.answer
    setGuess(g); setPhase('revealed'); setPopKey(k => k + 1)
    setReaction(cur.answer ? 'happy' : 'sad')
    if (correct) {
      SFX.star(); setBurst({ id: Date.now(), kind: 'hearts' }); setRoundCorrect(c => c + 1); setStars(s => s + 1)
      if (players === 2) setScores(sc => { const n = sc.slice(); n[turn] += 1; return n })
    } else { SFX.buzz(); setBurst(null) }
    if (reactTimer.current) clearTimeout(reactTimer.current)
    reactTimer.current = setTimeout(() => setReaction('idle'), 750)
  }

  function nextQ() {
    SFX.pop()
    if (qIdx + 1 >= questions.length) { SFX.win(); setGameScreen('roundEnd'); return }
    setQIdx(qIdx + 1); setPhase('ask'); setGuess(null); setReaction('idle'); setBurst(null)
  }

  function startRound(idx: number) {
    const r = rounds[idx % total]
    setQuestions(buildQuestions(r.topic, r.friend))
    setQIdx(0); setPhase('ask'); setGuess(null); setRoundCorrect(0); setReaction('idle'); setBurst(null); setGameScreen('play')
  }

  function nextRound() {
    SFX.pop(); const ni = roundIdx + 1
    if (ni >= total) { setGameScreen('win'); return }
    setRoundIdx(ni); startRound(ni)
  }

  function restart() { SFX.pop(); setRoundIdx(0); setStars(0); setScores([0, 0]); startRound(0) }

  if (!topicKey || !topic || !friend || !cur) {
    return <TopicPicker accent="quiz" players={players} onSetPlayers={setPlayers} onPick={chooseTopic} onHome={onHome} />
  }

  const revealed      = phase === 'revealed'
  const correctGuess  = revealed && guess === cur.answer
  const speechVariant = revealed ? (cur.answer ? 'like' : 'dislike') : 'ask'
  const sentColor     = revealed ? (cur.answer ? '#2FAE75' : '#4592cf') : '#8E5BC9'

  const abBase: React.CSSProperties = { flex: 1, background: '#fff', border: '4px solid #fff', borderRadius: 20, cursor: 'pointer', padding: '10px 8px', boxShadow: `0 6px 0 ${SHADOW}`, fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }
  const pill: React.CSSProperties   = { background: '#fff', borderRadius: 999, padding: '5px 12px', fontWeight: 600, fontSize: 14, boxShadow: `0 4px 0 ${SHADOW}`, fontFamily: FONT }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
      <GameBar onHome={onHome} onRestart={restart} onTopics={() => { SFX.pop(); setTopicKey(null) }} topic={topic} dots={total} roundIdx={roundIdx}
        right={<>
          <div style={pill}>Q {qIdx + 1}/{questions.length}</div>
          {players === 2 ? <Scoreboard scores={scores} turn={turn} /> : <div style={{ ...pill, color: '#FFC93C' }}>⭐ {stars}</div>}
        </>}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 12px 12px', overflowY: 'auto' }}>
        <CharPod friend={friend} reaction={reaction} />
        {players === 2 && <TurnBanner turn={turn} />}
        <div key={popKey} style={{ animation: 'lg-pop .4s ease', width: '100%', maxWidth: 680 }}>
          <SpeechBubble variant={speechVariant}>
            {!revealed ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 22, color: sentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>Do you like <InlineItem it={cur} /> {cur.en}?</div>
                <div style={{ fontFamily: JP, fontWeight: 700, color: INK_SOFT, fontSize: 15, marginTop: 5 }}>{cur.jp} はすき？</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 22, color: sentColor }}>{cur.answer ? 'Yes, I do!' : "No, I don't!"}</div>
                <div style={{ fontFamily: JP, fontWeight: 700, color: INK_SOFT, fontSize: 15, marginTop: 5 }}>{cur.answer ? 'うん、すき！' : 'ううん、すきじゃない'}</div>
                <div style={{ marginTop: 5, fontWeight: 600, color: '#EA5C8C', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 5, animation: 'lg-pulse 1.4s ease-in-out infinite' }}>🗣️ Say it together! みんなでいってみよう！</div>
              </>
            )}
          </SpeechBubble>
        </div>
        <div style={{ display: 'flex', gap: 14, width: '100%', maxWidth: 680 }}>
          {([{ val: true, label: '👍 Yes, I do!', jp: 'うん', col: '#2FAE75' }, { val: false, label: '👎 No, I don\'t!', jp: 'ううん', col: '#4592cf' }] as const).map(opt => {
            const isCorrectAns = revealed && opt.val === cur.answer
            const isWrongGuess = revealed && guess === opt.val && opt.val !== cur.answer
            return (
              <button key={String(opt.val)} disabled={revealed} onClick={() => onGuess(opt.val)}
                style={{ ...abBase, borderColor: isCorrectAns ? '#46C98A' : isWrongGuess ? '#FF7A59' : '#fff', background: isCorrectAns ? '#F1FCF6' : isWrongGuess ? '#FFF0EB' : '#fff' }}>
                {isCorrectAns && <span style={{ position: 'absolute', top: -16, right: -10, width: 36, height: 36, borderRadius: '50%', background: '#46C98A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#fff', boxShadow: `0 4px 0 ${SHADOW}`, animation: 'lg-pop .4s ease' }}>✓</span>}
                {isWrongGuess && <span style={{ position: 'absolute', top: -16, right: -10, width: 36, height: 36, borderRadius: '50%', background: '#FF7A59', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#fff', boxShadow: `0 4px 0 ${SHADOW}`, animation: 'lg-pop .4s ease' }}>✕</span>}
                <span style={{ fontWeight: 700, fontSize: 18, color: opt.col }}>{opt.label}</span>
                <span style={{ fontFamily: JP, color: INK_SOFT, fontSize: 13 }}>{opt.jp}</span>
              </button>
            )
          })}
        </div>
        {!revealed && <div style={{ fontWeight: 600, color: INK_SOFT, fontSize: 14, fontFamily: FONT }}>👆 {players === 2 ? `${PLAYERS_META[turn].name}, guess` : 'Guess'} {friend.name}'s answer　こたえをよそう</div>}
        {revealed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: correctGuess ? '#2FAE75' : '#FF7A59' }}>{correctGuess ? '⭐ Great guess!' : 'Good try! 👏'}</div>
            <button onClick={nextQ} style={{ fontFamily: FONT, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 999, color: '#fff', fontSize: 17, padding: '11px 26px', background: '#B07BE8', boxShadow: '0 6px 0 #8E5BC9' }}>{qIdx + 1 >= questions.length ? 'See score →' : 'Next ▶'}</button>
          </div>
        )}
      </div>
      {burst && <Particles kind={burst.kind} />}
      {gameScreen === 'roundEnd' && <QuizRoundEnd friend={friend} correct={roundCorrect} total={questions.length} onNext={nextRound} last={roundIdx + 1 >= total} players={players} scores={scores} />}
      {gameScreen === 'win' && <WinPanel title="Quiz Champion!" jp={`⭐ ${stars} stars! よくできました！`} onReplay={restart} onHome={onHome} onTopics={() => { SFX.pop(); setTopicKey(null) }} players={players} scores={scores} />}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function LikeGame({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<'hub' | 'mind' | 'quiz'>('hub')

  useEffect(() => { injectLikeGameStyles() }, [])

  const goHome = () => { SFX.pop(); setView('hub') }

  return (
    <div style={{ width: '100%', background: 'radial-gradient(120% 80% at 50% -10%, #FFF9F4 0%, #FFF1E2 55%, #F6E3CF 100%)', fontFamily: FONT, color: INK, display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', flex: 1, minHeight: 0, position: 'relative' }}>
      {view === 'hub'  && <GameHub onPick={setView} onBack={onBack} />}
      {view === 'mind' && <MindReader onHome={goHome} />}
      {view === 'quiz' && <QuizShow onHome={goHome} />}
    </div>
  )
}
