import { useMemo } from 'react'
import type { ContainerType } from '../types'
import { containerMeta } from '../types'

/**
 * Flat isometric thumbnail for a storage type, drawn as SVG so the catalogue
 * matches the viewport's cartoon look without loading any 3D assets.
 */

const COS30 = 0.866

/** Project a 3D point onto the same isometric axes the viewport uses. */
const proj = (x: number, y: number, z: number): [number, number] => [
  (x - z) * COS30,
  (x + z) * 0.5 - y,
]

const fmt = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

interface BoxSpec {
  w: number
  d: number
  h: number
  x?: number
  y?: number
  z?: number
  fill?: string
}

function darken(hex: string, t: number) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const m = (c: number) => Math.round(c * (1 - t))
  return `#${((1 << 24) + (m((n >> 16) & 255) << 16) + (m((n >> 8) & 255) << 8) + m(n & 255)).toString(16).slice(1)}`
}

/** Blocks making up each thumbnail, ordered far-to-near for painter drawing. */
function specs(type: ContainerType): BoxSpec[] {
  const goods = '#e9edf5'
  switch (type) {
    case 'shelf':
    case 'unit':
      return [
        { w: 0.25, d: 3, h: 5 },
        { w: 0.25, d: 3, h: 5, x: 2.75 },
        { w: 3, d: 3, h: 0.3, y: 4.7 },
        { w: 2.5, d: 3, h: 0.22, x: 0.25, y: 3.2 },
        { w: 2.2, d: 2.4, h: 0.9, x: 0.4, z: 0.3, y: 1.85, fill: goods },
        { w: 2.5, d: 3, h: 0.22, x: 0.25, y: 1.6 },
        { w: 2.2, d: 2.4, h: 0.9, x: 0.4, z: 0.3, y: 0.3, fill: goods },
        { w: 3, d: 3, h: 0.3 },
      ]
    case 'rack':
      return [
        { w: 0.35, d: 0.35, h: 5.4 },
        { w: 0.35, d: 0.35, h: 5.4, x: 3.4 },
        { w: 3.75, d: 2.8, h: 0.3, y: 3.4 },
        { w: 2.9, d: 2.1, h: 1.2, x: 0.4, z: 0.35, y: 3.7, fill: goods },
        { w: 3.75, d: 2.8, h: 0.3, y: 1.4 },
        { w: 2.9, d: 2.1, h: 1.2, x: 0.4, z: 0.35, y: 1.7, fill: goods },
        { w: 0.35, d: 0.35, h: 5.4, z: 2.45 },
        { w: 0.35, d: 0.35, h: 5.4, x: 3.4, z: 2.45 },
      ]
    case 'pallet':
      return [
        { w: 4, d: 3.4, h: 0.4 },
        { w: 3.4, d: 2.8, h: 2.2, x: 0.3, z: 0.3, y: 0.4, fill: goods },
      ]
    case 'stack':
      return [
        { w: 3.4, d: 3, h: 1.3 },
        { w: 3.2, d: 2.8, h: 1.3, x: 0.1, z: 0.1, y: 1.3 },
        { w: 3, d: 2.6, h: 1.3, x: 0.2, z: 0.2, y: 2.6 },
      ]
    case 'box':
      return [{ w: 3.4, d: 3, h: 2.4 }, { w: 3.6, d: 3.2, h: 0.35, x: -0.1, z: -0.1, y: 2.4 }]
    case 'crate':
      return [
        { w: 3.6, d: 3.2, h: 2.6 },
        { w: 0.45, d: 3.35, h: 0.2, x: 1.55, z: -0.08, y: 1.2 },
        { w: 3.8, d: 3.4, h: 0.35, x: -0.1, z: -0.1, y: 2.6 },
      ]
    case 'cupboard':
    case 'cabinet':
      return [
        { w: 3.2, d: 2.4, h: type === 'cabinet' ? 3.6 : 5 },
        { w: 1.4, d: 0.2, h: (type === 'cabinet' ? 3.6 : 5) - 0.7, x: 0.16, z: 2.4, y: 0.35 },
        { w: 1.4, d: 0.2, h: (type === 'cabinet' ? 3.6 : 5) - 0.7, x: 1.64, z: 2.4, y: 0.35 },
      ]
    case 'fridge':
    case 'freezer': {
      const H = type === 'freezer' ? 3.4 : 5.2
      return [
        { w: 2.6, d: 2.4, h: H },
        { w: 2.2, d: 0.2, h: H - 0.7, x: 0.2, z: 2.4, y: 0.35 },
        { w: 0.3, d: 0.26, h: 1.1, x: 1.8, z: 2.6, y: H * 0.42 },
      ]
    }
    case 'cage':
      return [
        { w: 0.25, d: 0.25, h: 4.4, y: 0.3 },
        { w: 0.25, d: 0.25, h: 4.4, x: 2.8, y: 0.3 },
        { w: 3.05, d: 2.6, h: 0.3 },
        { w: 2.4, d: 2.05, h: 1.8, x: 0.3, z: 0.28, y: 0.3, fill: goods },
        { w: 0.25, d: 0.25, h: 4.4, z: 2.35, y: 0.3 },
        { w: 0.25, d: 0.25, h: 4.4, x: 2.8, z: 2.35, y: 0.3 },
      ]
    case 'table':
    case 'workbench':
      return [
        { w: 0.3, d: 0.3, h: 2 },
        { w: 0.3, d: 0.3, h: 2, x: 3.5 },
        { w: 0.3, d: 0.3, h: 2, z: 2.7 },
        { w: 0.3, d: 0.3, h: 2, x: 3.5, z: 2.7 },
        { w: 3.8, d: 3, h: 0.35, y: 2 },
      ]
    case 'pillar':
      return [{ w: 1.5, d: 1.5, h: 6 }]
    case 'door':
      return [
        { w: 0.4, d: 1.2, h: 4.8 },
        { w: 3.2, d: 1.2, h: 0.4, y: 4.4 },
        { w: 0.4, d: 1.2, h: 4.8, x: 2.8 },
      ]
    default:
      return [{ w: 3, d: 3, h: 3 }]
  }
}

export function TypeIcon({ type, size = 46, color }: { type: ContainerType; size?: number; color?: string }) {
  const meta = containerMeta(type)
  const fill = color ?? meta.color
  const stroke = '#3a4459'

  const svg = useMemo(() => {
    if (meta.round) {
      const rx = 3
      const ry = rx * 0.5
      const top = -2.4
      const bot = 2.2
      return {
        // ellipse-capped barrel reads more clearly than facetted geometry
        node: (
          <g stroke={stroke} strokeWidth={0.38} strokeLinejoin="round">
            <path d={`M ${-rx} ${top} L ${-rx} ${bot} A ${rx} ${ry} 0 0 0 ${rx} ${bot} L ${rx} ${top} Z`} fill={darken(fill, 0.14)} />
            <ellipse cx={0} cy={top} rx={rx} ry={ry} fill={fill} />
            {type === 'drum' && (
              <>
                <path d={`M ${-rx} ${top + 1.5} A ${rx} ${ry} 0 0 0 ${rx} ${top + 1.5}`} fill="none" />
                <path d={`M ${-rx} ${top + 3} A ${rx} ${ry} 0 0 0 ${rx} ${top + 3}`} fill="none" />
              </>
            )}
          </g>
        ),
        transform: '',
      }
    }

    const list = specs(type)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    const track = ([x, y]: [number, number]) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }

    const faces = list.map((s) => {
      const { w, d, h, x = 0, y = 0, z = 0 } = s
      const P = (dx: number, dy: number, dz: number) => proj(x + dx, y + dy, z + dz)
      const top: [number, number][] = [P(0, h, 0), P(w, h, 0), P(w, h, d), P(0, h, d)]
      const left: [number, number][] = [P(0, h, d), P(w, h, d), P(w, 0, d), P(0, 0, d)]
      const right: [number, number][] = [P(w, h, 0), P(w, h, d), P(w, 0, d), P(w, 0, 0)]
      ;[...top, ...left, ...right].forEach(track)
      return { top, left, right, base: s.fill ?? fill }
    })

    // Fit the projected drawing into the icon box with a little breathing room.
    const bw = Math.max(maxX - minX, 0.01)
    const bh = Math.max(maxY - minY, 0.01)
    const scale = Math.min(10 / bw, 10 / bh)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    return {
      node: (
        <g strokeWidth={0.9 / scale} strokeLinejoin="round" stroke={stroke}>
          {faces.map((f, i) => (
            <g key={i}>
              <polygon points={fmt(f.top)} fill={f.base} />
              <polygon points={fmt(f.left)} fill={darken(f.base, 0.09)} />
              <polygon points={fmt(f.right)} fill={darken(f.base, 0.2)} />
            </g>
          ))}
        </g>
      ),
      transform: `scale(${scale}) translate(${-cx} ${-cy})`,
    }
  }, [type, fill, stroke, meta.round])

  return (
    <svg width={size} height={size} viewBox="-6 -6 12 12" style={{ display: 'block' }}>
      <g transform={svg.transform}>{svg.node}</g>
    </svg>
  )
}
