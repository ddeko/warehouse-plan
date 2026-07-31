import type { Container, Room, Rotation } from '../types'
import { containerMeta } from '../types'

export interface Rect {
  /** centre */
  cx: number
  cz: number
  /** rotated footprint extents */
  w: number
  d: number
}

/** Footprint of a container after applying its 90° rotation steps. */
export function footprint(c: Pick<Container, 'x' | 'z' | 'w' | 'd' | 'rotation'>): Rect {
  const swapped = c.rotation === 90 || c.rotation === 270
  return {
    cx: c.x,
    cz: c.z,
    w: swapped ? c.d : c.w,
    d: swapped ? c.w : c.d,
  }
}

export const rectBounds = (r: Rect) => ({
  minX: r.cx - r.w / 2,
  maxX: r.cx + r.w / 2,
  minZ: r.cz - r.d / 2,
  maxZ: r.cz + r.d / 2,
})

/** Axis-aligned overlap test with a small epsilon so touching edges are legal. */
export function rectsOverlap(a: Rect, b: Rect, eps = 0.5): boolean {
  const A = rectBounds(a)
  const B = rectBounds(b)
  return A.minX < B.maxX - eps && A.maxX > B.minX + eps && A.minZ < B.maxZ - eps && A.maxZ > B.minZ + eps
}

/** Two boxes only truly collide when they also share a vertical band. */
export function verticalOverlap(a: Pick<Container, 'y' | 'h'>, b: Pick<Container, 'y' | 'h'>, eps = 0.5): boolean {
  return a.y < b.y + b.h - eps && a.y + a.h > b.y + eps
}

export function insideRoom(rect: Rect, room: Room, clearance = 0): boolean {
  const b = rectBounds(rect)
  return (
    b.minX >= clearance - 0.01 &&
    b.minZ >= clearance - 0.01 &&
    b.maxX <= room.width - clearance + 0.01 &&
    b.maxZ <= room.length - clearance + 0.01
  )
}

/** Clamp a centre position so the whole footprint stays within the room. */
export function clampToRoom(rect: Rect, room: Room, clearance = 0): { x: number; z: number } {
  const halfW = rect.w / 2
  const halfD = rect.d / 2
  const minX = clearance + halfW
  const maxX = room.width - clearance - halfW
  const minZ = clearance + halfD
  const maxZ = room.length - clearance - halfD
  return {
    x: maxX < minX ? room.width / 2 : Math.min(maxX, Math.max(minX, rect.cx)),
    z: maxZ < minZ ? room.length / 2 : Math.min(maxZ, Math.max(minZ, rect.cz)),
  }
}

export const snap = (v: number, grid: number) => (grid > 0 ? Math.round(v / grid) * grid : v)

export interface PlacementResult {
  ok: boolean
  /** ids of the containers blocking this placement */
  blockedBy: string[]
  outOfBounds: boolean
}

export interface PlacementCandidate {
  id: string
  roomId: string
  x: number
  z: number
  y: number
  w: number
  d: number
  h: number
  rotation: Rotation
}

export function checkPlacement(
  candidate: PlacementCandidate,
  others: Container[],
  room: Room,
  opts: { collision: boolean; clearance: number },
): PlacementResult {
  const rect = footprint(candidate)
  const outOfBounds = !insideRoom(rect, room, opts.clearance)
  const blockedBy: string[] = []
  /*
   * `collision` is the user's setting, nothing more — obstacles block either
   * way, even with it switched off.
   *
   * Callers used to fold "the moving object is an obstacle" into this flag,
   * which read as "this object ignores collisions" rather than "this object is
   * not itself blocking". A rack could not be dropped onto a pillar, but the
   * pillar could be dragged straight through the rack: the same overlap,
   * legal or not depending only on which one you grabbed.
   */
  for (const o of others) {
    if (o.id === candidate.id || o.roomId !== candidate.roomId) continue
    if (!opts.collision && !isObstacle(o)) continue
    if (!verticalOverlap(candidate, o)) continue
    if (rectsOverlap(rect, footprint(o))) blockedBy.push(o.id)
  }
  return { ok: !outOfBounds && blockedBy.length === 0, blockedBy, outOfBounds }
}

/**
 * Search outward from a preferred point for the nearest legal centre.
 * Used by "add object", "duplicate" and auto-arrange.
 */
export function findFreeSpot(
  candidate: PlacementCandidate,
  others: Container[],
  room: Room,
  opts: { collision: boolean; clearance: number; grid: number },
): { x: number; z: number } | null {
  const step = Math.max(opts.grid || 10, 5)
  const rect = footprint(candidate)
  const test = (x: number, z: number) => {
    const c = { ...candidate, x, z }
    return checkPlacement(c, others, room, opts).ok
  }
  /** Prefer a grid-aligned position, but never reject a valid off-grid one. */
  const settle = (x: number, z: number): { x: number; z: number } | null => {
    if (opts.grid > 0) {
      const g = clampToRoom({ ...rect, cx: snap(x, opts.grid), cz: snap(z, opts.grid) }, room, opts.clearance)
      if (test(g.x, g.z)) return g
    }
    const p = clampToRoom({ ...rect, cx: x, cz: z }, room, opts.clearance)
    return test(p.x, p.z) ? p : null
  }

  const start = clampToRoom(rect, room, opts.clearance)
  const settled = settle(start.x, start.z)
  if (settled) return settled

  /*
   * Only ring out as far as the room actually extends.
   *
   * The bound used to be the room's longest side over the step, which on the
   * seeded 2400×1600 room at a 20 cm grid is ~122 rings — roughly 60 000
   * candidate positions, each tested against every container in the room,
   * synchronously, before admitting there was no space. That froze the tab on
   * the one path guaranteed to reach it: adding an object to a full room. Half
   * the diagonal is enough to cover every point in the room from any start,
   * and `seen` drops the duplicates that `clampToRoom` used to fold onto the
   * same edge position over and over.
   */
  const maxRings = Math.ceil(Math.hypot(room.width, room.length) / 2 / step) + 1
  const seen = new Set<string>()
  for (let ring = 1; ring <= maxRings; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue
        const x = start.x + dx * step
        const z = start.z + dz * step
        // Outside the room the clamp collapses whole arcs of the ring onto one
        // point; testing it once is enough.
        const key = `${Math.round(x)}:${Math.round(z)}`
        if (seen.has(key)) continue
        seen.add(key)
        const p = settle(x, z)
        if (p) return p
      }
    }
  }
  return null
}

/**
 * Total footprint area (cm²) every object in the list occupies.
 *
 * Includes obstacles: a structural pillar takes up just as much floor as a
 * shelf does, and callers measuring how full a room is want it counted.
 */
export function usedFloorArea(containers: Container[]): number {
  return containers.reduce((sum, c) => {
    const f = footprint(c)
    return sum + f.w * f.d
  }, 0)
}

export const isObstacle = (c: Container) => !!containerMeta(c.type).obstacle

/** Convert cm-space (origin at room corner) to three.js metres centred on the room. */
export const toScene = (cm: number) => cm / 100
