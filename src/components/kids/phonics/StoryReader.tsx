import { useEffect, useRef, useState } from 'react'
import { speak } from '@/lib/tts'
import { sfxMotionStart, sfxArrive } from '@/lib/sfx'
import type { PhonicsUnit } from '@/lib/phonicsContent'
import { useStorySceneTuning, useResolvedPageCount, type SceneObjectTuning } from './storySceneTuning'
import { useStepTimeline } from './stepAnimation'
import { mascotSvgUrl } from './mascotAssets'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"
const ACCENT = '#F2879B'

interface Props {
  unit: PhonicsUnit
  onDone: () => void
  initialPageIndex?: number
}

// `highlight` only colors matching substrings in the sentence text — it has
// no effect on which objects appear in the scene (objects are placed by
// hand via the Lab's "+ Add object", not auto-spawned from phonics words).
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

// A 'swap' step (Change Appearance) lets a page explicitly replace what an
// object renders partway through its timeline — e.g. Zac's default sprite
// swapping to its happy one right after a Motion Path step finishes. It's
// an authored step like any other, not automatic behavior tied to motion.
function PropObject({ tuning, emoji }: { tuning: SceneObjectTuning; emoji: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [content, setContent] = useState(emoji)
  useStepTimeline(ref, tuning.steps, { onSwap: setContent })
  return (
    <span ref={ref} style={{
      position: 'absolute', left: `${tuning.xPct}%`, top: `${tuning.yPct}%`, zIndex: tuning.zIndex,
      fontSize: tuning.fontSize, display: 'inline-block',
    }}>
      {content}
    </span>
  )
}

function MascotObject({ tuning, unit, motionSoundEnabled }: { tuning: SceneObjectTuning; unit: PhonicsUnit; motionSoundEnabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [happy, setHappy] = useState(false)
  useStepTimeline(ref, tuning.steps, {
    onMotionActiveChange: active => {
      if (!motionSoundEnabled) return
      if (active) sfxMotionStart()
      else sfxArrive()
    },
    onSwap: content => setHappy(content === 'happy'),
  })
  return (
    <div ref={ref} style={{ position: 'absolute', left: `${tuning.xPct}%`, top: `${tuning.yPct}%`, zIndex: tuning.zIndex, fontSize: tuning.fontSize }}>
      <img
        src={mascotSvgUrl(unit.mascotName, happy)}
        alt={unit.mascotName}
        draggable={false}
        style={{ display: 'block', width: tuning.fontSize, height: tuning.fontSize, objectFit: 'contain' }}
      />
    </div>
  )
}

function SentenceObject({ tuning, text, highlight }: { tuning: SceneObjectTuning; text: string; highlight: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [override, setOverride] = useState<string | null>(null)
  useStepTimeline(ref, tuning.steps, { onSwap: setOverride })
  return (
    <div ref={ref} style={{ fontSize: tuning.fontSize, fontWeight: 800, color: '#5A4336', lineHeight: 1.4 }}>
      {override ?? renderHighlighted(text, highlight)}
    </div>
  )
}

// Page-by-page decodable mini-story starring the unit's recurring mascot.
// Self-paced (tap to advance, not a timer) with the target pattern's letters
// highlighted so the story reads as a continuation of what Word Builder /
// Family Match just taught, not a disconnected reward reel. No mic/
// pronunciation-check here — the teacher supervises reading aloud in person.
export function StoryReader({ unit, onDone, initialPageIndex = 0 }: Props) {
  const [pageIdx, setPageIdx] = useState(initialPageIndex)
  const pageCount = useResolvedPageCount(unit)
  const isLast = pageIdx === pageCount - 1
  // basePage is undefined for a page added purely via the Lab (beyond
  // phonicsContent.ts's static array) — its text/highlight then come
  // entirely from the tuning override.
  const basePage = unit.storyPages[pageIdx]
  const t = useStorySceneTuning(unit.id, pageIdx)

  const text = t.textOverride ?? basePage?.text ?? ''
  const highlight = t.highlightOverride ?? basePage?.highlight ?? []

  useEffect(() => {
    const timeout = setTimeout(() => speak(text), 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdx, unit, text])

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
          <span>{pageIdx + 1} / {pageCount}</span>
        </div>
        <div style={{ height: 8, background: '#EDE0D4', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((pageIdx + 1) / pageCount) * 100}%`, background: '#8BC273', borderRadius: 8, transition: 'width .3s' }} />
        </div>
      </div>

      {/* Scene: mascot + any manually-placed objects, each with its own
          independently authored animation timeline */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: t.sceneMaxWidth, margin: '0 auto', height: t.sceneHeight,
        background: `linear-gradient(180deg, ${t.bgTop} 0%, ${t.bgMid} 65%, ${t.bgBottom} 100%)`,
        borderRadius: 24, overflow: 'hidden', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.04)',
      }}>
        {/* ground strip so the scene reads as a mini stage, not floating emoji */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 16, background: t.groundColor }} />

        {t.extraObjects.map((o, i) => !o.hidden && t.props[i] && (
          <PropObject key={`${pageIdx}-${i}`} tuning={t.props[i]} emoji={o.emoji} />
        ))}

        <MascotObject key={`mascot-${pageIdx}`} tuning={t.mascot} unit={unit} motionSoundEnabled={t.motionSoundEnabled} />
      </div>

      {/* Sentence card */}
      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '28px 24px', boxShadow: '0 8px 0 #EEDAC6', textAlign: 'center', minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SentenceObject key={`sentence-${pageIdx}`} tuning={t.sentence} text={text} highlight={highlight} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => speak(text)}
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
