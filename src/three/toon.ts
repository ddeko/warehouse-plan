import * as THREE from 'three'

/**
 * Shared toon-shading resources.
 *
 * A 3-step gradient map turns MeshToonMaterial's ramp into hard bands, which is
 * what gives the flat cartoon look instead of a smooth photographic falloff.
 * Everything here is module-level and reused by every object in the scene, so
 * a room with fifty containers still only allocates one set.
 */
function makeGradientMap(steps: number[]): THREE.DataTexture {
  const data = new Uint8Array(steps)
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

export const GRADIENT_MAP = makeGradientMap([170, 215, 255])

export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
export const UNIT_BOX_EDGES = new THREE.EdgesGeometry(UNIT_BOX)
export const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
export const UNIT_CYL_EDGES = new THREE.EdgesGeometry(UNIT_CYL, 30)

/** Outline thickness in metres, added on every side of a shelled part. */
export const OUTLINE = 0.012

/**
 * Opt an object out of picking.
 *
 * Everything inside a container's group inherits that group's pointer
 * handlers, so decoration is clickable unless it says otherwise — and the
 * defaults are actively hostile here:
 *
 *  - `Line` picking uses `raycaster.params.Line.threshold`, which defaults to
 *    1 world unit. The scene is in metres, so every outline segment carries a
 *    one-metre-radius grab zone and objects steal clicks from their neighbours.
 *  - Labels are sprites drawn with `depthTest: false`, so they float over
 *    unrelated furniture and hand that furniture's clicks to their owner.
 *  - Outline shells are back-face boxes that surround the real geometry.
 *
 * Picking should only ever hit the invisible hull that matches the object's
 * true footprint.
 */
export const NO_RAYCAST = () => null

export const INK = '#3a4459'
export const INK_SELECTED = '#3b63f0'
export const INK_INVALID = '#e05252'
/** Marker for the object a search just jumped to. */
export const REVEAL = '#2f7dff'

const cache = new Map<string, THREE.Material>()

/** Flat-shaded pastel body material, cached per colour. */
export function toonMaterial(color: string): THREE.Material {
  const key = `toon:${color}`
  let m = cache.get(key)
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: GRADIENT_MAP,
      // Faces are nudged back so the outline shell and edge lines never z-fight.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    cache.set(key, m)
  }
  return m
}

/** Solid ink material drawn on back faces to produce a thick outline. */
export function outlineMaterial(color: string): THREE.Material {
  const key = `outline:${color}`
  let m = cache.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
    cache.set(key, m)
  }
  return m
}

export function lineMaterial(color: string): THREE.Material {
  const key = `line:${color}`
  let m = cache.get(key)
  if (!m) {
    m = new THREE.LineBasicMaterial({ color })
    cache.set(key, m)
  }
  return m
}

/** Blend a hex colour toward white (t = 1 is white). */
export function tint(hex: string, t: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const mix = (c: number) => Math.round(c + (255 - c) * t)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/** Blend a hex colour toward black (t = 1 is black). */
export function deepen(hex: string, t: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const mix = (c: number) => Math.round(c * (1 - t))
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
