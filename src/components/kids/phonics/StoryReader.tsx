import { useEffect, useRef, useState } from 'react'
import { speak } from '@/lib/tts'
import { sfxMotionStart, sfxArrive } from '@/lib/sfx'
import type { PhonicsUnit, PhonicsWord } from '@/lib/phonicsContent'
import { useStorySceneTuning, type SceneObjectTuning } from './storySceneTuning'
import { useStepTimeline } from './stepAnimation'
import { mascotSvgUrl } from './mascotAssets'

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

// Every highlighted word that resolves to a PhonicsWord in this unit
// (highlight entries are sometimes capitalized, e.g. 'Why' vs word 'why',
// hence case-insensitive), in the order it appears in the sentence — each
// becomes one ambient prop. Unlike before, none of them is special-cased
// out as a "destination" the mascot must walk to: the mascot's own
// animation timeline is independently authored (see StoryLab), not derived
// from guessing which word the sentence's verb points at.
export interface WordMatch { word: PhonicsWord; index: number }

export function findWordMatches(text: string, highlight: string[], words: PhonicsWord[]): WordMatch[] {
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

function PropObject({ tuning, emoji }: { tuning: SceneObjectTuning; emoji: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useStepTimeline(ref, tuning.steps)
  return (
    <span ref={ref} style={{
      position: 'absolute', left: `${tuning.xPct}%`, top: `${tuning.yPct}%`, zIndex: tuning.zIndex,
      fontSize: tuning.fontSize, display: 'inline-block',
    }}>
      {emoji}
    </span>
  )
}

// `happy` mirrors mascotSvgUrl's celebratory sprite variant: it flips true
// exactly when a motionPath step finishes (see useStepTimeline's
// onMotionActiveChange) and stays true afterward — it never flips true on
// its own just from idling, matching the original "only happy right after
// arriving somewhere" feel.
function MascotObject({ tuning, unit, motionSoundEnabled }: { tuning: SceneObjectTuning; unit: PhonicsUnit; motionSoundEnabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [happy, setHappy] = useState(false)
  useStepTimeline(ref, tuning.steps, {
    onMotionActiveChange: active => {
      setHappy(!active)
      if (!motionSoundEnabled) return
      if (active) sfxMotionStart()
      else sfxArrive()
    },
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
  useStepTimeline(ref, tuning.steps)
  return (
    <div ref={ref} style={{ fontSize: tuning.fontSize, fontWeight: 800, color: '#5A4336', lineHeight: 1.4 }}>
      {renderHighlighted(text, highlight)}
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
  const pages = unit.storyPages
  const page = pages[pageIdx]
  const isLast = pageIdx === pages.length - 1
  const propMatches = findWordMatches(page.text, page.highlight, unit.words)
  const t = useStorySceneTuning(unit.id, pageIdx, propMatches.length)

  useEffect(() => {
    const timeout = setTimeout(() => speak(page.text), 300)
    return () => clearTimeout(timeout)
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

      {/* Scene: mascot + the props this sentence actually mentions, each
          with its own independently authored animation timeline */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: t.sceneMaxWidth, margin: '0 auto', height: t.sceneHeight,
        background: `linear-gradient(180deg, ${t.bgTop} 0%, ${t.bgMid} 65%, ${t.bgBottom} 100%)`,
        borderRadius: 24, overflow: 'hidden', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.04)',
      }}>
        {/* ground strip so the scene reads as a mini stage, not floating emoji */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 16, background: t.groundColor }} />

        {propMatches.map((m, i) => t.props[i] && (
          <PropObject key={`${pageIdx}-${i}`} tuning={t.props[i]} emoji={m.word.emoji} />
        ))}

        <MascotObject key={`mascot-${pageIdx}`} tuning={t.mascot} unit={unit} motionSoundEnabled={t.motionSoundEnabled} />
      </div>

      {/* Sentence card */}
      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '28px 24px', boxShadow: '0 8px 0 #EEDAC6', textAlign: 'center', minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SentenceObject key={`sentence-${pageIdx}`} tuning={t.sentence} text={page.text} highlight={page.highlight} />
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
