/**
 * SM-2-inspired spaced repetition with per-card ease factors and true interval growth.
 *
 * Each card stores:
 *   interval_days  — current interval in days (null = new/never graduated)
 *   ease_factor    — per-card multiplier, default 2.5, range 1.3–5.0
 *   mastery_level  — display tier derived from interval (0 New, 1 Learning, 2 Familiar, 3 Mastered)
 *   next_review    — date string (yyyy-MM-dd)
 */

export type SRSRating = 'again' | 'hard' | 'good' | 'easy'

export interface SRSResult {
  intervalDays: number
  easeFactor: number
  masteryLevel: 0 | 1 | 2 | 3
  nextReview: string // yyyy-MM-dd
}

const INITIAL_EASE = 2.5
const MIN_EASE = 1.3
const MAX_EASE = 5.0

// Seed intervals used only to bootstrap cards reviewed under the old fixed-step system.
// Cards with interval_days=null but mastery_level>0 get this as their starting point.
const LEGACY_SEED: Record<number, number> = { 1: 3, 2: 7, 3: 14 }

function masteryFromInterval(days: number, rating: SRSRating): 0 | 1 | 2 | 3 {
  if (rating === 'again') return 0
  if (days >= 21) return 3
  if (days >= 7) return 2
  return 1
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function computeSRS(
  intervalDays: number | null,
  masteryLevel: number,
  easeFactor: number | null,
  rating: SRSRating,
): SRSResult {
  const ease = easeFactor ?? INITIAL_EASE

  // For cards rated before this system existed: seed the interval from their stored mastery level
  const current: number | null = intervalDays ?? (masteryLevel > 0 ? (LEGACY_SEED[masteryLevel] ?? null) : null)

  let days: number
  let newEase = ease

  if (current === null) {
    // New card — learning phase, no interval history
    switch (rating) {
      case 'again': days = 1;  break
      case 'hard':  days = 1;  break
      case 'good':  days = 1;  break
      case 'easy':  days = 4;  break
    }
  } else {
    // Review phase — grow the interval using ease factor
    switch (rating) {
      case 'again':
        days = 1
        newEase = Math.max(MIN_EASE, ease - 0.2)
        break
      case 'hard':
        // Grows slightly, ease factor drops
        days = Math.max(current + 1, Math.round(current * 1.2))
        newEase = Math.max(MIN_EASE, ease - 0.15)
        break
      case 'good':
        // Standard SM-2 growth
        days = Math.max(current + 1, Math.round(current * ease))
        break
      case 'easy':
        // Accelerated growth + ease reward
        days = Math.max(current + 1, Math.round(current * ease * 1.3))
        newEase = Math.min(MAX_EASE, ease + 0.15)
        break
    }
  }

  newEase = Math.max(MIN_EASE, Math.min(MAX_EASE, newEase))
  days = Math.max(1, days)

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + days)

  return {
    intervalDays: days,
    easeFactor: Math.round(newEase * 1000) / 1000,
    masteryLevel: masteryFromInterval(days, rating),
    nextReview: toDateString(nextDate),
  }
}
