import { createContext, useContext } from 'react'
import type { PhonicsUnit } from '@/lib/phonicsContent'

// Knobs for StoryReader's scene visuals/animation, PowerPoint-Animation-Pane
// style: click any object on the page (the mascot, any ambient prop, the
// sentence text) and give it its own ordered list of animation steps —
// Entrance-type (Fade/Wipe/Fly In/Pop/Bounce In), Emphasis-type (Float/
// Wiggle/Spin/Grow-Shrink/Pulse/Shake), or a Motion Path (start position ->
// end position) — chained "after previous" (sequential) or "with previous"
// (simultaneous). Nothing about what an object IS constrains which steps it
// can have; the mascot moving is just it having a Motion Path step, not a
// special hard-coded behavior.
//
// Every page of every unit gets its OWN independent StoryPageTuning —
// editing page 3 never touches page 1. A page only takes up space in
// STORY_PAGE_TUNING once it's been specifically customized; anything not in
// there renders via buildDefaultPageTuning() (mascot idles, props pop in
// and float, nothing auto-walks — there's no more sentence-verb detection
// deciding the mascot's behavior for it).
//
// Production reads through the context's default lookup (no Provider
// needed) — only StoryLab.tsx (Materials page, "Phonics Story Lab" tab)
// mounts a Provider backed by its own in-session edits so every scene can
// be tweaked and previewed live without touching code.

export type Direction = 'fromTop' | 'fromBottom' | 'fromLeft' | 'fromRight'
export type Easing = 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear'
export type TravelStyle = 'bob' | 'hop' | 'spin' | 'plain'
export type StartTrigger = 'afterPrevious' | 'withPrevious'
export type RepeatMode = 'once' | 'loop'

export const DIRECTION_LABELS: Record<Direction, string> = {
  fromTop: 'From Top',
  fromBottom: 'From Bottom',
  fromLeft: 'From Left',
  fromRight: 'From Right',
}

export const EASING_LABELS: Record<Easing, string> = {
  ease: 'Ease',
  'ease-in': 'Ease In',
  'ease-out': 'Ease Out',
  'ease-in-out': 'Ease In-Out',
  linear: 'Linear',
}

export const TRAVEL_STYLE_LABELS: Record<TravelStyle, string> = {
  bob: 'Run (bob + wobble)',
  hop: 'Hop',
  spin: 'Spin',
  plain: 'Plain (no wobble)',
}

export const START_TRIGGER_LABELS: Record<StartTrigger, string> = {
  afterPrevious: 'After previous',
  withPrevious: 'With previous',
}

export const REPEAT_LABELS: Record<RepeatMode, string> = {
  once: 'Once',
  loop: 'Loop forever',
}

// Every animation an object can be given, independent of what kind of
// object it is. 'kind' is the discriminant; only wipe/flyIn carry a
// direction, only motionPath carries a path, and only swap carries content.
export type EffectKind = 'fade' | 'wipe' | 'flyIn' | 'pop' | 'bounceIn' | 'float' | 'wiggle' | 'spin' | 'growShrink' | 'pulse' | 'shake' | 'motionPath' | 'swap'

export const EFFECT_LABELS: Record<EffectKind, string> = {
  fade: 'Fade In',
  wipe: 'Wipe',
  flyIn: 'Fly In',
  pop: 'Pop In',
  bounceIn: 'Bounce In',
  float: 'Float',
  wiggle: 'Wiggle',
  spin: 'Spin',
  growShrink: 'Grow / Shrink',
  pulse: 'Pulse',
  shake: 'Shake',
  motionPath: 'Motion Path',
  swap: 'Change Appearance',
}

// Grouped for the Lab's effect-type dropdown, mirroring PowerPoint's
// Entrance/Emphasis/Motion Path animation categories.
export const EFFECT_GROUPS: { label: string; kinds: EffectKind[] }[] = [
  { label: 'Entrance', kinds: ['fade', 'wipe', 'flyIn', 'pop', 'bounceIn'] },
  { label: 'Emphasis', kinds: ['float', 'wiggle', 'spin', 'growShrink', 'pulse', 'shake'] },
  { label: 'Motion', kinds: ['motionPath'] },
  { label: 'Appearance', kinds: ['swap'] },
]

// Which kinds carry a `direction` field — shown/enabled in the Lab only for these.
export const DIRECTIONAL_KINDS: EffectKind[] = ['wipe', 'flyIn']

// A Motion Path's actual shape through the scene. 'straight'/'arc' are a
// simple two-point move (arc adds one symmetric bulge at the midpoint,
// via a separate transform dip in stepAnimation.ts); 'curve' is a full
// quadratic Bezier through an arbitrary control point; 'circle' loops
// around a center point from one angle to another (360° sweep = a full
// loop back to the start).
export type MotionPathShape =
  | { type: 'straight'; startXPct: number; startYPct: number; endXPct: number; endYPct: number }
  | { type: 'arc'; startXPct: number; startYPct: number; endXPct: number; endYPct: number; arcHeightPx: number }
  | { type: 'curve'; startXPct: number; startYPct: number; controlXPct: number; controlYPct: number; endXPct: number; endYPct: number }
  | { type: 'circle'; centerXPct: number; centerYPct: number; radiusPct: number; startAngleDeg: number; endAngleDeg: number }

export const PATH_TYPE_LABELS: Record<MotionPathShape['type'], string> = {
  straight: 'Straight Line',
  arc: 'Arc',
  curve: 'Curve',
  circle: 'Circle / Loop',
}

export function defaultPathForType(type: MotionPathShape['type']): MotionPathShape {
  switch (type) {
    case 'straight':
      return { type: 'straight', startXPct: 10, startYPct: 40, endXPct: 50, endYPct: 40 }
    case 'arc':
      return { type: 'arc', startXPct: 10, startYPct: 40, endXPct: 50, endYPct: 40, arcHeightPx: -40 }
    case 'curve':
      return { type: 'curve', startXPct: 10, startYPct: 60, controlXPct: 30, controlYPct: 10, endXPct: 50, endYPct: 40 }
    case 'circle':
      return { type: 'circle', centerXPct: 30, centerYPct: 40, radiusPct: 20, startAngleDeg: 0, endAngleDeg: 360 }
  }
}

export type StepEffect =
  | { kind: 'fade' | 'pop' | 'bounceIn' }
  | { kind: 'wipe' | 'flyIn'; direction: Direction }
  | { kind: 'float' | 'wiggle' | 'spin' | 'growShrink' | 'pulse' | 'shake' }
  | { kind: 'motionPath'; path: MotionPathShape; travelStyle: TravelStyle }
  | { kind: 'swap'; content: string }   // instantly swaps what the object renders — an emoji for props/sentence, a sprite variant ('default'/'happy') for the mascot

export interface AnimationStep {
  id: string
  effect: StepEffect
  startTrigger: StartTrigger   // ignored on an object's first step
  durationSec: number
  delaySec: number
  easing: Easing
  repeat: RepeatMode
}

// One scene object's own resting position + stacking order + orientation +
// its animation timeline. `id` is stable per page ('mascot', 'prop-0'..,
// 'sentence') so edits keep applying to the same object across re-renders.
// rotationDeg/flipX/flipY are a static base orientation — like PowerPoint's
// Rotate/Flip object properties, not an animation step — rendered as a
// static CSS `transform` (see StoryReader.tsx) that any animation steps'
// own transforms compose on TOP of via WAAPI's composite:'add' (which
// combines against the element's underlying/CSS transform, not just other
// animations), so a flipped object stays flipped through a Spin/Pop/etc.
// instead of snapping back to unflipped the moment a step plays.
export interface SceneObjectTuning {
  id: string
  xPct: number
  yPct: number
  zIndex: number
  fontSize: number
  rotationDeg: number
  flipX: boolean
  flipY: boolean
  steps: AnimationStep[]
}

// A scene object placed by hand — an emoji is enough content to give it,
// and it gets the exact same Position + Animations authoring as anything
// else (see StoryLab's Object picker). Objects are no longer auto-spawned
// from highlighted/phonics words: that coupling made editing the
// highlighted-words text field spawn or delete objects mid-keystroke
// (every time typing happened to complete a real word match), which was
// both surprising and impossible to type through cleanly. `highlight`
// still colors matched substrings in the sentence card — it just no
// longer has any effect on what objects exist. `hidden` toggles visibility
// without losing the object's tuning/animation, separate from deleting it.
export interface ExtraObject {
  id: string
  emoji: string
  hidden: boolean
}

// The static base `transform` for an object's rotation/flip (see
// SceneObjectTuning above) — undefined when there's nothing to apply, so
// callers can skip setting the style property entirely rather than adding
// a meaningless `transform: none`.
export function objectTransform(o: Pick<SceneObjectTuning, 'rotationDeg' | 'flipX' | 'flipY'>): string | undefined {
  const parts: string[] = []
  if (o.rotationDeg) parts.push(`rotate(${o.rotationDeg}deg)`)
  if (o.flipX) parts.push('scaleX(-1)')
  if (o.flipY) parts.push('scaleY(-1)')
  return parts.length ? parts.join(' ') : undefined
}

export interface StoryPageTuning {
  sceneMaxWidth: number
  sceneHeight: number
  bgTop: string
  bgMid: string
  bgBottom: string
  groundColor: string
  mascot: SceneObjectTuning
  props: SceneObjectTuning[]   // sized 1:1 to extraObjects (same index), regardless of hidden state
  sentence: SceneObjectTuning  // position fields unused — laid out by its own card
  motionSoundEnabled: boolean

  // Content overrides — null means "inherit from phonicsContent.ts's static
  // StoryPage" (untouched pages behave exactly as before). Set once the
  // Lab's Content section is edited for this page. highlightOverride only
  // affects sentence-text coloring now, not what objects appear.
  textOverride: string | null
  highlightOverride: string[] | null
  extraObjects: ExtraObject[]
}

export function defaultStepEffect(kind: EffectKind): StepEffect {
  switch (kind) {
    case 'wipe':
    case 'flyIn':
      return { kind, direction: 'fromBottom' }
    case 'motionPath':
      return { kind: 'motionPath', path: defaultPathForType('arc'), travelStyle: 'bob' }
    case 'swap':
      return { kind: 'swap', content: '' }
    default:
      return { kind }
  }
}

const LOOPING_KINDS: EffectKind[] = ['float', 'wiggle', 'spin', 'growShrink', 'pulse', 'shake']

// Builds one new step with sensible defaults for its kind — used by the
// Lab's "+ Add animation" and by buildDefaultPageTuning() below. A swap is
// instant (no WAAPI animation plays for it), so its duration is nominal —
// just enough for chained "after previous" steps to move on right away.
export function createStep(kind: EffectKind, overrides: Partial<AnimationStep> = {}): AnimationStep {
  return {
    id: `step-${Math.random().toString(36).slice(2, 9)}`,
    effect: defaultStepEffect(kind),
    startTrigger: 'afterPrevious',
    durationSec: kind === 'motionPath' ? 0.8 : kind === 'swap' ? 0 : 0.4,
    delaySec: 0,
    easing: kind === 'motionPath' ? 'ease-in-out' : 'ease-out',
    repeat: LOOPING_KINDS.includes(kind) ? 'loop' : 'once',
    ...overrides,
  }
}

// One default prop slot's tuning, by its position in extraObjects. Used to
// pad `props` back out after resizeProps() grows it.
function newPropSlot(index: number): SceneObjectTuning {
  return {
    id: `prop-${index}`,
    xPct: 10 + index * 28, yPct: 8, zIndex: 1, fontSize: 40,
    rotationDeg: 0, flipX: false, flipY: false,
    steps: [
      createStep('pop', { durationSec: 0.4, delaySec: index * 0.06 }),
      createStep('float', { durationSec: 2.6, delaySec: index * 0.25, easing: 'ease-in-out', repeat: 'loop' }),
    ],
  }
}

// The starting point for a page nobody has customized yet: mascot idles in
// place (no motion path — it only ever moves once someone gives it one),
// no objects (extraObjects always starts empty), sentence just pops in.
// Memoized (a single shared instance) so repeated calls return the SAME
// object/array references — StoryReader's WAAPI effect depends on
// step-list identity to know when to restart, and without this every
// render of an unedited page would look like a change.
let defaultPageTuning: StoryPageTuning | null = null
export function buildDefaultPageTuning(): StoryPageTuning {
  if (!defaultPageTuning) {
    defaultPageTuning = {
      sceneMaxWidth: 480,
      sceneHeight: 170,
      bgTop: '#FFF9F1',
      bgMid: '#FBF0E4',
      bgBottom: '#F3E3D0',
      groundColor: '#EAD9C4',
      motionSoundEnabled: true,
      mascot: {
        id: 'mascot', xPct: 40, yPct: 41, zIndex: 2, fontSize: 84,
        rotationDeg: 0, flipX: false, flipY: false,
        steps: [createStep('float', { durationSec: 2.4, easing: 'ease-in-out', repeat: 'loop' })],
      },
      props: [],
      sentence: {
        id: 'sentence', xPct: 0, yPct: 0, zIndex: 0, fontSize: 24,
        rotationDeg: 0, flipX: false, flipY: false,
        steps: [createStep('pop', { durationSec: 0.35 })],
      },
      textOverride: null,
      highlightOverride: null,
      extraObjects: [],
    }
  }
  return defaultPageTuning
}

// Resizes `tuning.props` to exactly `count` slots — pads with fresh default
// slots when growing (e.g. a new extra object was added), truncates from
// the end when shrinking (an extra object was deleted, not just hidden).
export function resizeProps(tuning: StoryPageTuning, count: number): StoryPageTuning {
  if (tuning.props.length === count) return tuning
  const props = tuning.props.slice(0, count)
  while (props.length < count) props.push(newPropSlot(props.length))
  return { ...tuning, props }
}

// Per-page overrides, keyed by storyPageKey(unitId, pageIndex). Populate by
// pasting the Story Lab's "Copy this page" output in here. A page absent
// from this map renders via buildDefaultPageTuning() exactly as before.
// The 'deleted' sentinel marks a slot as explicitly gone — needed because
// deleting any page (see StoryLab's deleteScene) works by shifting every
// later page's content down one slot and marking the now-vacated LAST slot
// deleted; that last slot can land within phonicsContent.ts's own page
// range (deleting one of 5 original pages leaves 4), so "no override
// recorded" alone can't mean "doesn't exist" — it normally means "use the
// static content", which 'deleted' overrides.
export type StoryPageEntry = StoryPageTuning | 'deleted'

export const STORY_PAGE_TUNING: Record<string, StoryPageEntry> = {}

export function storyPageKey(unitId: string, pageIndex: number): string {
  return `${unitId}::${pageIndex}`
}

export function getStoryEntry(unitId: string, pageIndex: number): StoryPageEntry | undefined {
  return STORY_PAGE_TUNING[storyPageKey(unitId, pageIndex)]
}

// For resolving what to actually RENDER — a 'deleted' slot is never meant
// to be rendered (StoryReader only ever visits indices useResolvedPageCount
// says exist), so it's treated the same as "no override" here.
export function getStoryTuning(unitId: string, pageIndex: number): StoryPageTuning | undefined {
  const e = getStoryEntry(unitId, pageIndex)
  return e === 'deleted' ? undefined : e
}

export type PageSlotState = 'tuning' | 'deleted' | 'none'

// `resolve` returns a page's effective tuning (falling back to a fresh
// default when untouched); `slotState` reports this exact index's raw
// state — an explicit tuning override, explicitly deleted, or nothing
// recorded at all. That distinction (not available from `resolve` alone,
// which always returns something renderable) is what page-count
// resolution needs.
export interface StoryTuningLookup {
  resolve(unitId: string, pageIndex: number): StoryPageTuning
  slotState(unitId: string, pageIndex: number): PageSlotState
}

const defaultStoryTuningLookup: StoryTuningLookup = {
  resolve: (unitId, pageIndex) => getStoryTuning(unitId, pageIndex) ?? buildDefaultPageTuning(),
  slotState: (unitId, pageIndex) => {
    const e = getStoryEntry(unitId, pageIndex)
    return e === 'deleted' ? 'deleted' : e !== undefined ? 'tuning' : 'none'
  },
}

export const StorySceneTuningContext = createContext<StoryTuningLookup>(defaultStoryTuningLookup)

export function useStorySceneTuning(unitId: string, pageIndex: number): StoryPageTuning {
  const lookup = useContext(StorySceneTuningContext)
  return lookup.resolve(unitId, pageIndex)
}

// A unit's page count isn't just its static phonicsContent.ts length —
// pages can be appended beyond that via "+ Add scene", or a page (original
// or added) can be removed via "Delete this page" (see StoryLab.tsx).
// Counts contiguously from 0 upward: a slot with an explicit tuning
// override exists, one marked 'deleted' doesn't (even within the static
// content's own range), and one with nothing recorded falls back to
// whether it's within phonicsContent.ts's range.
export function useResolvedPageCount(unit: PhonicsUnit): number {
  const lookup = useContext(StorySceneTuningContext)
  let count = 0
  for (;;) {
    const state = lookup.slotState(unit.id, count)
    const exists = state === 'deleted' ? false : state === 'tuning' ? true : count < unit.storyPages.length
    if (!exists) break
    count++
  }
  return count
}
