import { useEffect, useMemo, useRef, useState } from 'react'
import { PHONICS_WORLDS, PHONICS_UNITS, type PhonicsUnit } from '@/lib/phonicsContent'
import type { PhonicsProgressRow } from '@/lib/api/phonics'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"

interface Props {
  progress: Record<string, PhonicsProgressRow>
  onSelectUnit: (unit: PhonicsUnit) => void
}

const DECOR_BY_WORLD: Record<number, string[]> = {
  1: ['🌳', '🌿', '🌾', '🌼'],
  2: ['🌲', '🍄', '🪨'],
  3: ['✨', '⭐', '🌙'],
  4: ['🌊', '🐚', '🌴'],
  5: ['⛰️', '🪨', '☁️'],
}

// Wide viewports get a horizontal path (fits on screen without vertical
// scrolling); narrow/mobile viewports keep the original vertical path.
const WIDE_BREAKPOINT = 860

function useIsWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= WIDE_BREAKPOINT)
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= WIDE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return wide
}

// Deterministic pseudo-random so islands/decorations don't reshuffle on re-render.
function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

// Builds a smoothed SVG path 'd' string through a list of points (quadratic
// midpoint smoothing — same technique KidsGame's own letter-stroke guides use,
// just producing an SVG path string instead of driving a canvas context).
function smoothPath(points: [number, number][], closed: boolean): string {
  const n = points.length
  if (n < 2) return ''
  if (closed) {
    const mid0: [number, number] = [(points[n - 1][0] + points[0][0]) / 2, (points[n - 1][1] + points[0][1]) / 2]
    let d = `M ${mid0[0]} ${mid0[1]} `
    for (let i = 0; i < n; i++) {
      const next = points[(i + 1) % n]
      const mid = [(points[i][0] + next[0]) / 2, (points[i][1] + next[1]) / 2]
      d += `Q ${points[i][0]} ${points[i][1]} ${mid[0]} ${mid[1]} `
    }
    return d + 'Z'
  }
  let d = `M ${points[0][0]} ${points[0][1]} `
  for (let i = 1; i < n - 1; i++) {
    const mid = [(points[i][0] + points[i + 1][0]) / 2, (points[i][1] + points[i + 1][1]) / 2]
    d += `Q ${points[i][0]} ${points[i][1]} ${mid[0]} ${mid[1]} `
  }
  d += `L ${points[n - 1][0]} ${points[n - 1][1]}`
  return d
}

const NODE_SPACING_V = 65   // vertical (mobile) spacing between levels
const NODE_SPACING_H = 44   // horizontal (desktop) spacing — tighter so long
                             // worlds still fit on screen without scrolling
const PAD = 46              // top/bottom pad (vertical) or left/right pad (horizontal)
const MAP_HEIGHT_H = 140    // fixed viewBox height when laid out horizontally
const MAP_WIDTH_V = 100     // fixed viewBox width when laid out vertically

function computeLayout(worldId: number, count: number, horizontal: boolean) {
  const rand = seededRandom(worldId * 1000 + 7)
  const amplitude = 14 + rand() * 8
  const frequency = 0.8 + (worldId % 3) * 0.2
  const spacing = horizontal ? NODE_SPACING_H : NODE_SPACING_V
  const positions: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const primary = PAD + i * spacing
    const wiggle = amplitude * Math.sin(i * frequency + worldId)
    if (horizontal) positions.push({ x: primary, y: MAP_HEIGHT_H / 2 + wiggle })
    else positions.push({ x: MAP_WIDTH_V / 2 + wiggle, y: primary })
  }
  const primaryTotal = count > 0 ? PAD * 2 + (count - 1) * spacing : (horizontal ? 320 : 220)
  const width = horizontal ? primaryTotal : MAP_WIDTH_V
  const height = horizontal ? MAP_HEIGHT_H : primaryTotal
  return { positions, width, height }
}

// A point just "before" the first node, extending backwards along the path's
// own tangent — used to place the character before World 1 / Level 1 on a
// brand-new profile, so its first move is visibly walking onto the map.
function startFlagPoint(positions: { x: number; y: number }[], width: number, height: number) {
  if (positions.length === 0) return null
  const p0 = positions[0]
  const p1 = positions[1] ?? { x: p0.x, y: p0.y - 1 }
  const dx = p1.x - p0.x, dy = p1.y - p0.y
  const len = Math.hypot(dx, dy) || 1
  const back = 26
  return { x: clamp(p0.x - (dx / len) * back, 4, width - 4), y: clamp(p0.y - (dy / len) * back, 4, height - 4) }
}

// Follows the node path itself (a jittered-width "river valley" around the
// winding road) rather than an independent ellipse — an ellipse gets
// pointy/spiky at extreme aspect ratios, while a path-following shape looks
// right at any node count/orientation. Margins are offset perpendicular to
// each point's local tangent and caps extend along the tangent at the ends,
// so the same code works whether the route runs vertically or horizontally.
function islandPath(worldId: number, positions: { x: number; y: number }[], width: number, height: number): string {
  if (positions.length === 0) {
    const cx = width / 2, cy = height / 2
    return smoothPath([[cx - 30, cy - 40], [cx + 30, cy - 40], [cx + 30, cy + 40], [cx - 30, cy + 40]], true)
  }
  const rand = seededRandom(worldId * 500 + 3)
  const margin = 28
  const capPad = 24
  const n = positions.length

  function tangentAt(i: number): [number, number] {
    const a = positions[Math.max(0, i - 1)]
    const b = positions[Math.min(n - 1, i + 1)]
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    return [dx / len, dy / len]
  }

  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const [tx, ty] = tangentAt(i)
    const nx = -ty, ny = tx
    const m = margin * (0.85 + rand() * 0.3)
    left.push([positions[i].x + nx * m, positions[i].y + ny * m])
    right.push([positions[i].x - nx * m, positions[i].y - ny * m])
  }
  const [t0x, t0y] = tangentAt(0)
  const topCap: [number, number] = [
    clamp(positions[0].x - t0x * capPad, 4, width - 4),
    clamp(positions[0].y - t0y * capPad, 4, height - 4),
  ]
  const [tnx, tny] = tangentAt(n - 1)
  const bottomCap: [number, number] = [
    clamp(positions[n - 1].x + tnx * capPad, 4, width - 4),
    clamp(positions[n - 1].y + tny * capPad, 4, height - 4),
  ]
  const pts = [topCap, ...left, bottomCap, ...[...right].reverse()]
  return smoothPath(pts, true)
}

function decorations(worldId: number, positions: { x: number; y: number }[], width: number, height: number, spacing: number, horizontal: boolean) {
  const rand = seededRandom(worldId * 250 + 11)
  const emojis = DECOR_BY_WORLD[worldId] ?? ['🌿']
  const items: { x: number; y: number; emoji: string }[] = []
  if (positions.length === 0) return items
  const count = Math.min(16, Math.max(6, positions.length))
  const alongJitter = spacing / 2 - 8
  const acrossJitter = 20
  let attempts = 0
  while (items.length < count && attempts < count * 8) {
    attempts++
    const anchor = positions[Math.floor(rand() * positions.length)]
    const x = anchor.x + (rand() * 2 - 1) * (horizontal ? alongJitter : acrossJitter)
    const y = anchor.y + (rand() * 2 - 1) * (horizontal ? acrossJitter : alongJitter)
    if (x < 4 || x > width - 4 || y < 4 || y > height - 4) continue
    if (positions.some(p => Math.hypot(p.x - x, p.y - y) < 18)) continue
    items.push({ x, y, emoji: emojis[Math.floor(rand() * emojis.length)] })
  }
  return items
}

export function WorldMap({ progress, onSelectUnit }: Props) {
  const [activeWorld, setActiveWorld] = useState(1)
  const isWide = useIsWide()

  const unitsByWorld = useMemo(() => {
    const map = new Map<number, PhonicsUnit[]>()
    for (const w of PHONICS_WORLDS) map.set(w.id, [])
    for (const u of PHONICS_UNITS) map.get(u.world)?.push(u)
    for (const list of map.values()) list.sort((a, b) => a.indexInWorld - b.indexInWorld)
    return map
  }, [])

  const worldCompleted = (worldId: number) => {
    const list = unitsByWorld.get(worldId) ?? []
    return list.length > 0 && list.every(u => (progress[u.id]?.stars ?? 0) > 0)
  }
  const worldUnlocked = (worldId: number) => worldId === 1 || worldCompleted(worldId - 1)

  const world = PHONICS_WORLDS.find(w => w.id === activeWorld)!
  const units = unitsByWorld.get(activeWorld) ?? []
  const { positions, width, height } = useMemo(() => computeLayout(activeWorld, units.length, isWide), [activeWorld, units.length, isWide])
  const island = useMemo(() => islandPath(activeWorld, positions, width, height), [activeWorld, positions, width, height])
  const road = useMemo(() => smoothPath(positions.map(p => [p.x, p.y] as [number, number]), false), [positions])
  const decor = useMemo(
    () => decorations(activeWorld, positions, width, height, isWide ? NODE_SPACING_H : NODE_SPACING_V, isWide),
    [activeWorld, positions, width, height, isWide],
  )
  // Decorative strokes/text are sized in SVG units calibrated against the
  // original fixed vertical viewBox width (100). The horizontal layout's
  // fixed dimension is height (140) instead of a fixed width, so scale
  // against whichever axis is fixed for the current orientation — otherwise
  // decorations would shrink as a world's level count (and thus the growing
  // horizontal viewBox width) grows.
  const decorScale = isWide ? MAP_HEIGHT_H / MAP_WIDTH_V : 1

  const furthestIdx = units.findIndex(u => !progress[u.id]?.completed_at)
  const currentIdx = furthestIdx === -1 ? units.length - 1 : furthestIdx
  const targetNode = positions[currentIdx] ?? null

  const noProgressAtAll = Object.keys(progress).length === 0
  const isFreshStart = activeWorld === 1 && currentIdx === 0 && noProgressAtAll

  // Character position is tracked in local state (rather than derived
  // directly) so a brand-new profile can visibly start just before Level 1
  // and walk onto the map, and so completing a level / unlocking a new world
  // slides the character to its next spot instead of teleporting there.
  const [charPos, setCharPos] = useState<{ x: number; y: number } | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!targetNode) return
    if (!mountedRef.current) {
      mountedRef.current = true
      if (isFreshStart) {
        const flag = startFlagPoint(positions, width, height)
        if (flag) {
          setCharPos(flag)
          const t = setTimeout(() => setCharPos(targetNode), 450)
          return () => clearTimeout(t)
        }
      }
      setCharPos(targetNode)
      return
    }
    setCharPos(targetNode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetNode?.x, targetNode?.y, activeWorld])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, width: '100%', maxWidth: isWide ? 1100 : 480, margin: '0 auto' }}>
      {/* World switcher */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 2px' }}>
        {PHONICS_WORLDS.map(w => {
          const unlocked = worldUnlocked(w.id)
          const active = w.id === activeWorld
          return (
            <button key={w.id}
              onClick={() => unlocked && setActiveWorld(w.id)}
              disabled={!unlocked}
              style={{
                flexShrink: 0, border: 'none', cursor: unlocked ? 'pointer' : 'not-allowed', textAlign: 'center',
                fontFamily: FONT, fontWeight: 800, fontSize: 13, padding: '10px 16px', borderRadius: 18,
                background: active ? w.color : '#FFFFFF',
                color: active ? '#fff' : unlocked ? '#6B4F3F' : '#C7A892',
                boxShadow: active ? '0 4px 0 rgba(0,0,0,.15)' : '0 3px 0 #EEDAC6',
                opacity: unlocked ? 1 : 0.7,
              }}>
              {unlocked ? '' : '🔒 '}{w.name}
              <div style={{ fontSize: 10, fontWeight: 600, opacity: .85, marginTop: 2 }}>{w.nameJa}</div>
            </button>
          )
        })}
      </div>

      {/* Island map */}
      <div style={{ position: 'relative', width: '100%', background: '#BFE3F5', borderRadius: 24, overflow: 'hidden', boxShadow: '0 8px 0 #A9CFE0' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }} preserveAspectRatio="xMidYMin meet">
          <path d={island} fill={world.color} opacity={0.35} />
          <path d={island} fill="none" stroke={world.color} strokeWidth={1 * decorScale} opacity={0.5} />
          {road && <path d={road} fill="none" stroke="#FFF6E5" strokeWidth={5 * decorScale} strokeLinecap="round" opacity={0.9} />}
          {road && <path d={road} fill="none" stroke="#E9D2AE" strokeWidth={5 * decorScale} strokeLinecap="round" strokeDasharray={`0.1 ${6 * decorScale}`} opacity={0.6} />}
          {decor.map((d, i) => (
            <text key={i} x={d.x} y={d.y} fontSize={5 * decorScale} textAnchor="middle" opacity={0.8}>{d.emoji}</text>
          ))}
        </svg>

        {units.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 40 }}>🚧</div>
            <div style={{ fontWeight: 800, color: '#6B4F3F' }}>More levels coming soon!</div>
          </div>
        ) : units.map((u, i) => {
          const p = positions[i]
          const row = progress[u.id]
          const stars = row?.stars ?? 0
          const isLast = i === units.length - 1
          const locked = i > 0 && !progress[units[i - 1].id]?.completed_at

          return (
            <div key={u.id} style={{ position: 'absolute', left: `${(p.x / width) * 100}%`, top: `${(p.y / height) * 100}%`, transform: 'translate(-50%,-50%)' }}>
              <button
                onClick={() => !locked && onSelectUnit(u)}
                disabled={locked}
                style={{
                  border: 'none', cursor: locked ? 'not-allowed' : 'pointer',
                  width: isLast ? 60 : 50, height: isLast ? 60 : 50,
                  borderRadius: '50%', fontFamily: FONT, fontWeight: 800, fontSize: isLast ? 26 : 18,
                  background: locked ? '#D9CBBB' : row?.completed_at ? world.color : '#FFFFFF',
                  color: locked ? '#B79A86' : row?.completed_at ? '#fff' : '#6B4F3F',
                  boxShadow: locked ? '0 4px 0 #C7B7A3' : '0 4px 0 rgba(0,0,0,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {locked ? '🔒' : isLast ? '🏰' : i + 1}
              </button>
              {!locked && stars > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 2, fontSize: 11, fontWeight: 800, color: '#E0A52E', whiteSpace: 'nowrap' }}>
                  {'⭐'.repeat(stars)}
                </div>
              )}
            </div>
          )
        })}

        {/* Character — a single persistent element (not re-mounted per node)
            so left/top changes transition smoothly: walking onto the map on
            a fresh start, sliding to the next level on progress, and sliding
            to Level 1 of the next island when a world unlocks. */}
        {charPos && (
          <div
            style={{
              position: 'absolute', left: `${(charPos.x / width) * 100}%`, top: `${(charPos.y / height) * 100}%`,
              transform: 'translate(-50%, -140%)', transition: 'left .5s ease, top .5s ease', pointerEvents: 'none',
            }}>
            <div style={{ fontSize: 22, animation: 'kg-floaty 2s ease-in-out infinite' }}>🧒</div>
          </div>
        )}
      </div>
    </div>
  )
}
