/**
 * Top-down plan projection used by the SVG renderer.
 *
 * Everything is done in METRES and projected to unscaled "paper" units; the
 * caller applies a single zoom + pan transform on the wrapping <g>, so the
 * projection itself never has to know about pixels.
 *
 * This used to carry three projections — isometric, planometric ("cad") and
 * plan. The first two are gone: the WebGL scene renders a real perspective
 * camera now, which does the job of a pictorial view properly, and a flat
 * top-down plan is the one thing it *can't* give you. What is left is a pure
 * orthogonal floor plan, where a rectangular room is a rectangle you can hold a
 * ruler against and nothing is foreshortened at all.
 */

export interface View {
  /** 0..3 — 90° rotation of the sheet. A rotated rectangle is still a rectangle. */
  preset: number
  /** room extents in metres */
  roomW: number
  roomL: number
}

/** Put room coordinates into view space by rotating the sheet in 90° steps. */
function orient(v: View, x: number, z: number): [number, number] {
  switch (v.preset & 3) {
    case 1: return [v.roomL - z, x]
    case 2: return [v.roomW - x, v.roomL - z]
    case 3: return [z, v.roomW - x]
    default: return [x, z]
  }
}

/**
 * Project a room-space point (metres) to paper coordinates.
 *
 * `y` is accepted and ignored: looking straight down, height has no effect on
 * where a point lands. Keeping the parameter means callers can pass a full 3D
 * point without stripping the height first.
 */
export function project(v: View, x: number, _y: number, z: number): [number, number] {
  return orient(v, x, z)
}

export interface Box {
  /** min corner, metres, room space */
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

/**
 * Order boxes back-to-front for painter's rendering.
 *
 * Straight down there is no depth to reason about — only height decides what
 * covers what, so a taller part simply draws over a shorter one. (The isometric
 * version of this needed a separating-axis partial order and a topological
 * sort; none of that survives the switch to plan.)
 */
export function sortByDepth<T>(v: View, items: T[], boxOf: (t: T) => Box): T[] {
  if (items.length < 2) return items
  return items
    .map((t, i) => ({ t, i, y: boxOf(t).y }))
    // Index as tie-breaker keeps the sort stable across engines, so parts at
    // equal height don't flicker between paint orders during a drag.
    .sort((a, b) => a.y - b.y || a.i - b.i)
    .map((r) => r.t)
}

/**
 * Convert a screen-space drag delta (paper units) back into room-space X/Z.
 * Dragging happens on the floor, and the projection is a plain rotation there,
 * so this is just the inverse rotation.
 */
export function unproject(v: View, dPaperX: number, dPaperY: number): [number, number] {
  switch (v.preset & 3) {
    case 1: return [dPaperY, -dPaperX]
    case 2: return [-dPaperX, -dPaperY]
    case 3: return [-dPaperY, dPaperX]
    default: return [dPaperX, dPaperY]
  }
}

/** The visible face of an axis-aligned box. Looking down, that is the top only. */
export function boxFace(v: View, b: Box): string {
  const P = (dx: number, dz: number) => project(v, b.x + dx, 0, b.z + dz)
  return [P(0, 0), P(b.w, 0), P(b.w, b.d), P(0, b.d)]
    .map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)
    .join(' ')
}

/** Bounding box of the projected room, for fit-to-view. */
export function roomBounds(v: View, w: number, l: number) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const x of [0, w]) {
    for (const z of [0, l]) {
      const [px, py] = project(v, x, 0, z)
      minX = Math.min(minX, px); maxX = Math.max(maxX, px)
      minY = Math.min(minY, py); maxY = Math.max(maxY, py)
    }
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}
