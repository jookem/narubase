import { useMemo, useState } from 'react'
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

// Deterministic pseudo-random so islands/decorations don't reshuffle on re-render.
function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
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

const NODE_SPACING = 65
const TOP_PAD = 50
const BOTTOM_PAD = 50
const WIDTH = 100

function computeLayout(worldId: number, count: number) {
  const rand = seededRandom(worldId * 1000 + 7)
  const amplitude = 18 + rand() * 10
  const frequency = 0.8 + (worldId % 3) * 0.2
  const positions: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const y = TOP_PAD + i * NODE_SPACING
    const x = WIDTH / 2 + amplitude * Math.sin(i * frequency + worldId)
    positions.push({ x, y })
  }
  const height = count > 0 ? TOP_PAD + (count - 1) * NODE_SPACING + BOTTOM_PAD : 220
  return { positions, height }
}

// Follows the node path itself (a jittered-width "river valley" around the
// winding road) rather than an independent ellipse — an ellipse gets
// pointy/spiky at extreme aspect ratios (e.g. 9 nodes in a tall, narrow
// world), while a path-following shape looks right at any node count and
// guarantees every node sits comfortably inside the island.
function islandPath(worldId: number, positions: { x: number; y: number }[], height: number): string {
  if (positions.length === 0) {
    // No units yet — just a simple centered blob so the world isn't empty.
    const cx = WIDTH / 2, cy = height / 2
    return smoothPath([[cx - 30, cy - 40], [cx + 30, cy - 40], [cx + 30, cy + 40], [cx - 30, cy + 40]], true)
  }
  const rand = seededRandom(worldId * 500 + 3)
  const margin = 30
  const capPad = 26
  const left: [number, number][] = positions.map(p => [p.x - margin * (0.85 + rand() * 0.3), p.y])
  const right: [number, number][] = positions.map(p => [p.x + margin * (0.85 + rand() * 0.3), p.y])
  const topCap: [number, number] = [positions[0].x, Math.max(4, positions[0].y - capPad)]
  const bottomCap: [number, number] = [positions[positions.length - 1].x, Math.min(height - 4, positions[positions.length - 1].y + capPad)]
  const pts = [topCap, ...left, bottomCap, ...[...right].reverse()]
  return smoothPath(pts, true)
}

function decorations(worldId: number, positions: { x: number; y: number }[], height: number) {
  const rand = seededRandom(worldId * 250 + 11)
  const emojis = DECOR_BY_WORLD[worldId] ?? ['🌿']
  const items: { x: number; y: number; emoji: string }[] = []
  if (positions.length === 0) return items
  const count = Math.min(16, Math.max(6, positions.length))
  let attempts = 0
  while (items.length < count && attempts < count * 8) {
    attempts++
    // Scatter near a random point along the path, offset sideways within
    // the island's actual footprint (not the full bounding box, most of
    // which is water for a narrow winding island).
    const anchor = positions[Math.floor(rand() * positions.length)]
    const x = anchor.x + (rand() * 2 - 1) * 24
    const y = anchor.y + (rand() * 2 - 1) * (NODE_SPACING / 2 - 10)
    if (x < 4 || x > WIDTH - 4 || y < 4 || y > height - 4) continue
    if (positions.some(p => Math.hypot(p.x - x, p.y - y) < 20)) continue
    items.push({ x, y, emoji: emojis[Math.floor(rand() * emojis.length)] })
  }
  return items
}

export function WorldMap({ progress, onSelectUnit }: Props) {
  const [activeWorld, setActiveWorld] = useState(1)

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
  const { positions, height } = useMemo(() => computeLayout(activeWorld, units.length), [activeWorld, units.length])
  const island = useMemo(() => islandPath(activeWorld, positions, height), [activeWorld, positions, height])
  const road = useMemo(() => smoothPath(positions.map(p => [p.x, p.y] as [number, number]), false), [positions])
  const decor = useMemo(() => decorations(activeWorld, positions, height), [activeWorld, positions, height])

  const furthestIdx = units.findIndex(u => !progress[u.id]?.completed_at)
  const currentIdx = furthestIdx === -1 ? units.length - 1 : furthestIdx

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, width: '100%', maxWidth: 480, margin: '0 auto' }}>
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
        <svg viewBox={`0 0 ${WIDTH} ${height}`} style={{ width: '100%', display: 'block' }} preserveAspectRatio="xMidYMin meet">
          <path d={island} fill={world.color} opacity={0.35} />
          <path d={island} fill="none" stroke={world.color} strokeWidth={1} opacity={0.5} />
          {road && <path d={road} fill="none" stroke="#FFF6E5" strokeWidth={5} strokeLinecap="round" opacity={0.9} />}
          {road && <path d={road} fill="none" stroke="#E9D2AE" strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 6" opacity={0.6} />}
          {decor.map((d, i) => (
            <text key={i} x={d.x} y={d.y} fontSize={5} textAnchor="middle" opacity={0.8}>{d.emoji}</text>
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
            <div key={u.id} style={{ position: 'absolute', left: `${p.x}%`, top: `${(p.y / height) * 100}%`, transform: 'translate(-50%,-50%)' }}>
              {i === currentIdx && !locked && (
                <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', fontSize: 22, animation: 'kg-floaty 2s ease-in-out infinite' }}>
                  🧒
                </div>
              )}
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
      </div>
    </div>
  )
}
