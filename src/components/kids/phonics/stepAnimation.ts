import { useEffect, useRef, type RefObject } from 'react'
import type { AnimationStep, TravelStyle } from './storySceneTuning'

// Translates the tuning model's declarative AnimationStep list into real
// Web Animations API calls. WAAPI (not CSS @keyframes) is what makes true
// simultaneous blending possible: multiple concurrent `Animation` objects
// on one element with `composite: 'add'` correctly compose (the browser
// matrix-multiplies their transforms) instead of one clobbering the other
// the way stacked CSS `animation:` entries would. Animation.finished
// promises also give real sequential chaining ("after previous") without
// hand-summed delay math or fragile animationend-by-name matching.

const WIPE_START: Record<string, string> = {
  fromTop: '0% 0% 100% 0%',
  fromBottom: '100% 0% 0% 0%',
  fromLeft: '0% 100% 0% 0%',
  fromRight: '0% 0% 0% 100%',
}

const FLY_FROM: Record<string, { x: string; y: string }> = {
  fromTop: { x: '0', y: '-40px' },
  fromBottom: { x: '0', y: '40px' },
  fromLeft: { x: '-40px', y: '0' },
  fromRight: { x: '40px', y: '0' },
}

// Cycle length for the wobble layered on top of a motion path's travel
// (bob/hop/spin) — not separately exposed as a tuning field, just a fixed
// feel for "in motion" regardless of how long the overall path takes.
const WOBBLE_CYCLE_SEC = 0.35

interface AnimateCall {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
}

function baseOptions(step: AnimationStep, extra: Partial<KeyframeAnimationOptions> = {}): KeyframeAnimationOptions {
  return {
    duration: step.durationSec * 1000,
    easing: step.easing,
    iterations: step.repeat === 'loop' ? Infinity : 1,
    fill: 'forwards',
    ...extra,
  }
}

function travelWobbleKeyframes(style: TravelStyle): Keyframe[] | null {
  switch (style) {
    case 'bob':
      return [
        { transform: 'translateY(0px) rotate(0deg)', offset: 0 },
        { transform: 'translateY(-6px) rotate(-6deg)', offset: 0.25 },
        { transform: 'translateY(0px) rotate(0deg)', offset: 0.5 },
        { transform: 'translateY(-6px) rotate(6deg)', offset: 0.75 },
        { transform: 'translateY(0px) rotate(0deg)', offset: 1 },
      ]
    case 'hop':
      return [
        { transform: 'translateY(0px)', offset: 0 },
        { transform: 'translateY(-14px)', offset: 0.5 },
        { transform: 'translateY(0px)', offset: 1 },
      ]
    case 'spin':
      return [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }]
    case 'plain':
      return null
  }
}

// A step can produce more than one concurrent Animation (a motion path is
// both a position move AND a travel wobble, running together).
export function buildAnimateCalls(step: AnimationStep): AnimateCall[] {
  const e = step.effect
  switch (e.kind) {
    case 'fade':
      return [{ keyframes: [{ opacity: 0 }, { opacity: 1 }], options: baseOptions(step) }]

    case 'pop':
      return [{
        keyframes: [
          { transform: 'scale(0.4)', opacity: 0, offset: 0 },
          { transform: 'scale(1.15)', opacity: 1, offset: 0.5 },
          { transform: 'scale(1)', opacity: 1, offset: 1 },
        ],
        options: baseOptions(step, { composite: 'add' }),
      }]

    case 'bounceIn':
      return [{
        keyframes: [
          { transform: 'scale(0.6)', offset: 0 },
          { transform: 'scale(1.08)', offset: 0.6 },
          { transform: 'scale(1)', offset: 1 },
        ],
        options: baseOptions(step, { composite: 'add' }),
      }]

    case 'wipe':
      return [{
        keyframes: [{ clipPath: `inset(${WIPE_START[e.direction]})` }, { clipPath: 'inset(0% 0% 0% 0%)' }],
        options: baseOptions(step),
      }]

    case 'flyIn': {
      const from = FLY_FROM[e.direction]
      return [{
        keyframes: [
          { transform: `translate(${from.x}, ${from.y})`, opacity: 0 },
          { transform: 'translate(0, 0)', opacity: 1 },
        ],
        options: baseOptions(step, { composite: 'add' }),
      }]
    }

    case 'float':
      return [{
        keyframes: [
          { transform: 'translateY(0px) rotate(-4deg)', offset: 0 },
          { transform: 'translateY(-10px) rotate(4deg)', offset: 0.5 },
          { transform: 'translateY(0px) rotate(-4deg)', offset: 1 },
        ],
        options: baseOptions(step, { composite: 'add' }),
      }]

    case 'wiggle':
      return [{
        keyframes: [
          { transform: 'rotate(0deg)', offset: 0 },
          { transform: 'rotate(-3deg)', offset: 0.25 },
          { transform: 'rotate(3deg)', offset: 0.75 },
          { transform: 'rotate(0deg)', offset: 1 },
        ],
        options: baseOptions(step, { composite: 'add' }),
      }]

    case 'spin':
      return [{
        keyframes: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        options: baseOptions(step, { composite: 'add' }),
      }]

    case 'growShrink':
      return [{
        keyframes: [
          { transform: 'scale(1)', offset: 0 },
          { transform: 'scale(1.2)', offset: 0.5 },
          { transform: 'scale(1)', offset: 1 },
        ],
        options: baseOptions(step, { composite: 'add' }),
      }]

    case 'pulse':
      return [{
        keyframes: [
          { transform: 'scale(1)', opacity: 0.85, offset: 0 },
          { transform: 'scale(1.25)', opacity: 1, offset: 0.5 },
          { transform: 'scale(1)', opacity: 0.85, offset: 1 },
        ],
        options: baseOptions(step, { composite: 'add' }),
      }]

    case 'shake':
      return [{
        keyframes: [
          { transform: 'translateX(0px)', offset: 0 },
          { transform: 'translateX(-7px)', offset: 0.2 },
          { transform: 'translateX(7px)', offset: 0.4 },
          { transform: 'translateX(-5px)', offset: 0.6 },
          { transform: 'translateX(5px)', offset: 0.8 },
          { transform: 'translateX(0px)', offset: 1 },
        ],
        options: baseOptions(step, { composite: 'add' }),
      }]

    case 'motionPath': {
      const midX = (e.startXPct + e.endXPct) / 2
      const midY = (e.startYPct + e.endYPct) / 2
      // `left`/`top` must stay composite:'replace' (the default) — position
      // is an absolute placement, never additive. Only the arc dip's
      // `transform` should blend with any simultaneous emphasis step, so
      // it's split into its OWN Animation with composite:'add'; WAAPI's
      // composite option applies to a whole Animation, not per-property,
      // so position and the dip can't share one el.animate() call without
      // the dip's 'add' also making `left`/`top` wrongly additive.
      const position: AnimateCall = {
        keyframes: [
          { left: `${e.startXPct}%`, top: `${e.startYPct}%`, offset: 0 },
          { left: `${midX}%`, top: `${midY}%`, offset: 0.5 },
          { left: `${e.endXPct}%`, top: `${e.endYPct}%`, offset: 1 },
        ],
        options: baseOptions(step),
      }
      const dip: AnimateCall = {
        keyframes: [
          { transform: 'translateY(0px)', offset: 0 },
          { transform: `translateY(${e.arcHeightPx}px)`, offset: 0.5 },
          { transform: 'translateY(0px)', offset: 1 },
        ],
        options: baseOptions(step, { composite: 'add' }),
      }
      const wobbleKeyframes = travelWobbleKeyframes(e.travelStyle)
      if (!wobbleKeyframes) return [position, dip]
      const iterations = Math.max(1, Math.ceil(step.durationSec / WOBBLE_CYCLE_SEC))
      const wobble: AnimateCall = {
        keyframes: wobbleKeyframes,
        options: { duration: WOBBLE_CYCLE_SEC * 1000, easing: 'ease-in-out', iterations, fill: 'forwards', composite: 'add' },
      }
      return [position, dip, wobble]
    }
  }
}

interface StepTimelineOptions {
  onMotionActiveChange?: (active: boolean) => void
}

// Drives one object's whole animation timeline imperatively. Steps marked
// 'withPrevious' are simply started in the same tick as the step before
// them (their `composite: 'add'` keyframes then blend natively); a step
// marked 'afterPrevious' awaits the prior step's `.finished` promise first
// — real sequencing, not delay arithmetic.
export function useStepTimeline(ref: RefObject<HTMLElement | null>, steps: AnimationStep[], options: StepTimelineOptions = {}) {
  const onMotionActiveChangeRef = useRef(options.onMotionActiveChange)
  onMotionActiveChangeRef.current = options.onMotionActiveChange

  useEffect(() => {
    const el = ref.current
    if (!el || steps.length === 0) return
    let cancelled = false
    const allAnimations: Animation[] = []

    async function run(target: HTMLElement) {
      let previousFinished: Promise<Animation> | null = null
      for (const step of steps) {
        if (cancelled) return
        if (step.startTrigger === 'afterPrevious' && previousFinished) {
          try { await previousFinished } catch { /* cancelled mid-flight */ }
          if (cancelled) return
        }
        const calls = buildAnimateCalls(step)
        const stepAnimations = calls.map(c => target.animate(c.keyframes, c.options))
        allAnimations.push(...stepAnimations)
        if (step.effect.kind === 'motionPath') {
          onMotionActiveChangeRef.current?.(true)
          Promise.all(stepAnimations.map(a => a.finished)).then(() => {
            if (!cancelled) onMotionActiveChangeRef.current?.(false)
          }).catch(() => {})
        }
        previousFinished = stepAnimations[0]?.finished ?? null
      }
    }
    run(el)

    return () => {
      cancelled = true
      allAnimations.forEach(a => a.cancel())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, steps])
}
