import { useEffect, useMemo, useState } from 'react'
import { PHONICS_UNITS } from '@/lib/phonicsContent'
import { StoryReader } from './StoryReader'
import {
  storyPageKey, getStoryTuning, buildDefaultPageTuning, resizeProps, createStep, defaultPathForType, StorySceneTuningContext,
  DIRECTION_LABELS, EASING_LABELS, TRAVEL_STYLE_LABELS, EFFECT_LABELS, EFFECT_GROUPS, DIRECTIONAL_KINDS, START_TRIGGER_LABELS, REPEAT_LABELS, PATH_TYPE_LABELS,
  type StoryPageTuning, type SceneObjectTuning, type AnimationStep, type StepEffect, type EffectKind, type MotionPathShape, type StoryTuningLookup,
  type Direction, type Easing, type TravelStyle, type StartTrigger, type RepeatMode,
} from './storySceneTuning'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"

// Drafts (this Lab's in-progress, not-yet-copied-into-code edits) are
// auto-saved to localStorage so a reload/closed tab doesn't lose work —
// "Copy this page" is still what makes something permanent in the
// codebase, but a browser refresh in between no longer wipes everything.
const DRAFTS_STORAGE_KEY = 'phonics-story-lab-drafts'

function loadDrafts(): Record<string, StoryPageTuning> {
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const DIRECTION_OPTIONS = Object.keys(DIRECTION_LABELS) as Direction[]
const EASING_OPTIONS = Object.keys(EASING_LABELS) as Easing[]
const TRAVEL_OPTIONS = Object.keys(TRAVEL_STYLE_LABELS) as TravelStyle[]
const START_TRIGGER_OPTIONS = Object.keys(START_TRIGGER_LABELS) as StartTrigger[]
const REPEAT_OPTIONS = Object.keys(REPEAT_LABELS) as RepeatMode[]
const PATH_TYPE_OPTIONS = Object.keys(PATH_TYPE_LABELS) as MotionPathShape['type'][]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 700, color: '#6B4F3F', display: 'block' }}>
      <div style={{ marginBottom: 2 }}>{label}</div>
      {children}
    </label>
  )
}

const selectStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #E7D3C0', fontFamily: FONT, fontWeight: 400 }

function SelectField<T extends string>({ label, value, options, labels, onChange }: {
  label: string; value: T; options: T[]; labels: Record<T, string>; onChange: (v: T) => void
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={e => onChange(e.target.value as T)} style={selectStyle}>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid #EDE0D4', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#5A4336' }}>{title}</div>
      {children}
    </div>
  )
}

function EffectKindSelect({ value, onChange }: { value: EffectKind; onChange: (k: EffectKind) => void }) {
  return (
    <Field label="Effect">
      <select value={value} onChange={e => onChange(e.target.value as EffectKind)} style={selectStyle}>
        {EFFECT_GROUPS.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.kinds.map(k => <option key={k} value={k}>{EFFECT_LABELS[k]}</option>)}
          </optgroup>
        ))}
      </select>
    </Field>
  )
}

const miniBtnStyle: React.CSSProperties = {
  border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 11, fontWeight: 700,
  width: 22, height: 22, borderRadius: 6, background: '#FFFFFF', color: '#6B4F3F', boxShadow: '0 2px 0 #E7D3C0',
}

// One animation step, PowerPoint Animation-Pane style: an effect type
// (grouped Entrance/Emphasis/Motion Path), its type-specific fields, when
// it starts relative to the step before it, whether it repeats, and
// Motion Path's own shape sub-fields — Straight/Arc are simple two-point
// moves (Arc adds one bulge height); Curve is a full quadratic Bezier
// through an arbitrary control point; Circle loops around a center point
// from one angle to another (a 360° sweep is a full loop back to start).
function MotionPathFields({ path, onChangeType, onPatchPath }: {
  path: MotionPathShape
  onChangeType: (type: MotionPathShape['type']) => void
  onPatchPath: (patch: Partial<MotionPathShape>) => void
}) {
  return (
    <>
      <SelectField label="Path shape" value={path.type} options={PATH_TYPE_OPTIONS} labels={PATH_TYPE_LABELS}
        onChange={onChangeType} />

      {(path.type === 'straight' || path.type === 'arc') && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#A98B77' }}>Start</div>
            <RangeField label="X (%)" value={path.startXPct} min={0} max={100} step={1} onChange={v => onPatchPath({ startXPct: v })} />
            <RangeField label="Y (%)" value={path.startYPct} min={0} max={100} step={1} onChange={v => onPatchPath({ startYPct: v })} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#A98B77' }}>End</div>
            <RangeField label="X (%)" value={path.endXPct} min={0} max={100} step={1} onChange={v => onPatchPath({ endXPct: v })} />
            <RangeField label="Y (%)" value={path.endYPct} min={0} max={100} step={1} onChange={v => onPatchPath({ endYPct: v })} />
          </div>
        </div>
      )}
      {path.type === 'arc' && (
        <RangeField label="Arc height (px, negative = up)" value={path.arcHeightPx} min={-120} max={120} step={2}
          onChange={v => onPatchPath({ arcHeightPx: v })} />
      )}

      {path.type === 'curve' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#A98B77' }}>Start</div>
            <RangeField label="X (%)" value={path.startXPct} min={0} max={100} step={1} onChange={v => onPatchPath({ startXPct: v })} />
            <RangeField label="Y (%)" value={path.startYPct} min={0} max={100} step={1} onChange={v => onPatchPath({ startYPct: v })} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#A98B77' }}>Control</div>
            <RangeField label="X (%)" value={path.controlXPct} min={0} max={100} step={1} onChange={v => onPatchPath({ controlXPct: v })} />
            <RangeField label="Y (%)" value={path.controlYPct} min={0} max={100} step={1} onChange={v => onPatchPath({ controlYPct: v })} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#A98B77' }}>End</div>
            <RangeField label="X (%)" value={path.endXPct} min={0} max={100} step={1} onChange={v => onPatchPath({ endXPct: v })} />
            <RangeField label="Y (%)" value={path.endYPct} min={0} max={100} step={1} onChange={v => onPatchPath({ endYPct: v })} />
          </div>
        </div>
      )}

      {path.type === 'circle' && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#A98B77' }}>Center</div>
              <RangeField label="X (%)" value={path.centerXPct} min={0} max={100} step={1} onChange={v => onPatchPath({ centerXPct: v })} />
              <RangeField label="Y (%)" value={path.centerYPct} min={0} max={100} step={1} onChange={v => onPatchPath({ centerYPct: v })} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#A98B77' }}>&nbsp;</div>
              <RangeField label="Radius (%)" value={path.radiusPct} min={2} max={50} step={1} onChange={v => onPatchPath({ radiusPct: v })} />
            </div>
          </div>
          <RangeField label="Start angle (°)" value={path.startAngleDeg} min={-360} max={360} step={5}
            onChange={v => onPatchPath({ startAngleDeg: v })} />
          <RangeField label="End angle (°, 360 past start = full loop)" value={path.endAngleDeg} min={-360} max={720} step={5}
            onChange={v => onPatchPath({ endAngleDeg: v })} />
        </>
      )}
    </>
  )
}

// duration/delay/easing — independent of what kind of object owns it.
function StepRow({ step, index, total, isMascot, onChangeKind, onPatch, onPatchEffect, onPatchPath, onMove, onRemove }: {
  step: AnimationStep
  index: number
  total: number
  isMascot: boolean
  onChangeKind: (kind: EffectKind) => void
  onPatch: (patch: Partial<AnimationStep>) => void
  onPatchEffect: (patch: Partial<StepEffect>) => void
  onPatchPath: (patch: Partial<MotionPathShape>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <div style={{ border: '1px solid #EDE0D4', borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#A98B77' }}>Step {index + 1}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onMove(-1)} disabled={index === 0} style={miniBtnStyle}>▲</button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} style={miniBtnStyle}>▼</button>
          <button onClick={onRemove} style={miniBtnStyle}>✕</button>
        </div>
      </div>

      <EffectKindSelect value={step.effect.kind} onChange={onChangeKind} />

      {(step.effect.kind === 'wipe' || step.effect.kind === 'flyIn') && (
        <SelectField label="Direction" value={step.effect.direction} options={DIRECTION_OPTIONS} labels={DIRECTION_LABELS}
          onChange={direction => onPatchEffect({ direction })} />
      )}

      {step.effect.kind === 'motionPath' && (
        <>
          <MotionPathFields
            path={step.effect.path}
            onChangeType={type => onPatchEffect({ path: defaultPathForType(type) })}
            onPatchPath={onPatchPath}
          />
          <SelectField label="Travel style (while moving)" value={step.effect.travelStyle} options={TRAVEL_OPTIONS} labels={TRAVEL_STYLE_LABELS}
            onChange={travelStyle => onPatchEffect({ travelStyle })} />
        </>
      )}

      {step.effect.kind === 'swap' && (
        isMascot ? (
          <SelectField label="Appearance" value={step.effect.content === 'happy' ? 'happy' : 'default'}
            options={['default', 'happy']} labels={{ default: 'Default', happy: 'Happy' }}
            onChange={content => onPatchEffect({ content })} />
        ) : (
          <Field label="New content (emoji or text)">
            <input type="text" value={step.effect.content} onChange={e => onPatchEffect({ content: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #E7D3C0', fontFamily: FONT, boxSizing: 'border-box' }} />
          </Field>
        )
      )}

      {index > 0 && (
        <SelectField label="Start" value={step.startTrigger} options={START_TRIGGER_OPTIONS} labels={START_TRIGGER_LABELS}
          onChange={startTrigger => onPatch({ startTrigger })} />
      )}
      {step.effect.kind !== 'swap' && (
        <>
          <SelectField label="Repeat" value={step.repeat} options={REPEAT_OPTIONS} labels={REPEAT_LABELS}
            onChange={repeat => onPatch({ repeat })} />
          <RangeField label="Duration (s)" value={step.durationSec} min={0.1} max={3} step={0.05}
            onChange={v => onPatch({ durationSec: v })} />
        </>
      )}
      <RangeField label="Delay (s)" value={step.delaySec} min={0} max={2} step={0.05}
        onChange={v => onPatch({ delaySec: v })} />
      {step.effect.kind !== 'swap' && (
        <SelectField label="Easing" value={step.easing} options={EASING_OPTIONS} labels={EASING_LABELS}
          onChange={easing => onPatch({ easing })} />
      )}
    </div>
  )
}

// A manually-added object needs nothing but an emoji to exist — no phonics
// word required, unlike auto-detected props.
function AddObjectField({ onAdd }: { onAdd: (emoji: string) => void }) {
  const [value, setValue] = useState('')
  function submit() {
    if (!value.trim()) return
    onAdd(value)
    setValue('')
  }
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
      <input
        type="text" value={value} placeholder="🐝 emoji…"
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid #E7D3C0', fontFamily: FONT, fontSize: 13, boxSizing: 'border-box' }}
      />
      <button onClick={submit} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '6px 12px', borderRadius: 8, background: '#F0F8FF', color: '#5A4336' }}>
        + Add object
      </button>
    </div>
  )
}

// Local text state, not derived from `words.join(', ')` on every render:
// re-deriving the displayed value from the parsed-and-rejoined array on
// every keystroke means typing a stray double comma or space mid-edit
// produces a rejoined string that doesn't match what was actually typed,
// which snaps the input's value back and throws the cursor to the end.
// Keying this component by page (see its call site) still resets it to
// the new page's words when you navigate, without fighting mid-edit typing.
function HighlightWordsField({ initialValue, onChange }: { initialValue: string; onChange: (words: string[]) => void }) {
  const [text, setText] = useState(initialValue)
  return (
    <input
      type="text"
      value={text}
      onChange={e => {
        setText(e.target.value)
        onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))
      }}
      style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #E7D3C0', fontFamily: FONT, fontSize: 13, boxSizing: 'border-box' }}
    />
  )
}

function AddStepButton({ onAdd }: { onAdd: (kind: EffectKind) => void }) {
  return (
    <select
      value=""
      onChange={e => { if (e.target.value) onAdd(e.target.value as EffectKind) }}
      style={{ ...selectStyle, fontWeight: 700, background: '#F0F8FF', color: '#5A4336' }}
    >
      <option value="">+ Add animation…</option>
      {EFFECT_GROUPS.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.kinds.map(k => <option key={k} value={k}>{EFFECT_LABELS[k]}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

// Teacher-facing scene tuning lab (Materials page, "Phonics Story Lab" tab):
// PowerPoint Animation-Pane style — pick any object on the current page
// (the mascot, any ambient prop, the sentence text) and give it its own
// ordered list of animation steps, live-previewed instantly, then copy the
// result into storySceneTuning.ts's STORY_PAGE_TUNING.
//
// Every page gets its own fully independent StoryPageTuning — edits on
// page 3 never touch page 1. `pageTunings` holds this session's
// in-progress edits, keyed by storyPageKey(unit.id, pageIndex); a page not
// yet touched falls back to getStoryTuning() (any already-saved override)
// or buildDefaultPageTuning() (mascot idles, nothing auto-walks).
export function StoryLab() {
  const [unitIdx, setUnitIdx] = useState(0)
  const [pageIdx, setPageIdx] = useState(0)
  const [jumpNonce, setJumpNonce] = useState(0)
  const [pageTunings, setPageTunings] = useState<Record<string, StoryPageTuning>>(loadDrafts)
  const [selectedObjectId, setSelectedObjectId] = useState('mascot')
  const [copied, setCopied] = useState(false)
  const [replayNonce, setReplayNonce] = useState(0)

  useEffect(() => {
    try { localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(pageTunings)) } catch { /* storage unavailable/full — edits still work this session */ }
  }, [pageTunings])

  const unit = PHONICS_UNITS[unitIdx]
  // basePage is undefined for a page that only exists because "+ Add scene"
  // created it — its content then comes entirely from the tuning override below.
  const basePage = unit.storyPages[pageIdx]
  const currentKey = storyPageKey(unit.id, pageIdx)
  const tuning = pageTunings[currentKey] ?? getStoryTuning(unit.id, pageIdx) ?? buildDefaultPageTuning()

  // A unit's page count isn't just unit.storyPages.length — pages appended
  // via "+ Add scene" only exist as overrides, possibly still only in this
  // session's pageTunings (not yet saved into STORY_PAGE_TUNING). Can't use
  // the useResolvedPageCount hook here: it reads context from the nearest
  // ANCESTOR Provider, and the Provider StoryLab itself renders (below)
  // wraps only <StoryReader>, not StoryLab's own render — so it would only
  // ever see already-saved pages, missing in-session additions.
  let pageCount = unit.storyPages.length
  while (storyPageKey(unit.id, pageCount) in pageTunings || getStoryTuning(unit.id, pageCount)) pageCount++

  const text = tuning.textOverride ?? basePage?.text ?? ''
  const highlight = tuning.highlightOverride ?? basePage?.highlight ?? []

  // useStepTimeline only restarts an object's animations when its `steps`
  // array reference changes — which normally only happens on a real edit.
  // A step that already finished (e.g. a one-shot Pop) has nothing left to
  // watch again without editing something, so Replay forces fresh step-array
  // references (same content, new identity) via replayNonce, without
  // touching the actual saved tuning or losing per-page isolation.
  const previewTuning = useMemo<StoryPageTuning>(() => ({
    ...tuning,
    mascot: { ...tuning.mascot, steps: [...tuning.mascot.steps] },
    props: tuning.props.map(p => ({ ...p, steps: [...p.steps] })),
    sentence: { ...tuning.sentence, steps: [...tuning.sentence.steps] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tuning, replayNonce])

  // Every object is manually placed (see "+ Add object" below) — nothing
  // spawns automatically from highlighted/phonics words anymore.
  const objectOptions = [
    { id: 'mascot', label: `🏃 Mascot`, kind: 'mascot' as const },
    ...tuning.extraObjects.map((o, i) => ({ id: `prop-${i}`, label: `${o.emoji} Prop ${i + 1}`, kind: 'object' as const, extraId: o.id, hidden: o.hidden })),
    { id: 'sentence', label: '💬 Sentence text', kind: 'sentence' as const },
  ]
  const selectedObject: SceneObjectTuning =
    selectedObjectId === 'mascot' ? tuning.mascot
    : selectedObjectId === 'sentence' ? tuning.sentence
    : tuning.props.find(p => p.id === selectedObjectId) ?? tuning.mascot

  function jumpTo(nextUnitIdx: number, nextPageIdx: number) {
    setUnitIdx(nextUnitIdx)
    setPageIdx(nextPageIdx)
    setJumpNonce(n => n + 1)
    setSelectedObjectId('mascot')
  }

  // Every object edit funnels through here, which — after applying the
  // change — resizes `props` 1:1 to extraObjects via resizeProps(). Text/
  // highlight edits don't touch object count at all anymore (see the
  // ExtraObject comment above), so this is now a simple, cheap no-op check
  // for those, not a live re-derivation.
  function updateTuning(updater: (t: StoryPageTuning) => StoryPageTuning) {
    setPageTunings(prev => {
      const current = prev[currentKey] ?? getStoryTuning(unit.id, pageIdx) ?? buildDefaultPageTuning()
      const updated = updater(current)
      return { ...prev, [currentKey]: resizeProps(updated, updated.extraObjects.length) }
    })
  }

  function updateSelectedObject(updater: (o: SceneObjectTuning) => SceneObjectTuning) {
    updateTuning(t => {
      if (selectedObjectId === 'mascot') return { ...t, mascot: updater(t.mascot) }
      if (selectedObjectId === 'sentence') return { ...t, sentence: updater(t.sentence) }
      return { ...t, props: t.props.map(p => p.id === selectedObjectId ? updater(p) : p) }
    })
  }

  function setField<K extends keyof StoryPageTuning>(key: K, value: StoryPageTuning[K]) {
    updateTuning(t => ({ ...t, [key]: value }))
  }
  function setObjectField<K extends keyof SceneObjectTuning>(key: K, value: SceneObjectTuning[K]) {
    updateSelectedObject(o => ({ ...o, [key]: value }))
  }

  // Content editing — text/highlight only affect sentence-card coloring now,
  // not what objects exist, so editing them never touches the object list
  // or the current selection.
  function setText(value: string) {
    updateTuning(t => ({ ...t, textOverride: value }))
  }
  function setHighlight(words: string[]) {
    updateTuning(t => ({ ...t, highlightOverride: words }))
  }

  // Objects are placed entirely by hand. `toggleObjectVisibility` hides/
  // shows one without losing its tuning; `removeExtraObject` deletes it
  // (and its tuning) outright — both always available, unlike the old
  // auto-vs-manual split.
  function addExtraObject(emoji: string) {
    if (!emoji.trim()) return
    updateTuning(t => ({ ...t, extraObjects: [...t.extraObjects, { id: `extra-${Math.random().toString(36).slice(2, 9)}`, emoji: emoji.trim(), hidden: false }] }))
    setSelectedObjectId('mascot')
  }
  function toggleObjectVisibility(extraId: string) {
    updateTuning(t => ({ ...t, extraObjects: t.extraObjects.map(o => o.id === extraId ? { ...o, hidden: !o.hidden } : o) }))
  }
  function removeExtraObject(extraId: string) {
    updateTuning(t => ({ ...t, extraObjects: t.extraObjects.filter(o => o.id !== extraId) }))
    setSelectedObjectId('mascot')
  }

  // Scenes are append/remove-from-the-end only, to avoid re-keying every
  // subsequent page's STORY_PAGE_TUNING entry (keyed by unitId::pageIndex).
  // Original PPT-sourced pages (index < unit.storyPages.length) can be
  // edited but never removed, only pages this Lab added.
  function addScene() {
    const newIdx = pageCount
    const key = storyPageKey(unit.id, newIdx)
    setPageTunings(prev => ({ ...prev, [key]: { ...buildDefaultPageTuning(), textOverride: '', highlightOverride: [] } }))
    jumpTo(unitIdx, newIdx)
  }
  function removeScene() {
    const key = storyPageKey(unit.id, pageIdx)
    setPageTunings(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    jumpTo(unitIdx, Math.max(0, pageIdx - 1))
  }

  // Swaps this page with its neighbor — same adjacent-swap pattern as
  // reordering animation steps. A page whose content still falls back to
  // phonicsContent.ts (textOverride: null) has to be "materialized" (its
  // current effective text/highlight baked into an explicit override)
  // before the swap: otherwise moving it to another index would silently
  // pick up THAT index's base sentence instead of the one being moved.
  // Content-wise this is invisible (same resolved text before and after);
  // it just now lives in an override instead of the static array.
  function moveScene(dir: -1 | 1) {
    const otherIdx = pageIdx + dir
    if (otherIdx < 0 || otherIdx >= pageCount) return
    function materialize(idx: number): StoryPageTuning {
      const base = unit.storyPages[idx]
      const key = storyPageKey(unit.id, idx)
      const t = pageTunings[key] ?? getStoryTuning(unit.id, idx) ?? buildDefaultPageTuning()
      return { ...t, textOverride: t.textOverride ?? base?.text ?? '', highlightOverride: t.highlightOverride ?? base?.highlight ?? [] }
    }
    const here = materialize(pageIdx)
    const there = materialize(otherIdx)
    setPageTunings(prev => ({
      ...prev,
      [storyPageKey(unit.id, pageIdx)]: there,
      [storyPageKey(unit.id, otherIdx)]: here,
    }))
    jumpTo(unitIdx, otherIdx)
  }

  function addStep(kind: EffectKind) {
    updateSelectedObject(o => ({ ...o, steps: [...o.steps, createStep(kind)] }))
  }
  function removeStep(stepId: string) {
    updateSelectedObject(o => ({ ...o, steps: o.steps.filter(s => s.id !== stepId) }))
  }
  function moveStep(stepId: string, dir: -1 | 1) {
    updateSelectedObject(o => {
      const idx = o.steps.findIndex(s => s.id === stepId)
      const swapWith = idx + dir
      if (idx === -1 || swapWith < 0 || swapWith >= o.steps.length) return o
      const steps = [...o.steps]
      const tmp = steps[idx]
      steps[idx] = steps[swapWith]
      steps[swapWith] = tmp
      return { ...o, steps }
    })
  }
  function patchStep(stepId: string, patch: Partial<AnimationStep>) {
    updateSelectedObject(o => ({ ...o, steps: o.steps.map(s => s.id === stepId ? { ...s, ...patch } : s) }))
  }
  function patchStepEffect(stepId: string, patch: Partial<StepEffect>) {
    updateSelectedObject(o => ({
      ...o,
      steps: o.steps.map(s => s.id === stepId ? { ...s, effect: { ...s.effect, ...patch } as StepEffect } : s),
    }))
  }
  function patchStepPath(stepId: string, patch: Partial<MotionPathShape>) {
    updateSelectedObject(o => ({
      ...o,
      steps: o.steps.map(s => s.id === stepId && s.effect.kind === 'motionPath'
        ? { ...s, effect: { ...s.effect, path: { ...s.effect.path, ...patch } as MotionPathShape } }
        : s),
    }))
  }
  // Switching kind resets duration/easing/repeat to that kind's own sensible
  // defaults (createStep's) rather than keeping whatever the PREVIOUS kind
  // had — e.g. Float defaults to looping forever, which would otherwise
  // leak onto a freshly-chosen Motion Path and make it loop forever too,
  // so it would never actually finish arriving. Chain position
  // (startTrigger/delay) is kept since that's about ordering, not the effect.
  function changeStepKind(stepId: string, kind: EffectKind) {
    updateSelectedObject(o => ({
      ...o,
      steps: o.steps.map(s => s.id === stepId
        ? { ...createStep(kind), id: s.id, startTrigger: s.startTrigger, delaySec: s.delaySec }
        : s),
    }))
  }

  // The Lab's live preview only ever shows the current page, so `resolve`
  // always returns previewTuning — which already carries replayNonce so the
  // Replay button can force a from-scratch replay of already-finished
  // steps. `hasOverride` checks BOTH this session's edits and any
  // already-saved STORY_PAGE_TUNING entry, since useResolvedPageCount
  // (used by <StoryReader>'s own page-count logic) needs to see pages
  // added only in this session too.
  const labLookup: StoryTuningLookup = {
    resolve: () => previewTuning,
    hasOverride: (unitId, pageIndex) => storyPageKey(unitId, pageIndex) in pageTunings || !!getStoryTuning(unitId, pageIndex),
  }

  // Removes this page's in-session edit, reverting it to its saved/default
  // tuning — NOT a reset of every page, only the one currently shown.
  function resetCurrentPage() {
    setPageTunings(prev => {
      const next = { ...prev }
      delete next[currentKey]
      return next
    })
  }

  // Copies a ready-to-paste `'unitId::pageIndex': { ... },` entry for
  // STORY_PAGE_TUNING — just this page, not the whole session's edits.
  async function copyTuning() {
    await navigator.clipboard.writeText(`'${currentKey}': ${JSON.stringify(tuning, null, 2)},`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'flex', gap: 20, fontFamily: FONT, padding: '4px 16px 24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Controls — sticky + height-capped with its own scrollbar, so the
          live scene beside it never scrolls out of view no matter how much
          this panel grows (position/animations/content/object sections). */}
      <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', paddingRight: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#6B4F3F' }}>🧪 Phonics Story Lab</div>
        <div style={{ fontSize: 12, color: '#A98B77' }}>Click an object, give it any animation(s), then copy the values into code.</div>

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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {Array.from({ length: pageCount }, (_, i) => {
              const edited = storyPageKey(unit.id, i) in pageTunings
              return (
                <button
                  key={i}
                  onClick={() => jumpTo(unitIdx, i)}
                  title={edited ? 'This page has unsaved edits' : undefined}
                  style={{
                    position: 'relative', border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13,
                    width: 30, height: 30, borderRadius: '50%',
                    background: i === pageIdx ? '#F2879B' : '#FFFFFF',
                    color: i === pageIdx ? '#fff' : '#6B4F3F',
                    boxShadow: '0 3px 0 #E7D3C0',
                  }}>
                  {i + 1}
                  {edited && (
                    <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: '#8BC273', border: '1.5px solid #fff' }} />
                  )}
                </button>
              )
            })}
            <button
              onClick={addScene}
              title="Add a new scene at the end of this unit's story"
              style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 15, width: 30, height: 30, borderRadius: '50%', background: '#F0F8FF', color: '#7FB8E0', boxShadow: '0 3px 0 #DCEEFA' }}>
              +
            </button>
            {pageIdx === pageCount - 1 && pageIdx >= unit.storyPages.length && (
              <button
                onClick={removeScene}
                title="Remove this scene"
                style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 12, padding: '6px 10px', borderRadius: '999px', background: '#FFF0F0', color: '#D96C6C', boxShadow: '0 3px 0 #F5D9D9' }}>
                🗑 Remove
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => moveScene(-1)} disabled={pageIdx === 0}
              style={{ border: 'none', cursor: pageIdx === 0 ? 'default' : 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 12, padding: '6px 10px', borderRadius: '999px', background: '#FFFFFF', color: pageIdx === 0 ? '#CBB9A8' : '#6B4F3F', boxShadow: '0 3px 0 #E7D3C0' }}>
              ◀ Move earlier
            </button>
            <button onClick={() => moveScene(1)} disabled={pageIdx === pageCount - 1}
              style={{ border: 'none', cursor: pageIdx === pageCount - 1 ? 'default' : 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 12, padding: '6px 10px', borderRadius: '999px', background: '#FFFFFF', color: pageIdx === pageCount - 1 ? '#CBB9A8' : '#6B4F3F', boxShadow: '0 3px 0 #E7D3C0' }}>
              Move later ▶
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#A98B77', marginTop: 4 }}>Each page's settings are independent — a green dot marks pages you've edited this session. Scenes beyond the original story can only be added/removed at the end, but any page can be reordered.</div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#A98B77', marginBottom: 4 }}>Sentence text</div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #E7D3C0', fontFamily: FONT, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 11, color: '#A98B77', margin: '6px 0 2px' }}>Highlighted words</div>
          <HighlightWordsField key={currentKey} initialValue={highlight.join(', ')} onChange={setHighlight} />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#A98B77', marginBottom: 4 }}>Object</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {objectOptions.map(o => (
              <div key={o.id} style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setSelectedObjectId(o.id)}
                  style={{
                    flex: 1, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13, textAlign: 'left',
                    padding: '8px 10px', borderRadius: 10,
                    background: o.id === selectedObjectId ? '#F2879B' : '#FFFFFF',
                    color: o.id === selectedObjectId ? '#fff' : o.kind === 'object' && o.hidden ? '#CBB9A8' : '#6B4F3F',
                    boxShadow: '0 3px 0 #E7D3C0',
                  }}>
                  {o.label}{o.kind === 'object' && o.hidden ? ' (hidden)' : ''}
                </button>
                {o.kind === 'object' && (
                  <>
                    <button onClick={() => toggleObjectVisibility(o.extraId)} title={o.hidden ? 'Show this object' : 'Hide this object'} style={miniBtnStyle}>{o.hidden ? '🙈' : '👁'}</button>
                    <button onClick={() => removeExtraObject(o.extraId)} title="Delete this object" style={miniBtnStyle}>✕</button>
                  </>
                )}
              </div>
            ))}
          </div>
          <AddObjectField onAdd={addExtraObject} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selectedObjectId !== 'sentence' && (
            <Section title="Position">
              <RangeField label="X (%)" value={selectedObject.xPct} min={0} max={100} step={1}
                onChange={v => setObjectField('xPct', v)} />
              <RangeField label="Y (%)" value={selectedObject.yPct} min={0} max={100} step={1}
                onChange={v => setObjectField('yPct', v)} />
              <RangeField label="Size (px)" value={selectedObject.fontSize} min={16} max={130} step={1}
                onChange={v => setObjectField('fontSize', v)} />
              <RangeField label="Layer (z-index)" value={selectedObject.zIndex} min={0} max={5} step={1}
                onChange={v => setObjectField('zIndex', v)} />
            </Section>
          )}

          <Section title="Animations (in order)">
            {selectedObject.steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                index={i}
                total={selectedObject.steps.length}
                isMascot={selectedObjectId === 'mascot'}
                onChangeKind={kind => changeStepKind(step.id, kind)}
                onPatch={patch => patchStep(step.id, patch)}
                onPatchEffect={patch => patchStepEffect(step.id, patch)}
                onPatchPath={patch => patchStepPath(step.id, patch)}
                onMove={dir => moveStep(step.id, dir)}
                onRemove={() => removeStep(step.id)}
              />
            ))}
            <AddStepButton onAdd={addStep} />
          </Section>

          <Section title="Scene">
            <RangeField label="Scene width (px)" value={tuning.sceneMaxWidth} min={240} max={720} step={4}
              onChange={v => setField('sceneMaxWidth', v)} />
            <RangeField label="Scene height (px)" value={tuning.sceneHeight} min={100} max={280} step={2}
              onChange={v => setField('sceneHeight', v)} />
            {([['bgTop', 'Sky (top)'], ['bgMid', 'Sky (mid)'], ['bgBottom', 'Sky (bottom)'], ['groundColor', 'Ground']] as const).map(([key, label]) => (
              <label key={key} style={{ fontSize: 12, fontWeight: 700, color: '#6B4F3F', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{label}</span>
                <input type="color" value={tuning[key]}
                  onChange={e => setField(key, e.target.value)}
                  style={{ width: 40, height: 24, border: 'none', background: 'none', cursor: 'pointer' }} />
              </label>
            ))}
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6B4F3F', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={tuning.motionSoundEnabled} onChange={e => setField('motionSoundEnabled', e.target.checked)} />
              🔊 Sound cues while the mascot has a Motion Path playing
            </label>
          </Section>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={resetCurrentPage}
            style={{ flex: 1, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '8px 0', borderRadius: 12, background: '#FFFFFF', color: '#6B4F3F', boxShadow: '0 3px 0 #E7D3C0' }}>
            Reset this page
          </button>
          <button
            onClick={copyTuning}
            style={{ flex: 1, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 13, padding: '8px 0', borderRadius: 12, background: '#8BC273', color: '#fff', boxShadow: '0 3px 0 #6FA05A' }}>
            {copied ? 'Copied ✓' : 'Copy this page'}
          </button>
        </div>
      </div>

      {/* Live scene — also sticky, so it stays in view beside the controls
          panel regardless of page scroll position. */}
      <div style={{ flex: '1 1 480px', minWidth: 320, position: 'sticky', top: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={() => setReplayNonce(n => n + 1)}
            style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: '999px', background: '#FFFFFF', color: '#6B4F3F', boxShadow: '0 3px 0 #E7D3C0' }}>
            ▶ Replay
          </button>
        </div>
        <StorySceneTuningContext.Provider value={labLookup}>
          <StoryReader
            key={`${unit.id}-${jumpNonce}`}
            unit={unit}
            initialPageIndex={pageIdx}
            onDone={() => jumpTo(unitIdx, Math.min(pageIdx + 1, pageCount - 1))}
          />
        </StorySceneTuningContext.Provider>
      </div>
    </div>
  )
}
