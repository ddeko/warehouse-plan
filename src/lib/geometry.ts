import type { Container, Room, Rotation } from '../types'
import { CONTAINER_META } from '../types'

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
  if (opts.collision) {
    for (const o of others) {
      if (o.id === candidate.id || o.roomId !== candidate.roomId) continue
      if (!verticalOverlap(candidate, o)) continue
      if (rectsOverlap(rect, footprint(o))) blockedBy.push(o.id)
    }
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

  const maxRings = Math.ceil(Math.max(room.width, room.length) / step) + 2
  for (let ring = 1; ring <= maxRings; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue
        const p = settle(start.x + dx * step, start.z + dz * step)
        if (p) return p
      }
    }
  }
  return null
}

/** Total footprint area (cm²) consumed by real storage objects in a room. */
export function usedFloorArea(containers: Container[]): number {
  return containers.reduce((sum, c) => {
    const f = footprint(c)
    return sum + f.w * f.d
  }, 0)
}

export const isObstacle = (c: Container) => !!CONTAINER_META[c.type]?.obstacle

/** Convert cm-space (origin at room corner) to three.js metres centred on the room. */
export const toScene = (cm: number) => cm / 100
