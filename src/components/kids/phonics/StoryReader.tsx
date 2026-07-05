import { useEffect, useState, type CSSProperties } from 'react'
import { speak } from '@/lib/tts'
import { sfxMotionStart, sfxArrive } from '@/lib/sfx'
import type { PhonicsUnit, PhonicsWord, StoryPage } from '@/lib/phonicsContent'
import { useStorySceneTuning, entranceCss, emphasisCss, travelCss, combineAnimations } from './storySceneTuning'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"
const ACCENT = '#F2879B'

interface Props {
  unit: PhonicsUnit
  onDone: () => void
  initialPageIndex?: number
}

function renderHighlighted(text: string, highlights: string[]) {
  if (!highlights.length) return text
  const escaped = highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  return text.split(re).map((part, i) => {
    const isMatch = highlights.some(h => h.toLowerCase() === part.toLowerCase())
    return isMatch
      ? <span key={i} style={{ color: ACCENT, fontWeight: 900 }}>{part}</span>
      : <span key={i}>{part}</span>
  })
}

// ── Story scene: illustrate the sentence, don't just float the mascot ──
//
// Every page cross-references `page.highlight` against `unit.words` (case
// -insensitively — highlight entries are sometimes capitalized, e.g. 'Why'
// vs word 'why') so any mentioned word that has an emoji actually shows up
// as a little prop in the scene, not just the mascot alone.
//
// On top of that, a small keyword list detects movement verbs actually used
// across phonicsContent.ts's storyPages (ran, walks, swims, drives, flies,
// sails, rides, dashes, sits/naps "on", digs, hugs, gets "in", etc). When a
// sentence has the unit's mascot as its subject and one of these verbs is
// followed by a word that resolves to a prop emoji, the mascot slides across
// the scene toward that prop instead of idling in place.
interface WordMatch { word: PhonicsWord; index: number }

const MOTION_VERBS = [
  'ran', 'run', 'runs', 'running',
  'walk', 'walks', 'walked',
  'swim', 'swims', 'swam',
  'drive', 'drives', 'drove',
  'fly', 'flies', 'flew',
  'sail', 'sails', 'sailed',
  'ride', 'rides', 'rode',
  'dash', 'dashes', 'dashed',
  'sit', 'sits', 'sat',
  'tap', 'taps', 'tapped',
  'nap', 'naps', 'napped',
  'dig', 'digs', 'dug',
  'dip', 'dips', 'dipped',
  'hug', 'hugs', 'hugged',
  'get', 'gets', 'got',
  'march', 'marches', 'marched',
  'hop', 'hops', 'hopped',
  'jump', 'jumps', 'jumped',
  'skate', 'skates', 'skated',
  'glide', 'glides', 'glided',
  'roll', 'rolls', 'rolled',
]
const MOTION_VERB_RE = new RegExp(`\\b(${MOTION_VERBS.join('|')})\\b`, 'i')

// Every highlighted word that resolves to a PhonicsWord in this unit,
// in the order it appears in the sentence.
function findWordMatches(text: string, highlight: string[], words: PhonicsWord[]): WordMatch[] {
  const lower = text.toLowerCase()
  const seen = new Set<string>()
  const matches: WordMatch[] = []
  for (const h of highlight) {
    const w = words.find(w => w.word.toLowerCase() === h.toLowerCase())
    if (!w || seen.has(w.word)) continue
    const index = lower.indexOf(w.word.toLowerCase())
    if (index === -1) continue
    seen.add(w.word)
    matches.push({ word: w, index })
  }
  return matches.sort((a, b) => a.index - b.index)
}

// If the mascot is this sentence's subject and a movement verb appears
// before one of the matched words, that word is the mascot's destination.
function findMotionTarget(text: string, mascotName: string, wordMatches: WordMatch[]): WordMatch | null {
  const mascotIdx = text.toLowerCase().indexOf(mascotName.toLowerCase())
  if (mascotIdx === -1) return null
  const m = MOTION_VERB_RE.exec(text.slice(mascotIdx))
  if (!m) return null
  const verbIdx = mascotIdx + m.index
  return wordMatches.find(w => w.index > verbIdx) ?? null
}

function sceneForPage(page: StoryPage, unit: PhonicsUnit) {
  const wordMatches = findWordMatches(page.text, page.highlight, unit.words)
  const motionTarget = findMotionTarget(page.text, unit.mascotName, wordMatches)
  const others = motionTarget ? wordMatches.filter(w => w !== motionTarget) : wordMatches
  return { motionTarget, others }
}

// Page-by-page decodable mini-story starring the unit's recurring mascot.
// Self-paced (tap to advance, not a timer) with the target pattern's letters
// highlighted so the story reads as a continuation of what Word Builder /
// Family Match just taught, not a disconnected reward reel. No mic/
// pronunciation-check here — the teacher supervises reading aloud in person.
export function StoryReader({ unit, onDone, initialPageIndex = 0 }: Props) {
  const t = useStorySceneTuning()
  const [pageIdx, setPageIdx] = useState(initialPageIndex)
  const pages = unit.storyPages
  const page = pages[pageIdx]
  const isLast = pageIdx === pages.length - 1
  const { motionTarget, others } = sceneForPage(page, unit)

  // 'moving' -> mascot travels the kg-arcMove curved path toward the target
  // prop, with a travel-style wobble layered on top; 'arrived' -> settles
  // into a gentle idle. Unlike a CSS `transition`, a CSS `animation` always
  // plays its full keyframe sequence once applied, so no reflow-timing hack
  // is needed to kick it off — just set the phase straight from the current
  // scene on page/unit change.
  const [phase, setPhase] = useState<'idle' | 'moving' | 'arrived'>(() => motionTarget ? 'moving' : 'idle')
  useEffect(() => {
    const moving = !!motionTarget
    setPhase(moving ? 'moving' : 'idle')
    if (moving && t.motionSoundEnabled) sfxMotionStart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdx, unit])

  useEffect(() => { setPageIdx(0) }, [unit])

  useEffect(() => {
    const t = setTimeout(() => speak(page.text), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdx, unit])

  function next() {
    if (isLast) onDone()
    else setPageIdx(i => i + 1)
  }
  function prev() {
    setPageIdx(i => Math.max(0, i - 1))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, width: '100%', maxWidth: 420, margin: '0 auto', padding: '4px 4px 20px' }}>
      {/* Progress bar */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#A98B77', marginBottom: 4 }}>
          <span>{unit.mascotName}'s story</span>
          <span>{pageIdx + 1} / {pages.length}</span>
        </div>
        <div style={{ height: 8, background: '#EDE0D4', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((pageIdx + 1) / pages.length) * 100}%`, background: '#8BC273', borderRadius: 8, transition: 'width .3s' }} />
        </div>
      </div>

      {/* Scene: mascot + the props this sentence actually mentions */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: t.sceneMaxWidth, margin: '0 auto', height: t.sceneHeight,
        background: `linear-gradient(180deg, ${t.bgTop} 0%, ${t.bgMid} 65%, ${t.bgBottom} 100%)`,
        borderRadius: 24, overflow: 'hidden', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.04)',
      }}>
        {/* ground strip so "moving toward X" reads as a mini scene, not two floating emoji */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 16, background: t.groundColor }} />

        {/* Words this page mentions that aren't the movement destination */}
        {others.length > 0 && (
          <div key={`others-${pageIdx}`} style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: motionTarget ? 'flex-start' : 'center', zIndex: 1 }}>
            {others.map((m, i) => (
              <span key={m.word.word} style={{
                fontSize: t.othersFontSize, display: 'inline-block',
                animation: combineAnimations(
                  entranceCss(t.props, i * t.propsEntranceStaggerSec),
                  emphasisCss(t.props.emphasis, t.props.emphasisDurationSec, t.props.easing, t.props.durationSec + t.props.delaySec + i * t.propsEmphasisStaggerSec),
                ),
              }}>
                {m.word.emoji}
              </span>
            ))}
          </div>
        )}

        {/* Destination prop the mascot is moving toward */}
        {motionTarget && (
          <div key={`target-${pageIdx}`} style={{
            position: 'absolute', bottom: t.targetBottom, right: `${t.targetRightPct}%`, fontSize: t.targetFontSize, zIndex: 1,
            animation: combineAnimations(
              entranceCss(t.target),
              emphasisCss(t.target.emphasis, t.target.emphasisDurationSec, t.target.easing, t.target.durationSec + t.target.delaySec),
            ),
          }}>
            {motionTarget.word.emoji}
          </div>
        )}

        {/* Mascot: idles in place normally, or travels a curved kg-arcMove
            path toward the destination prop (mirrors the source deck's
            hand-drawn bezier motion paths instead of a straight slide) */}
        <div
          onAnimationEnd={e => {
            if (e.animationName === 'kg-arcMove' && phase === 'moving') {
              setPhase('arrived')
              if (t.motionSoundEnabled) sfxArrive()
            }
          }}
          style={{
            position: 'absolute',
            bottom: t.mascotBottom,
            left: motionTarget ? `${phase === 'arrived' ? t.mascotArrivedLeftPct : t.mascotStartLeftPct}%` : 'calc(50% - 33px)',
            fontSize: t.mascotFontSize,
            zIndex: 2,
            '--arc-start': `${t.mascotStartLeftPct}%`,
            '--arc-mid': `${(t.mascotStartLeftPct + t.mascotArrivedLeftPct) / 2}%`,
            '--arc-end': `${t.mascotArrivedLeftPct}%`,
            '--arc-height': `${t.arcHeightPx}px`,
            animation: motionTarget && phase === 'moving'
              ? `kg-arcMove ${t.transitionDurationSec}s ${t.motionEasing} forwards`
              : emphasisCss(
                  t.mascotIdle.effect, t.mascotIdle.durationSec, t.mascotIdle.easing, 0,
                  t.mascotIdle.effect === 'float' && motionTarget && phase === 'arrived' ? 'kg-floaty-land' : undefined,
                ),
          } as CSSProperties}
        >
          <span style={{ display: 'inline-block', animation: phase === 'moving' ? travelCss(t.travelStyle, t.travelDurationSec) : undefined }}>
            {unit.mascotEmoji}
          </span>
        </div>
      </div>

      {/* Sentence card */}
      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '28px 24px', boxShadow: '0 8px 0 #EEDAC6', textAlign: 'center', minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div key={pageIdx} style={{ fontSize: 24, fontWeight: 800, color: '#5A4336', lineHeight: 1.4, animation: entranceCss(t.sentence) }}>
          {renderHighlighted(page.text, page.highlight)}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => speak(page.text)}
          style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 14, padding: '8px 18px', borderRadius: '999px', background: '#F0F8FF', color: '#7FB8E0' }}>
          🔊 Listen again
        </button>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {pageIdx > 0 && (
          <button onClick={prev} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 15, padding: '10px 20px', borderRadius: '999px', background: '#FFFFFF', color: '#6B4F3F', boxShadow: '0 4px 0 #E7D3C0' }}>
            ← Back
          </button>
        )}
        <button onClick={next} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 15, padding: '10px 24px', borderRadius: '999px', background: '#F2879B', color: '#fff', boxShadow: '0 4px 0 #D96C81' }}>
          {isLast ? 'Finish! 🎉' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
