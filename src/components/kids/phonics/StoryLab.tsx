import { useState } from 'react'
import { PHONICS_UNITS } from '@/lib/phonicsContent'
import { StoryReader } from './StoryReader'
import { DEFAULT_STORY_SCENE_TUNING, StorySceneTuningContext, type StorySceneTuning } from './storySceneTuning'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"

interface NumberField {
  key: keyof StorySceneTuning
  label: string
  min: number
  max: number
  step: number
}

const NUMBER_FIELDS: NumberField[] = [
  { key: 'sceneMaxWidth', label: 'Scene width (px)', min: 240, max: 640, step: 4 },
  { key: 'sceneHeight', label: 'Scene height (px)', min: 80, max: 220, step: 2 },
  { key: 'mascotStartLeftPct', label: 'Mascot start (%)', min: 0, max: 40, step: 1 },
  { key: 'mascotArrivedLeftPct', label: 'Mascot arrived (%)', min: 40, max: 95, step: 1 },
  { key: 'targetRightPct', label: 'Target from right (%)', min: 0, max: 30, step: 1 },
  { key: 'mascotBottom', label: 'Mascot bottom (px)', min: 0, max: 60, step: 1 },
  { key: 'targetBottom', label: 'Target bottom (px)', min: 0, max: 60, step: 1 },
  { key: 'mascotFontSize', label: 'Mascot size (px)', min: 30, max: 100, step: 1 },
  { key: 'targetFontSize', label: 'Target size (px)', min: 20, max: 80, step: 1 },
  { key: 'othersFontSize', label: 'Prop size (px)', min: 16, max: 60, step: 1 },
  { key: 'transitionDurationSec', label: 'Slide duration (s)', min: 0.3, max: 2.5, step: 0.05 },
  { key: 'runCycleDurationSec', label: 'Run cycle (s)', min: 0.15, max: 0.8, step: 0.05 },
  { key: 'floatyDurationSec', label: 'Idle float (s)', min: 1, max: 4, step: 0.1 },
  { key: 'twinkleDurationSec', label: 'Target twinkle (s)', min: 0.5, max: 3, step: 0.1 },
]

const COLOR_FIELDS: { key: keyof StorySceneTuning; label: string }[] = [
  { key: 'bgTop', label: 'Sky (top)' },
  { key: 'bgMid', label: 'Sky (mid)' },
  { key: 'bgBottom', label: 'Sky (bottom)' },
  { key: 'groundColor', label: 'Ground' },
]

// Teacher-facing scene tuning lab (Materials page, "Phonics Story Lab" tab):
// jump straight to any unit/page of Phonics Quest's StoryReader and
// live-tweak its scene knobs (positions, sizes, animation durations, colors)
// with instant visual feedback, then copy the resulting values back into
// storySceneTuning.ts's defaults.
export function StoryLab() {
  const [unitIdx, setUnitIdx] = useState(0)
  const [pageIdx, setPageIdx] = useState(0)
  const [jumpNonce, setJumpNonce] = useState(0)
  const [tuning, setTuning] = useState<StorySceneTuning>(DEFAULT_STORY_SCENE_TUNING)
  const [copied, setCopied] = useState(false)

  const unit = PHONICS_UNITS[unitIdx]

  function jumpTo(nextUnitIdx: number, nextPageIdx: number) {
    setUnitIdx(nextUnitIdx)
    setPageIdx(nextPageIdx)
    setJumpNonce(n => n + 1)
  }

  function setField<K extends keyof StorySceneTuning>(key: K, value: StorySceneTuning[K]) {
    setTuning(t => ({ ...t, [key]: value }))
  }

  async function copyTuning() {
    const body = Object.entries(tuning)
      .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? `'${v}'` : v},`)
      .join('\n')
    await navigator.clipboard.writeText(`{\n${body}\n}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'flex', gap: 20, fontFamily: FONT, padding: '4px 16px 24px', flexWrap: 'wrap' }}>
      {/* Controls */}
      <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#6B4F3F' }}>🧪 Phonics Story Lab</div>
        <div style={{ fontSize: 12, color: '#A98B77' }}>Preview and tune every story scene's animation, then copy the values into code.</div>

        <label style={{ fontSize: 12, fontWeight: 700, color: '#A98B77' }}>
          Unit
          <select
            value={unitIdx}
            onChange={e => jumpTo(Number(e.target.value), 0)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 8, border: '1px solid #E7D3C0', fontFamily: FONT }}
          >
            {PHONICS_UNITS.map((u, i) => (
              <option key={u.id} value={i}>{u.mascotEmoji} {u.id} — {u.mascotName} ({u.rime})</option>
            ))}
          </select>
        </label>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#A98B77', marginBottom: 4 }}>Page</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {unit.storyPages.map((_, i) => (
              <button
                key={i}
                onClick={() => jumpTo(unitIdx, i)}
                style={{
                  border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13,
                  width: 30, height: 30, borderRadius: '50%',
                  background: i === pageIdx ? '#F2879B' : '#FFFFFF',
                  color: i === pageIdx ? '#fff' : '#6B4F3F',
                  boxShadow: '0 3px 0 #E7D3C0',
                }}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #EDE0D4', marginTop: 4, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
          {NUMBER_FIELDS.map(f => (
            <label key={f.key} style={{ fontSize: 12, color: '#6B4F3F' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{f.label}</span>
                <span>{tuning[f.key]}</span>
              </div>
              <input
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={tuning[f.key] as number}
                onChange={e => setField(f.key, Number(e.target.value) as StorySceneTuning[typeof f.key])}
                style={{ width: '100%' }}
              />
            </label>
          ))}

          {COLOR_FIELDS.map(f => (
            <label key={f.key} style={{ fontSize: 12, fontWeight: 700, color: '#6B4F3F', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{f.label}</span>
              <input
                type="color"
                value={tuning[f.key] as string}
                onChange={e => setField(f.key, e.target.value as StorySceneTuning[typeof f.key])}
                style={{ width: 40, height: 24, border: 'none', background: 'none', cursor: 'pointer' }}
              />
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setTuning(DEFAULT_STORY_SCENE_TUNING)}
            style={{ flex: 1, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '8px 0', borderRadius: 12, background: '#FFFFFF', color: '#6B4F3F', boxShadow: '0 3px 0 #E7D3C0' }}>
            Reset
          </button>
          <button
            onClick={copyTuning}
            style={{ flex: 1, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 13, padding: '8px 0', borderRadius: 12, background: '#8BC273', color: '#fff', boxShadow: '0 3px 0 #6FA05A' }}>
            {copied ? 'Copied ✓' : 'Copy values'}
          </button>
        </div>
      </div>

      {/* Live scene */}
      <div style={{ flex: '1 1 380px', minWidth: 300 }}>
        <StorySceneTuningContext.Provider value={tuning}>
          <StoryReader
            key={`${unit.id}-${jumpNonce}`}
            unit={unit}
            initialPageIndex={pageIdx}
            onDone={() => jumpTo(unitIdx, Math.min(pageIdx + 1, unit.storyPages.length - 1))}
          />
        </StorySceneTuningContext.Provider>
      </div>
    </div>
  )
}
