import { createContext, useContext } from 'react'

// Knobs for StoryReader's scene visuals/animation. Production always gets
// DEFAULT_STORY_SCENE_TUNING (the context's default value, no Provider
// needed) — only StoryLab.tsx (dev-only) mounts a Provider with live values
// so every scene can be tweaked and previewed without editing code.
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
  transitionDurationSec: number
  runCycleDurationSec: number
  floatyDurationSec: number
  twinkleDurationSec: number
  bgTop: string
  bgMid: string
  bgBottom: string
  groundColor: string
}

export const DEFAULT_STORY_SCENE_TUNING: StorySceneTuning = {
  sceneMaxWidth: 380,
  sceneHeight: 128,
  mascotStartLeftPct: 6,
  mascotArrivedLeftPct: 70,
  targetRightPct: 4,
  mascotBottom: 12,
  targetBottom: 18,
  mascotFontSize: 66,
  targetFontSize: 44,
  othersFontSize: 32,
  transitionDurationSec: 1.05,
  runCycleDurationSec: 0.35,
  floatyDurationSec: 2.4,
  twinkleDurationSec: 1.8,
  bgTop: '#FFF9F1',
  bgMid: '#FBF0E4',
  bgBottom: '#F3E3D0',
  groundColor: '#EAD9C4',
}

export const StorySceneTuningContext = createContext<StorySceneTuning>(DEFAULT_STORY_SCENE_TUNING)

export function useStorySceneTuning(): StorySceneTuning {
  return useContext(StorySceneTuningContext)
}
