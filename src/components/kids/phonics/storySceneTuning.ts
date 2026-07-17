import { createContext, useContext } from 'react'

// Knobs for StoryReader's scene visuals/animation, modeled on the original
// PowerPoint source ("Beginner Phonics All Make A Word and Stories.pptx"):
// its story slides almost never use elaborate entrances (142/194 animated
// slides use plain instant "Appear"), fade out between beats, and move
// characters along hand-drawn curved motion paths rather than straight
// lines.
//
// Every page of every unit gets its OWN independent StorySceneTuning —
// editing page 3 never touches page 1. A page only takes up space in
// STORY_PAGE_TUNING once it's been specifically customized; anything not
// in there falls back to DEFAULT_STORY_SCENE_TUNING untouched, which is
// why brand-new units/pages all look identical until someone tunes them.
// Production reads through getStoryTuning() (the context's default lookup,
// no Provider needed) — only StoryLab.tsx (Materials page, "Phonics Story
// Lab" tab) mounts a Provider backed by its own in-session edits so every
// scene can be tweaked and previewed live without touching code.

// Mirrors PowerPoint's animation pane: an effect (Fade, Wipe, Fly In, ...)
// plus, for the effects where it means anything, an independent Direction
// (From Top/Bottom/Left/Right) — instead of baking direction into the
// effect name (the old 'wipeDown'/'wipeRight' pair).
export type EntranceEffect = 'none' | 'fade' | 'wipe' | 'flyIn' | 'pop' | 'bounceIn'
export type Direction = 'fromTop' | 'fromBottom' | 'fromLeft' | 'fromRight'
export type EmphasisEffect = 'none' | 'float' | 'wiggle' | 'spin' | 'growShrink' | 'pulse' | 'shake'
export type TravelStyle = 'bob' | 'hop' | 'spin' | 'plain'
export type Easing = 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear'

// Which effects actually use `direction` — shown/enabled in the Lab only for these.
export const DIRECTIONAL_EFFECTS: EntranceEffect[] = ['wipe', 'flyIn']

// 'none' is labeled "Appear (instant)" — that IS the PPT's default entrance
// (an instant visibility flip, no transition), so there's no separate value
// needed for it.
export const ENTRANCE_LABELS: Record<EntranceEffect, string> = {
  none: 'Appear (instant)',
  fade: 'Fade In',
  wipe: 'Wipe',
  flyIn: 'Fly In',
  pop: 'Pop In',
  bounceIn: 'Bounce In',
}

export const DIRECTION_LABELS: Record<Direction, string> = {
  fromTop: 'From Top',
  fromBottom: 'From Bottom',
  fromLeft: 'From Left',
  fromRight: 'From Right',
}

export const EMPHASIS_LABELS: Record<EmphasisEffect, string> = {
  none: 'None (still)',
  float: 'Float',
  wiggle: 'Wiggle',
  spin: 'Spin',
  growShrink: 'Grow / Shrink',
  pulse: 'Pulse',
  shake: 'Shake',
}

export const TRAVEL_STYLE_LABELS: Record<TravelStyle, string> = {
  bob: 'Run (bob + wobble)',
  hop: 'Hop',
  spin: 'Spin',
  plain: 'Plain (no wobble)',
}

export const EASING_LABELS: Record<Easing, string> = {
  ease: 'Ease',
  'ease-in': 'Ease In',
  'ease-out': 'Ease Out',
  'ease-in-out': 'Ease In-Out',
  linear: 'Linear',
}

const ENTRANCE_KEYFRAME: Record<Exclude<EntranceEffect, 'none'>, string> = {
  fade: 'kg-fadeIn',
  wipe: 'kg-wipeIn',
  flyIn: 'kg-flyIn',
  pop: 'kg-pop',
  bounceIn: 'kg-bounceIn',
}

// clip-path inset(top right bottom left) to clip from, at 0% — animates
// toward inset(0 0 0 0) so the reveal appears to travel from that edge.
const WIPE_START: Record<Direction, string> = {
  fromTop: '0 0 100% 0',
  fromBottom: '100% 0 0 0',
  fromLeft: '0 100% 0 0',
  fromRight: '0 0 0 100%',
}

// translate() offset to fly in from, at 0% — animates toward translate(0,0).
const FLY_FROM: Record<Direction, { x: string; y: string }> = {
  fromTop: { x: '0', y: '-40px' },
  fromBottom: { x: '0', y: '40px' },
  fromLeft: { x: '-40px', y: '0' },
  fromRight: { x: '40px', y: '0' },
}

const EMPHASIS_KEYFRAME: Record<Exclude<EmphasisEffect, 'none'>, string> = {
  float: 'kg-floaty',
  wiggle: 'kg-wiggle',
  spin: 'kg-spin',
  growShrink: 'kg-growShrink',
  pulse: 'kg-twinkle',
  shake: 'kg-shake',
}

const TRAVEL_KEYFRAME: Record<Exclude<TravelStyle, 'plain'>, string> = {
  bob: 'kg-storyRun',
  hop: 'kg-hop',
  spin: 'kg-spin',
}

export interface EntranceConfig {
  effect: EntranceEffect
  direction: Direction
  durationSec: number
  delaySec: number
  easing: Easing
}

export interface EmphasisConfig {
  effect: EmphasisEffect
  durationSec: number
  easing: Easing
}

export interface EntranceEmphasisConfig extends EntranceConfig {
  emphasis: EmphasisEffect
  emphasisDurationSec: number
}

// A start position -> end position journey, like the mascot's existing
// kg-arcMove travel but generalized to 2D (mascot only ever moves along
// its fixed ground line, so it only needed a start/end X — a prop or the
// destination target can enter from anywhere and settle anywhere). `null`
// on the owning object means "static at its resting spot", no motion.
export interface MotionPath {
  startXPct: number
  startYPct: number
  endXPct: number
  endYPct: number
  durationSec: number
  delaySec: number
  easing: Easing
  arcHeightPx: number   // dip/rise at the path's midpoint; 0 = straight line
  travelStyle: TravelStyle  // wobble overlay while moving, reuses the mascot's styles
  travelDurationSec: number
}

export const DEFAULT_MOTION_PATH: MotionPath = {
  startXPct: 0, startYPct: 40, endXPct: 50, endYPct: 40,
  durationSec: 0.8, delaySec: 0, easing: 'ease-in-out',
  arcHeightPx: -40, travelStyle: 'bob', travelDurationSec: 0.35,
}

// One ambient prop's own resting position + stacking order, independent of
// any other prop on the same page. A page can mention more than one word
// with an emoji (e.g. "The can is in the pan" -> can + pan both shown at
// once), and each needs to be placeable on its own — a single shared
// top/left/z-index doesn't let you separate them. Indexed by the order
// props appear in the sentence (1st match -> slot 0, 2nd -> slot 1, ...);
// a page with more props than configured slots reuses the last slot.
// `motion` set means the prop slides in along that path instead of
// appearing in place at (xPct, yPct) — (xPct, yPct) is then unused.
export interface PropSlot {
  xPct: number
  yPct: number
  zIndex: number
  motion: MotionPath | null
}

export interface StorySceneTuning {
  sceneMaxWidth: number
  sceneHeight: number
  mascotStartLeftPct: number
  mascotArrivedLeftPct: number
  targetRightPct: number
  mascotBottom: number
  targetBottom: number
  mascotFontSize: number
  targetFontSize: number
  othersFontSize: number
  mascotZIndex: number
  targetZIndex: number
  bgTop: string
  bgMid: string
  bgBottom: string
  groundColor: string

  // Mascot travel: a single curved-path keyframe (kg-arcMove) carries the
  // mascot from its start to arrived position, dipping/rising by
  // arcHeightPx at the midpoint — mirroring the source deck's hand-drawn
  // bezier motion paths instead of a straight `left` transition. 0 collapses
  // it back to a straight line.
  transitionDurationSec: number
  motionEasing: Easing
  arcHeightPx: number
  travelStyle: TravelStyle
  travelDurationSec: number
  motionSoundEnabled: boolean

  mascotIdle: EmphasisConfig

  props: EntranceEmphasisConfig
  propsEntranceStaggerSec: number
  propsEmphasisStaggerSec: number
  propSlots: PropSlot[]

  target: EntranceEmphasisConfig
  targetMotion: MotionPath | null

  sentence: EntranceConfig
}

export const DEFAULT_STORY_SCENE_TUNING: StorySceneTuning = {
  sceneMaxWidth: 480,
  sceneHeight: 170,
  mascotStartLeftPct: 8,
  mascotArrivedLeftPct: 68,
  targetRightPct: 4,
  mascotBottom: 16,
  targetBottom: 22,
  mascotFontSize: 84,
  targetFontSize: 56,
  othersFontSize: 40,
  mascotZIndex: 2,
  targetZIndex: 1,
  bgTop: '#FFF9F1',
  bgMid: '#FBF0E4',
  bgBottom: '#F3E3D0',
  groundColor: '#EAD9C4',

  transitionDurationSec: 1.05,
  motionEasing: 'ease-in-out',
  arcHeightPx: -56,
  travelStyle: 'bob',
  travelDurationSec: 0.35,
  motionSoundEnabled: true,

  mascotIdle: { effect: 'float', durationSec: 2.4, easing: 'ease-in-out' },

  props: { effect: 'pop', direction: 'fromBottom', durationSec: 0.4, delaySec: 0, easing: 'ease-out', emphasis: 'float', emphasisDurationSec: 2.6 },
  propsEntranceStaggerSec: 0.06,
  propsEmphasisStaggerSec: 0.25,
  propSlots: [
    { xPct: 10, yPct: 8, zIndex: 1, motion: null },
    { xPct: 38, yPct: 8, zIndex: 1, motion: null },
    { xPct: 66, yPct: 8, zIndex: 1, motion: null },
  ],

  target: { effect: 'pop', direction: 'fromBottom', durationSec: 0.4, delaySec: 0, easing: 'ease-out', emphasis: 'pulse', emphasisDurationSec: 1.8 },
  targetMotion: null,

  sentence: { effect: 'pop', direction: 'fromBottom', durationSec: 0.35, delaySec: 0, easing: 'ease-out' },
}

// Per-page overrides, keyed by storyPageKey(unitId, pageIndex). Populate by
// pasting the Story Lab's "Copy values" output in here. A page absent from
// this map renders with DEFAULT_STORY_SCENE_TUNING exactly as before.
export const STORY_PAGE_TUNING: Record<string, StorySceneTuning> = {}

export function storyPageKey(unitId: string, pageIndex: number): string {
  return `${unitId}::${pageIndex}`
}

export function getStoryTuning(unitId: string, pageIndex: number): StorySceneTuning {
  return STORY_PAGE_TUNING[storyPageKey(unitId, pageIndex)] ?? DEFAULT_STORY_SCENE_TUNING
}

export type StoryTuningLookup = (unitId: string, pageIndex: number) => StorySceneTuning

export const StorySceneTuningContext = createContext<StoryTuningLookup>(getStoryTuning)

export function useStorySceneTuning(unitId: string, pageIndex: number): StorySceneTuning {
  const lookup = useContext(StorySceneTuningContext)
  return lookup(unitId, pageIndex)
}

export function entranceCss(cfg: EntranceConfig, extraDelaySec = 0): string | undefined {
  if (cfg.effect === 'none') return undefined
  return `${ENTRANCE_KEYFRAME[cfg.effect]} ${cfg.durationSec}s ${cfg.easing} ${(cfg.delaySec + extraDelaySec).toFixed(3)}s backwards`
}

// CSS custom properties consumed by the kg-wipeIn/kg-flyIn keyframes to
// steer which edge the entrance travels from — spread into the element's
// inline style alongside `animation: entranceCss(cfg)`. Harmless to include
// for non-directional effects (fade/pop/bounceIn just never reference them).
export function entranceVars(direction: Direction): Record<string, string> {
  const fly = FLY_FROM[direction]
  return {
    '--wipe-start': WIPE_START[direction],
    '--fly-x': fly.x,
    '--fly-y': fly.y,
  }
}

export function emphasisCss(effect: EmphasisEffect, durationSec: number, easing: Easing, delaySec = 0, keyframeOverride?: string): string | undefined {
  if (effect === 'none') return undefined
  return `${keyframeOverride ?? EMPHASIS_KEYFRAME[effect]} ${durationSec}s ${easing} ${delaySec.toFixed(3)}s infinite`
}

export function travelCss(style: TravelStyle, durationSec: number): string | undefined {
  if (style === 'plain') return undefined
  return `${TRAVEL_KEYFRAME[style]} ${durationSec}s ease-in-out infinite`
}

// Same wobble as travelCss, but bounded to run out over totalDurationSec
// instead of forever — for props/target motion paths, which (unlike the
// mascot) don't track a moving/arrived phase in React state to swap the
// animation off once travel finishes.
export function travelCssBounded(style: TravelStyle, cycleDurationSec: number, totalDurationSec: number, delaySec = 0): string | undefined {
  if (style === 'plain') return undefined
  const iterations = Math.max(1, Math.ceil(totalDurationSec / cycleDurationSec))
  return `${TRAVEL_KEYFRAME[style]} ${cycleDurationSec}s ease-in-out ${delaySec.toFixed(3)}s ${iterations}`
}

export function combineAnimations(...parts: (string | undefined)[]): string | undefined {
  const filtered = parts.filter((p): p is string => !!p)
  return filtered.length ? filtered.join(', ') : undefined
}

// Slot for the i-th prop shown on a page — reuses the last configured
// slot if a page mentions more props than there are slots for.
export function propSlotFor(slots: PropSlot[], i: number): PropSlot {
  return slots[Math.min(i, slots.length - 1)]
}

// CSS custom properties consumed by the kg-motion2D keyframe (see
// KidsGame.tsx) — the generic start->end path used by props/target,
// analogous to the mascot's --arc-* vars but varying both axes.
export function motionVars(m: MotionPath): Record<string, string> {
  return {
    '--m-start-x': `${m.startXPct}%`,
    '--m-start-y': `${m.startYPct}%`,
    '--m-mid-x': `${(m.startXPct + m.endXPct) / 2}%`,
    '--m-mid-y': `${(m.startYPct + m.endYPct) / 2}%`,
    '--m-end-x': `${m.endXPct}%`,
    '--m-end-y': `${m.endYPct}%`,
    '--m-arc': `${m.arcHeightPx}px`,
  }
}

export function motionCss(m: MotionPath, extraDelaySec = 0): string {
  return `kg-motion2D ${m.durationSec}s ${m.easing} ${(m.delaySec + extraDelaySec).toFixed(3)}s forwards`
}
