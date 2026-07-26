import type { Container } from '../types'

/**
 * Shared object geometry.
 *
 * Both renderers consume this: the WebGL scene turns each part into a mesh, the
 * SVG scene turns it into three polygons. Keeping one definition means an
 * object can never look like two different things depending on the view.
 *
 * All coordinates are in METRES, relative to the object's floor-centre.
 */

export type Tone = 'body' | 'trim' | 'goods' | 'glass'

export interface Part {
  /** centre, metres, relative to the object's floor-centre */
  p: [number, number, number]
  /** size, metres */
  s: [number, number, number]
  tone?: Tone
  /** Chunky outlines are reserved for structural masses; small trim would look
   *  bloated because the shell adds a fixed thickness on every side. */
  outline?: boolean
  round?: boolean
}

const M = (cm: number) => cm / 100

/**
 * Shrink a span by a fixed margin rather than a fixed percentage.
 *
 * A proportional inset (`w * 0.8`) looks fine at the default size but leaves a
 * growing band of dead space as the object is stretched — a 10 m rack would
 * carry a metre of empty air at each end. A constant margin keeps the gap
 * looking like a gap at every size. The proportional floor only kicks in for
 * objects small enough that a fixed margin would swallow them.
 */
const inset = (span: number, margin = 0.06) => Math.max(span * 0.5, span - margin * 2)

/** Evenly spaced positions across a span, inclusive of both ends. */
function spread(span: number, thickness: number, count: number): number[] {
  if (count < 2) return [0]
  const usable = span - thickness
  return Array.from({ length: count }, (_, i) => -usable / 2 + (i / (count - 1)) * usable)
}

/** Assemble a piece of furniture from a handful of blocks. Deliberately coarse:
 *  the cartoon read comes from clean silhouettes, not from detail. */
export function buildParts(c: Container, fill: number): Part[] {
  const w = M(c.w)
  const h = M(c.h)
  const d = M(c.d)
  const levels = Math.max(1, Math.min(6, c.levels))
  const parts: Part[] = []
  const load = Math.max(0, Math.min(1, fill))

  switch (c.type) {
    case 'shelf':
    case 'unit': {
      const t = Math.min(0.05, w * 0.06)
      // Wide units get intermediate dividers instead of one unsupported span.
      const uprights = Math.max(2, Math.min(9, Math.round(w / 1.6) + 1))
      for (const px of spread(w, t, uprights)) {
        parts.push({ p: [px, h / 2, 0], s: [t, h, d], outline: true })
      }
      parts.push({ p: [0, h - t / 2, 0], s: [w, t, d], outline: true })
      parts.push({ p: [0, t / 2, 0], s: [w, t, d], outline: true })
      if (c.type === 'unit') parts.push({ p: [0, h / 2, -d / 2 + 0.015], s: [w, h, 0.03], tone: 'trim' })
      for (let i = 1; i < levels; i++) {
        parts.push({ p: [0, (i / levels) * h, 0], s: [w - t * 2, t * 0.6, d], tone: 'trim' })
      }
      const shown = Math.round(load * levels)
      for (let i = 0; i < shown; i++) {
        const bay = h / levels
        const gh = bay * 0.6
        parts.push({
          p: [0, (i / levels) * h + t / 2 + gh / 2, 0],
          s: [inset(w - t * 2, 0.05), gh, inset(d, 0.05)],
          tone: 'goods',
        })
      }
      return parts
    }

    case 'rack': {
      const post = Math.min(0.11, w * 0.05)
      // One upright pair per ~2.8 m bay, so a stretched rack still looks built.
      const frames = Math.max(2, Math.min(9, Math.round(w / 2.8) + 1))
      for (const px of spread(w, post, frames)) {
        for (const pz of [-d / 2 + post / 2, d / 2 - post / 2]) {
          parts.push({ p: [px, h / 2, pz], s: [post, h, post], outline: true })
        }
      }
      for (let i = 1; i <= levels; i++) {
        parts.push({ p: [0, (i / levels) * h - 0.04, 0], s: [w, 0.08, d], tone: 'trim', outline: true })
      }
      const shown = Math.round(load * levels)
      for (let i = 0; i < shown; i++) {
        const bay = h / levels
        parts.push({
          p: [0, i * bay + bay * 0.45, 0],
          s: [inset(w - post * 2, 0.06), bay * 0.62, inset(d, 0.08)],
          tone: 'goods',
          outline: true,
        })
      }
      return parts
    }

    case 'pallet': {
      const deck = h * 0.45
      for (const pz of [-d / 2 + 0.06, 0, d / 2 - 0.06]) {
        parts.push({ p: [0, (h - deck) / 2, pz], s: [w, h - deck, 0.12], tone: 'trim' })
      }
      parts.push({ p: [0, h - deck / 2, 0], s: [w, deck, d], outline: true })
      if (load > 0) {
        const gh = 0.25 + load * 0.85
        parts.push({ p: [0, h + gh / 2, 0], s: [inset(w, 0.04), gh, inset(d, 0.04)], tone: 'goods', outline: true })
      }
      return parts
    }

    case 'stack': {
      const layers = Math.max(1, Math.min(5, Math.round(levels * Math.max(0.3, load || 0.6))))
      const lh = h / layers
      for (let i = 0; i < layers; i++) {
        const j = ((i % 3) - 1) * 0.03
        parts.push({
          p: [j, i * lh + lh / 2, j * 0.6],
          s: [w - Math.abs(j) * 2, lh * 0.93, d - Math.abs(j) * 2],
          tone: i % 2 ? 'trim' : 'body',
          outline: true,
        })
      }
      return parts
    }

    case 'box':
    case 'crate': {
      const lid = Math.min(0.06, h * 0.18)
      parts.push({ p: [0, (h - lid) / 2, 0], s: [w, h - lid, d], outline: true })
      parts.push({ p: [0, h - lid / 2, 0], s: [w * 1.04, lid, d * 1.04], tone: 'trim', outline: true })
      if (c.type === 'crate') {
        parts.push({ p: [0, (h - lid) * 0.55, 0], s: [w * 1.02, 0.035, d * 0.14], tone: 'trim' })
        parts.push({ p: [0, (h - lid) * 0.55, 0], s: [w * 0.14, 0.035, d * 1.02], tone: 'trim' })
      }
      return parts
    }

    case 'cupboard':
    case 'cabinet':
    case 'fridge':
    case 'freezer': {
      parts.push({ p: [0, h / 2, 0], s: [w, h, d], outline: true })
      const twoDoors = c.type === 'cupboard' || (c.type === 'freezer' && c.w > 100)
      const gap = 0.012
      const pad = 0.045
      const doorD = 0.035
      const doorH = h - pad * 2
      if (twoDoors) {
        const dw = (w - pad * 2 - gap) / 2
        parts.push({ p: [-(dw + gap) / 2, h / 2, d / 2], s: [dw, doorH, doorD], tone: 'trim', outline: true })
        parts.push({ p: [(dw + gap) / 2, h / 2, d / 2], s: [dw, doorH, doorD], tone: 'trim', outline: true })
        parts.push({ p: [-0.055, h * 0.5, d / 2 + 0.03], s: [0.022, h * 0.16, 0.03], tone: 'glass' })
        parts.push({ p: [0.055, h * 0.5, d / 2 + 0.03], s: [0.022, h * 0.16, 0.03], tone: 'glass' })
      } else {
        parts.push({ p: [0, h / 2, d / 2], s: [w - pad * 2, doorH, doorD], tone: 'trim', outline: true })
        parts.push({ p: [w / 2 - 0.12, h * 0.5, d / 2 + 0.03], s: [0.024, h * 0.2, 0.032], tone: 'glass' })
      }
      if (c.type === 'fridge' || c.type === 'freezer') {
        parts.push({ p: [-w * 0.22, h * 0.88, d / 2 + 0.03], s: [w * 0.3, h * 0.05, 0.02], tone: 'glass' })
      }
      if (c.type === 'cabinet') {
        for (let i = 1; i <= levels; i++) {
          parts.push({ p: [0, (i / (levels + 1)) * h, d / 2 + 0.03], s: [w - pad * 3, 0.014, 0.02], tone: 'glass' })
        }
      }
      return parts
    }

    case 'bin':
    case 'drum':
    case 'tank': {
      const r = Math.min(w, d)
      parts.push({ p: [0, h / 2, 0], s: [r, h, r], outline: true, round: true })
      parts.push({ p: [0, h - 0.025, 0], s: [r * 1.06, 0.05, r * 1.06], tone: 'trim', round: true, outline: true })
      if (c.type === 'drum') {
        parts.push({ p: [0, h * 0.36, 0], s: [r * 1.05, 0.045, r * 1.05], tone: 'trim', round: true })
        parts.push({ p: [0, h * 0.68, 0], s: [r * 1.05, 0.045, r * 1.05], tone: 'trim', round: true })
      }
      if (load > 0.02) {
        const ch = load * (h - 0.1)
        const gr = inset(r, 0.045)
        parts.push({ p: [0, ch / 2 + 0.03, 0], s: [gr, ch, gr], tone: 'goods', round: true })
      }
      return parts
    }

    case 'cage': {
      const post = 0.045
      const wheel = 0.06
      parts.push({ p: [0, wheel + 0.03, 0], s: [w, 0.06, d], tone: 'trim', outline: true })
      for (const px of [-w / 2 + post / 2, w / 2 - post / 2]) {
        for (const pz of [-d / 2 + post / 2, d / 2 - post / 2]) {
          parts.push({ p: [px, wheel + (h - wheel) / 2, pz], s: [post, h - wheel, post], outline: true })
        }
      }
      for (const t of [0.45, 0.75]) {
        parts.push({ p: [0, h * t, -d / 2 + post / 2], s: [w, 0.03, 0.03], tone: 'trim' })
      }
      if (load > 0) {
        const gh = (h - wheel) * load * 0.8
        parts.push({
          p: [0, wheel + 0.06 + gh / 2, 0],
          s: [inset(w - post * 2, 0.04), Math.max(0.08, gh), inset(d - post * 2, 0.04)],
          tone: 'goods',
          outline: true,
        })
      }
      return parts
    }

    case 'table':
    case 'workbench': {
      const top = 0.07
      const leg = 0.07
      parts.push({ p: [0, h - top / 2, 0], s: [w, top, d], outline: true })
      // Long benches gain intermediate legs rather than spanning unsupported.
      const legRows = Math.max(2, Math.min(6, Math.round(w / 1.8) + 1))
      for (const px of spread(w - leg * 2, leg, legRows)) {
        for (const pz of [-d / 2 + leg, d / 2 - leg]) {
          parts.push({ p: [px, (h - top) / 2, pz], s: [leg, h - top, leg], tone: 'trim', outline: true })
        }
      }
      if (c.type === 'workbench') {
        parts.push({ p: [0, h * 0.32, 0], s: [w - 0.24, 0.05, d * 0.66], tone: 'trim', outline: true })
        parts.push({ p: [0, h + h * 0.24, -d / 2 + 0.02], s: [w, h * 0.48, 0.04], tone: 'trim', outline: true })
      }
      if (load > 0) {
        parts.push({ p: [0, h + 0.11, 0], s: [inset(w, 0.14), 0.22, inset(d, 0.12)], tone: 'goods', outline: true })
      }
      return parts
    }

    case 'pillar':
      return [{ p: [0, h / 2, 0], s: [w, h, d], outline: true }]

    case 'door': {
      const jamb = 0.1
      parts.push({ p: [-w / 2 + jamb / 2, h / 2, 0], s: [jamb, h, d], outline: true })
      parts.push({ p: [w / 2 - jamb / 2, h / 2, 0], s: [jamb, h, d], outline: true })
      parts.push({ p: [0, h - jamb / 2, 0], s: [w, jamb, d], outline: true })
      return parts
    }

    default:
      return [{ p: [0, h / 2, 0], s: [w, h, d], outline: true }]
  }
}
