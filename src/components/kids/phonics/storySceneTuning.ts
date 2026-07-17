import { createContext, useContext } from 'react'

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

export type StepEffect =
  | { kind: 'fade' | 'pop' | 'bounceIn' }
  | { kind: 'wipe' | 'flyIn'; direction: Direction }
  | { kind: 'float' | 'wiggle' | 'spin' | 'growShrink' | 'pulse' | 'shake' }
  | { kind: 'motionPath'; startXPct: number; startYPct: number; endXPct: number; endYPct: number; arcHeightPx: number; travelStyle: TravelStyle }
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

// One scene object's own resting position + stacking order + its animation
// timeline. `id` is stable per page ('mascot', 'prop-0'.., 'sentence') so
// edits keep applying to the same object across re-renders.
export interface SceneObjectTuning {
  id: string
  xPct: number
  yPct: number
  zIndex: number
  fontSize: number
  steps: AnimationStep[]
}

export interface StoryPageTuning {
  sceneMaxWidth: number
  sceneHeight: number
  bgTop: string
  bgMid: string
  bgBottom: string
  groundColor: string
  mascot: SceneObjectTuning
  props: SceneObjectTuning[]   // sized to however many matched words THIS page has
  sentence: SceneObjectTuning  // position fields unused — laid out by its own card
  motionSoundEnabled: boolean
}

export function defaultStepEffect(kind: EffectKind): StepEffect {
  switch (kind) {
    case 'wipe':
    case 'flyIn':
      return { kind, direction: 'fromBottom' }
    case 'motionPath':
      return { kind: 'motionPath', startXPct: 10, startYPct: 40, endXPct: 50, endYPct: 40, arcHeightPx: -40, travelStyle: 'bob' }
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

// The starting point for a page nobody has customized yet: mascot idles in
// place (no motion path — it only ever moves once someone gives it one),
// props pop in and float gently, sentence just pops in. Sized to however
// many props this specific page actually has. Memoized by propCount so
// repeated calls return the SAME object/array references — StoryReader's
// WAAPI effect depends on step-list identity to know when to restart, and
// without this every render of an unedited page would look like a change.
const defaultPageTuningCache = new Map<number, StoryPageTuning>()
export function buildDefaultPageTuning(propCount: number): StoryPageTuning {
  const cached = defaultPageTuningCache.get(propCount)
  if (cached) return cached
  const built = buildFreshDefaultPageTuning(propCount)
  defaultPageTuningCache.set(propCount, built)
  return built
}

function buildFreshDefaultPageTuning(propCount: number): StoryPageTuning {
  return {
    sceneMaxWidth: 480,
    sceneHeight: 170,
    bgTop: '#FFF9F1',
    bgMid: '#FBF0E4',
    bgBottom: '#F3E3D0',
    groundColor: '#EAD9C4',
    motionSoundEnabled: true,
    mascot: {
      id: 'mascot', xPct: 40, yPct: 41, zIndex: 2, fontSize: 84,
      steps: [createStep('float', { durationSec: 2.4, easing: 'ease-in-out', repeat: 'loop' })],
    },
    props: Array.from({ length: propCount }, (_, i) => ({
      id: `prop-${i}`,
      xPct: 10 + i * 28, yPct: 8, zIndex: 1, fontSize: 40,
      steps: [
        createStep('pop', { durationSec: 0.4, delaySec: i * 0.06 }),
        createStep('float', { durationSec: 2.6, delaySec: i * 0.25, easing: 'ease-in-out', repeat: 'loop' }),
      ],
    })),
    sentence: {
      id: 'sentence', xPct: 0, yPct: 0, zIndex: 0, fontSize: 24,
      steps: [createStep('pop', { durationSec: 0.35 })],
    },
  }
}

// Per-page overrides, keyed by storyPageKey(unitId, pageIndex). Populate by
// pasting the Story Lab's "Copy this page" output in here. A page absent
// from this map renders via buildDefaultPageTuning() exactly as before.
export const STORY_PAGE_TUNING: Record<string, StoryPageTuning> = {}

export function storyPageKey(unitId: string, pageIndex: number): string {
  return `${unitId}::${pageIndex}`
}

export function getStoryTuning(unitId: string, pageIndex: number): StoryPageTuning | undefined {
  return STORY_PAGE_TUNING[storyPageKey(unitId, pageIndex)]
}

export type StoryTuningLookup = (unitId: string, pageIndex: number, propCount: number) => StoryPageTuning

function defaultLookup(unitId: string, pageIndex: number, propCount: number): StoryPageTuning {
  return getStoryTuning(unitId, pageIndex) ?? buildDefaultPageTuning(propCount)
}

export const StorySceneTuningContext = createContext<StoryTuningLookup>(defaultLookup)

export function useStorySceneTuning(unitId: string, pageIndex: number, propCount: number): StoryPageTuning {
  const lookup = useContext(StorySceneTuningContext)
  return lookup(unitId, pageIndex, propCount)
}
