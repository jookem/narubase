import { useState } from 'react'
import { PHONICS_UNITS } from '@/lib/phonicsContent'
import { StoryReader } from './StoryReader'
import {
  DEFAULT_STORY_SCENE_TUNING, StorySceneTuningContext, ENTRANCE_LABELS, DIRECTION_LABELS, DIRECTIONAL_EFFECTS, EMPHASIS_LABELS, TRAVEL_STYLE_LABELS, EASING_LABELS,
  type StorySceneTuning, type EntranceConfig, type EmphasisConfig, type EntranceEmphasisConfig, type PropSlot,
  type EntranceEffect, type Direction, type EmphasisEffect, type TravelStyle, type Easing,
} from './storySceneTuning'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"

const ENTRANCE_OPTIONS = Object.keys(ENTRANCE_LABELS) as EntranceEffect[]
const DIRECTION_OPTIONS = Object.keys(DIRECTION_LABELS) as Direction[]
const EMPHASIS_OPTIONS = Object.keys(EMPHASIS_LABELS) as EmphasisEffect[]
const TRAVEL_OPTIONS = Object.keys(TRAVEL_STYLE_LABELS) as TravelStyle[]
const EASING_OPTIONS = Object.keys(EASING_LABELS) as Easing[]

interface NumberField {
  key: keyof StorySceneTuning
  label: string
  min: number
  max: number
  step: number
}

const NUMBER_FIELDS: NumberField[] = [
  { key: 'sceneMaxWidth', label: 'Scene width (px)', min: 240, max: 720, step: 4 },
  { key: 'sceneHeight', label: 'Scene height (px)', min: 100, max: 280, step: 2 },
  { key: 'mascotStartLeftPct', label: 'Mascot start (%)', min: 0, max: 40, step: 1 },
  { key: 'mascotArrivedLeftPct', label: 'Mascot arrived (%)', min: 40, max: 95, step: 1 },
  { key: 'targetRightPct', label: 'Target from right (%)', min: 0, max: 30, step: 1 },
  { key: 'mascotBottom', label: 'Mascot bottom (px)', min: 0, max: 60, step: 1 },
  { key: 'targetBottom', label: 'Target bottom (px)', min: 0, max: 60, step: 1 },
  { key: 'mascotFontSize', label: 'Mascot size (px)', min: 30, max: 130, step: 1 },
  { key: 'targetFontSize', label: 'Target size (px)', min: 20, max: 100, step: 1 },
  { key: 'othersFontSize', label: 'Prop size (px)', min: 16, max: 70, step: 1 },
]

const Z_INDEX_FIELDS: NumberField[] = [
  { key: 'targetZIndex', label: 'Target layer', min: 0, max: 5, step: 1 },
  { key: 'mascotZIndex', label: 'Mascot layer', min: 0, max: 5, step: 1 },
]

const COLOR_FIELDS: { key: keyof StorySceneTuning; label: string }[] = [
  { key: 'bgTop', label: 'Sky (top)' },
  { key: 'bgMid', label: 'Sky (mid)' },
  { key: 'bgBottom', label: 'Sky (bottom)' },
  { key: 'groundColor', label: 'Ground' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 700, color: '#6B4F3F', display: 'block' }}>
      <div style={{ marginBottom: 2 }}>{label}</div>
      {children}
    </label>
  )
}

function SelectField<T extends string>({ label, value, options, labels, onChange }: {
  label: string; value: T; options: T[]; labels: Record<T, string>; onChange: (v: T) => void
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #E7D3C0', fontFamily: FONT, fontWeight: 400 }}
      >
        {options.map(o => <option key={o} value={o}>{labels[o]}</option>)}
      </select>
    </Field>
  )
}

function RangeField({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  return (
    <label style={{ fontSize: 12, color: '#6B4F3F', display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>{label}</span><span>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </label>
  )
}

// Entrance effect + direction, PowerPoint-style: direction only means
// something (and so is only shown) for effects in DIRECTIONAL_EFFECTS.
function EntranceEffectFields({ value, onChange }: {
  value: EntranceConfig; onChange: (patch: Partial<EntranceConfig>) => void
}) {
  return (
    <>
      <SelectField label="Entrance" value={value.effect} options={ENTRANCE_OPTIONS} labels={ENTRANCE_LABELS}
        onChange={effect => onChange({ effect })} />
      {DIRECTIONAL_EFFECTS.includes(value.effect) && (
        <SelectField label="Direction" value={value.direction} options={DIRECTION_OPTIONS} labels={DIRECTION_LABELS}
          onChange={direction => onChange({ direction })} />
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid #EDE0D4', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#5A4336' }}>{title}</div>
      {children}
    </div>
  )
}

// Teacher-facing scene tuning lab (Materials page, "Phonics Story Lab" tab):
// jump straight to any unit/page of Phonics Quest's StoryReader and
// live-tweak its scene knobs — layout, colors, and full PowerPoint-style
// entrance/emphasis/travel effects per element — with instant visual
// feedback, then copy the resulting values back into
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
  function patchMascotIdle(patch: Partial<EmphasisConfig>) {
    setTuning(t => ({ ...t, mascotIdle: { ...t.mascotIdle, ...patch } }))
  }
  function patchProps(patch: Partial<EntranceEmphasisConfig>) {
    setTuning(t => ({ ...t, props: { ...t.props, ...patch } }))
  }
  function patchPropSlot(index: number, patch: Partial<PropSlot>) {
    setTuning(t => ({ ...t, propSlots: t.propSlots.map((s, i) => i === index ? { ...s, ...patch } : s) }))
  }
  function patchTarget(patch: Partial<EntranceEmphasisConfig>) {
    setTuning(t => ({ ...t, target: { ...t.target, ...patch } }))
  }
  function patchSentence(patch: Partial<EntranceConfig>) {
    setTuning(t => ({ ...t, sentence: { ...t.sentence, ...patch } }))
  }

  async function copyTuning() {
    await navigator.clipboard.writeText(JSON.stringify(tuning, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'flex', gap: 20, fontFamily: FONT, padding: '4px 16px 24px', flexWrap: 'wrap' }}>
      {/* Controls */}
      <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 640, overflowY: 'auto', paddingRight: 4 }}>
          <Section title="Layout & Colors">
            {NUMBER_FIELDS.map(f => (
              <RangeField key={f.key} label={f.label} value={tuning[f.key] as number} min={f.min} max={f.max} step={f.step}
                onChange={v => setField(f.key, v as StorySceneTuning[typeof f.key])} />
            ))}
            {COLOR_FIELDS.map(f => (
              <label key={f.key} style={{ fontSize: 12, fontWeight: 700, color: '#6B4F3F', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{f.label}</span>
                <input type="color" value={tuning[f.key] as string}
                  onChange={e => setField(f.key, e.target.value as StorySceneTuning[typeof f.key])}
                  style={{ width: 40, height: 24, border: 'none', background: 'none', cursor: 'pointer' }} />
              </label>
            ))}
          </Section>

          <Section title="Layer order (higher = drawn on top)">
            {Z_INDEX_FIELDS.map(f => (
              <RangeField key={f.key} label={f.label} value={tuning[f.key] as number} min={f.min} max={f.max} step={f.step}
                onChange={v => setField(f.key, v as StorySceneTuning[typeof f.key])} />
            ))}
          </Section>

          <Section title="Mascot travel (curved motion path)">
            <RangeField label="Slide duration (s)" value={tuning.transitionDurationSec} min={0.3} max={2.5} step={0.05}
              onChange={v => setField('transitionDurationSec', v)} />
            <RangeField label="Arc height (px, negative = up)" value={tuning.arcHeightPx} min={-120} max={120} step={2}
              onChange={v => setField('arcHeightPx', v)} />
            <SelectField label="Path easing" value={tuning.motionEasing} options={EASING_OPTIONS} labels={EASING_LABELS}
              onChange={v => setField('motionEasing', v)} />
            <SelectField label="Travel style (while moving)" value={tuning.travelStyle} options={TRAVEL_OPTIONS} labels={TRAVEL_STYLE_LABELS}
              onChange={v => setField('travelStyle', v)} />
            <RangeField label="Travel wobble cycle (s)" value={tuning.travelDurationSec} min={0.15} max={0.8} step={0.05}
              onChange={v => setField('travelDurationSec', v)} />
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6B4F3F', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={tuning.motionSoundEnabled} onChange={e => setField('motionSoundEnabled', e.target.checked)} />
              🔊 Sound cues (boing on set-off, pop on arrival)
            </label>
          </Section>

          <Section title="Mascot idle">
            <SelectField label="Idle style" value={tuning.mascotIdle.effect} options={EMPHASIS_OPTIONS} labels={EMPHASIS_LABELS}
              onChange={v => patchMascotIdle({ effect: v })} />
            <RangeField label="Idle duration (s)" value={tuning.mascotIdle.durationSec} min={1} max={4} step={0.1}
              onChange={v => patchMascotIdle({ durationSec: v })} />
            <SelectField label="Idle easing" value={tuning.mascotIdle.easing} options={EASING_OPTIONS} labels={EASING_LABELS}
              onChange={v => patchMascotIdle({ easing: v })} />
          </Section>

          <Section title="Ambient props">
            <EntranceEffectFields value={tuning.props} onChange={patchProps} />
            <RangeField label="Entrance duration (s)" value={tuning.props.durationSec} min={0.1} max={1.2} step={0.05}
              onChange={v => patchProps({ durationSec: v })} />
            <RangeField label="Entrance stagger (s)" value={tuning.propsEntranceStaggerSec} min={0} max={0.3} step={0.01}
              onChange={v => setField('propsEntranceStaggerSec', v)} />
            <SelectField label="Idle loop" value={tuning.props.emphasis} options={EMPHASIS_OPTIONS} labels={EMPHASIS_LABELS}
              onChange={v => patchProps({ emphasis: v })} />
            <RangeField label="Idle loop duration (s)" value={tuning.props.emphasisDurationSec} min={0.8} max={4} step={0.1}
              onChange={v => patchProps({ emphasisDurationSec: v })} />
            <RangeField label="Idle loop stagger (s)" value={tuning.propsEmphasisStaggerSec} min={0} max={0.6} step={0.05}
              onChange={v => setField('propsEmphasisStaggerSec', v)} />
            <SelectField label="Easing" value={tuning.props.easing} options={EASING_OPTIONS} labels={EASING_LABELS}
              onChange={v => patchProps({ easing: v })} />
          </Section>

          <Section title="Ambient prop positions (per prop, in sentence order)">
            {tuning.propSlots.map((slot, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: i < tuning.propSlots.length - 1 ? '1px dashed #EDE0D4' : undefined }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#A98B77' }}>Prop {i + 1}</div>
                <RangeField label="X (%)" value={slot.xPct} min={0} max={90} step={1}
                  onChange={v => patchPropSlot(i, { xPct: v })} />
                <RangeField label="Y (%)" value={slot.yPct} min={0} max={90} step={1}
                  onChange={v => patchPropSlot(i, { yPct: v })} />
                <RangeField label="Layer (z-index)" value={slot.zIndex} min={0} max={5} step={1}
                  onChange={v => patchPropSlot(i, { zIndex: v })} />
              </div>
            ))}
          </Section>

          <Section title="Destination prop">
            <EntranceEffectFields value={tuning.target} onChange={patchTarget} />
            <RangeField label="Entrance duration (s)" value={tuning.target.durationSec} min={0.1} max={1.2} step={0.05}
              onChange={v => patchTarget({ durationSec: v })} />
            <SelectField label="Idle loop" value={tuning.target.emphasis} options={EMPHASIS_OPTIONS} labels={EMPHASIS_LABELS}
              onChange={v => patchTarget({ emphasis: v })} />
            <RangeField label="Idle loop duration (s)" value={tuning.target.emphasisDurationSec} min={0.5} max={3} step={0.1}
              onChange={v => patchTarget({ emphasisDurationSec: v })} />
            <SelectField label="Easing" value={tuning.target.easing} options={EASING_OPTIONS} labels={EASING_LABELS}
              onChange={v => patchTarget({ easing: v })} />
          </Section>

          <Section title="Sentence text">
            <EntranceEffectFields value={tuning.sentence} onChange={patchSentence} />
            <RangeField label="Entrance duration (s)" value={tuning.sentence.durationSec} min={0.1} max={1.2} step={0.05}
              onChange={v => patchSentence({ durationSec: v })} />
            <SelectField label="Easing" value={tuning.sentence.easing} options={EASING_OPTIONS} labels={EASING_LABELS}
              onChange={v => patchSentence({ easing: v })} />
          </Section>
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
      <div style={{ flex: '1 1 480px', minWidth: 320 }}>
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
