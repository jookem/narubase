import type { CSSProperties } from 'react'
import { mascotSvgUrl } from './mascotAssets'
import './mascots.css'

export type MascotPose = 'idle' | 'travel' | 'arrived'

interface MascotProps {
  name: string
  pose?: MascotPose
  size?: number | string
  loop?: boolean
  className?: string
  style?: CSSProperties
  alt?: string
}

// A Phonics Quest mascot, rendered from the hand-drawn SVG set in
// public/mascots/svg/ (idle art + a "_happy" variant for arrived/celebrating).
// Each character's SVG has its own natural aspect ratio, so the wrapper is a
// square box with object-fit: contain rather than a fixed-ratio box — that
// keeps every mascot undistorted instead of stretching it to match one shape.
export function Mascot({ name, pose = 'idle', size = 96, loop = false, className = '', style, alt }: MascotProps) {
  const dim = typeof size === 'number' ? `${size}px` : size
  return (
    <span
      className={`pq-mascot pq-mascot--${pose} ${loop && pose === 'arrived' ? 'pq-loop' : ''} ${className}`}
      style={{ width: dim, height: dim, ...style }}
    >
      <img src={mascotSvgUrl(name, pose === 'arrived')} alt={alt ?? name} draggable={false} />
    </span>
  )
}
