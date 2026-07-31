import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Container, Item, Room, Settings } from '../types'
import { containerMeta } from '../types'
import { useStore } from '../store'
import { buildParts, type Part } from '../lib/parts'
import { footprint, snap } from '../lib/geometry'
import { boxFace, project, roomBounds, sortByDepth, unproject, type Box, type View } from './project'

const M = (cm: number) => cm / 100

const INK = '#3a4459'
const INK_SELECTED = '#3b63f0'
const REVEAL = '#2f7dff'
const GOODS = '#e9edf5'
const GLASS = '#cfd8e6'
const STROKE = 0.014

function shade(hex: string, t: number) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const m = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - t))))
  return `#${((1 << 24) + (m((n >> 16) & 255) << 16) + (m((n >> 8) & 255) << 8) + m(n & 255)).toString(16).slice(1)}`
}

const toneColor = (tone: Part['tone'], base: string) =>
  tone === 'goods' ? GOODS : tone === 'glass' ? GLASS : tone === 'trim' ? shade(base, 0.1) : base

/** Container footprint as a room-space box, used for depth sorting. */
function containerBox(c: Container): Box {
  const f = footprint(c)
  return {
    x: M(c.x - f.w / 2), y: M(c.y), z: M(c.z - f.d / 2),
    w: M(f.w), h: M(c.h), d: M(f.d),
  }
}

/** Turn one part's local offsets into a room-space box, applying rotation. */
function partBox(c: Container, part: Part): Box {
  let [lx, ly, lz] = part.p
  let [sw, sh, sd] = part.s
  if (c.rotation === 90) { [lx, lz] = [-lz, lx];[sw, sd] = [sd, sw] }
  else if (c.rotation === 180) { lx = -lx; lz = -lz }
  else if (c.rotation === 270) { [lx, lz] = [lz, -lx];[sw, sd] = [sd, sw] }
  return {
    x: M(c.x) + lx - sw / 2,
    y: M(c.y) + ly - sh / 2,
    z: M(c.z) + lz - sd / 2,
    w: sw, h: sh, d: sd,
  }
}

/* ------------------------------------------------------------------ object */

interface ObjProps {
  container: Container
  fill: number
  count: number
  view: View
  selected: boolean
  hovered: boolean
  revealed: boolean
  showLabel: boolean
  showBadge: boolean
  onPick: (id: string, e: React.PointerEvent) => void
  onHover: (id: string | null) => void
  onOpen: (id: string) => void
}

/**
 * One piece of furniture, seen from above.
 *
 * Memoised and self-contained: it builds and sorts its own parts. During a drag
 * only the moved container's props change, so the other objects skip both the
 * geometry rebuild and the re-render entirely — which is what keeps dragging
 * smooth on a room with fifty objects.
 */
const PlanObject = memo(function PlanObject({
  container: c, fill, count, view, selected, hovered, revealed, showLabel, showBadge, onPick, onHover, onOpen,
}: ObjProps) {
  const meta = containerMeta(c.type)
  const stroke = selected ? INK_SELECTED : INK
  const base = hovered && !selected ? shade(c.color, -0.06) : c.color

  const parts = useMemo(() => {
    const list = buildParts(c, fill).map((part) => ({ part, box: partBox(c, part) }))
    return sortByDepth(view, list, (p) => p.box)
  }, [c, fill, view])

  const centre = project(view, M(c.x), 0, M(c.z))
  const badge = count > 0 ? `${count} · ${Math.round(fill * 100)}%` : ''
  const badgeFill = fill > 1 ? '#ffb8b8' : fill > 0.85 ? '#ffe0a3' : '#9fe0cd'

  const rows: { text: string; bg: string; fg: string }[] = []
  if (showBadge && badge && !meta.obstacle) rows.push({ text: badge, bg: badgeFill, fg: INK })
  if (showLabel) {
    const t = selected ? `${c.code} · ${c.name}` : c.code
    rows.push({ text: t, bg: selected ? INK_SELECTED : '#ffffff', fg: selected ? '#ffffff' : INK })
  }

  /** Half the footprint, so labels clear the object instead of sitting on it. */
  const fp = footprint(c)
  const halfDepth = M(fp.d) / 2
  const halfWidth = M(fp.w) / 2

  return (
    <g
      data-code={c.code}
      onPointerDown={(e) => onPick(c.id, e)}
      onPointerEnter={() => onHover(c.id)}
      onPointerLeave={() => onHover(null)}
      onDoubleClick={(e) => { e.stopPropagation(); onOpen(c.id) }}
      style={{ cursor: c.locked ? 'not-allowed' : 'grab' }}
    >
      {revealed && (
        <rect
          className="reveal-ring"
          x={centre[0] - halfWidth - 0.18}
          y={centre[1] - halfDepth - 0.18}
          width={halfWidth * 2 + 0.36}
          height={halfDepth * 2 + 0.36}
          rx={0.12}
          fill="none"
          stroke={REVEAL}
          strokeWidth={0.07}
        />
      )}

      {parts.map(({ part, box }, i) => {
        const fillCol = toneColor(part.tone, base)
        if (part.round) {
          const ctr = project(view, box.x + box.w / 2, 0, box.z + box.d / 2)
          return (
            <ellipse key={i} cx={ctr[0]} cy={ctr[1]} rx={box.w / 2} ry={box.d / 2}
              fill={fillCol} stroke={stroke} strokeWidth={STROKE} />
          )
        }
        return (
          <polygon key={i} points={boxFace(view, box)} fill={fillCol}
            stroke={stroke} strokeWidth={STROKE} strokeLinejoin="round" />
        )
      })}

      {rows.length > 0 && (
        <g style={{ pointerEvents: 'none' }}>
          {rows.map((r, i) => {
            const wLbl = r.text.length * 0.078 + 0.18
            const y = centre[1] - halfDepth - 0.08 - i * 0.3
            return (
              <g key={i}>
                <rect x={centre[0] - wLbl / 2} y={y - 0.22} width={wLbl} height={0.26} rx={0.13}
                  fill={r.bg} stroke={INK} strokeOpacity={0.25} strokeWidth={0.01} />
                <text x={centre[0]} y={y - 0.05} textAnchor="middle" fontSize={0.17} fontWeight={600} fill={r.fg}
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {r.text}
                </text>
              </g>
            )
          })}
        </g>
      )}
    </g>
  )
})

/* ------------------------------------------------------------------- scene */

export function PlanScene({
  room, containers, items, settings, selectedId, revealedId, onSelect, onOpenItems, preset, zoomCmd, fitTick,
}: {
  room: Room
  containers: Container[]
  items: Item[]
  settings: Settings
  selectedId: string | null
  revealedId: string | null
  onSelect: (id: string | null) => void
  onOpenItems: (id: string) => void
  preset: number
  zoomCmd: { n: number; dir: number }
  fitTick: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const moveContainer = useStore((s) => s.moveContainer)
  const logMovement = useStore((s) => s.logMovement)
  const setDragInvalid = useStore((s) => s.setDragInvalid)

  const [size, setSize] = useState({ w: 800, h: 600 })
  const [cam, setCam] = useState({ scale: 60, tx: 0, ty: 0 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; z: number; w: number; d: number } | null>(null)

  const w = M(room.width)
  const l = M(room.length)

  const view = useMemo<View>(() => ({ preset, roomW: w, roomL: l }), [preset, w, l])

  // ------------------------------------------------------------- sizing/fit
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const read = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) })
    }
    const ro = new ResizeObserver(read)
    ro.observe(el)
    read()
    window.addEventListener('resize', read)
    return () => { ro.disconnect(); window.removeEventListener('resize', read) }
  }, [])

  const fit = useCallback(() => {
    const b = roomBounds(view, w, l)
    const scale = Math.min(size.w / Math.max(b.width, 0.01), size.h / Math.max(b.height, 0.01)) * 0.86
    setCam({
      scale,
      tx: size.w / 2 - ((b.minX + b.maxX) / 2) * scale,
      ty: size.h / 2 - ((b.minY + b.maxY) / 2) * scale,
    })
  }, [view, w, l, size.w, size.h])

  useLayoutEffect(fit, [fit, room.id, fitTick])

  useEffect(() => {
    if (!zoomCmd.n) return
    setCam((c) => {
      const ns = Math.max(4, Math.min(2000, c.scale * (zoomCmd.dir > 0 ? 1.22 : 1 / 1.22)))
      const k = ns / c.scale
      return { scale: ns, tx: size.w / 2 - (size.w / 2 - c.tx) * k, ty: size.h / 2 - (size.h / 2 - c.ty) * k }
    })
  }, [zoomCmd.n])

  // ------------------------------------------------------------------ items
  const byContainer = useMemo(() => {
    const map = new Map<string, { count: number; slots: number }>()
    for (const it of items) {
      const cur = map.get(it.containerId) ?? { count: 0, slots: 0 }
      cur.count += 1
      cur.slots += it.slots || 1
      map.set(it.containerId, cur)
    }
    return map
  }, [items])

  const ordered = useMemo(() => sortByDepth(view, containers, containerBox), [containers, view])

  // ------------------------------------------------------------------- drag
  const drag = useRef<{ id: string; startX: number; startY: number; ox: number; oz: number; moved: boolean } | null>(null)
  const camRef = useRef(cam)
  camRef.current = cam
  const viewRef = useRef(view)
  viewRef.current = view

  const onPick = useCallback((id: string, e: React.PointerEvent) => {
    e.stopPropagation()
    onSelect(id)
    const c = useStore.getState().containers.find((k) => k.id === id)
    if (!c || c.locked) return
    drag.current = { id, startX: e.clientX, startY: e.clientY, ox: c.x, oz: c.z, moved: false }
    // Capture, so the drag survives the pointer outrunning the object under it.
    // Without this a fast flick drops the object the moment the cursor leaves
    // its shape, because the element stops receiving events.
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }, [onSelect])

  const onHover = useCallback((id: string | null) => setHoveredId(id), [])
  const onOpen = useCallback((id: string) => onOpenItems(id), [onOpenItems])

  useEffect(() => {
    let raf = 0
    let pending: PointerEvent | null = null
    /* Mirrors of store state. Re-writing an unchanged value still notifies every
       subscriber, so tracking the last value locally turns a per-frame store
       write into one write per actual transition. */
    let invalid = false

    const apply = () => {
      raf = 0
      const e = pending
      pending = null
      const d = drag.current
      if (!e || !d) return
      const dPaperX = (e.clientX - d.startX) / camRef.current.scale
      const dPaperY = (e.clientY - d.startY) / camRef.current.scale
      const [dxM, dzM] = unproject(viewRef.current, dPaperX, dPaperY)
      const tx = d.ox + dxM * 100
      const tz = d.oz + dzM * 100
      const ok = moveContainer(d.id, tx, tz)
      d.moved = d.moved || ok
      if (ok) {
        if (invalid) { invalid = false; setGhost(null); setDragInvalid(false) }
      } else {
        const c = useStore.getState().containers.find((k) => k.id === d.id)
        if (c) {
          const f = footprint(c)
          const g = settings.snapEnabled ? room.grid : 0
          setGhost({ x: snap(tx, g), z: snap(tz, g), w: f.w, d: f.d })
        }
        if (!invalid) { invalid = true; setDragInvalid(true) }
      }
    }

    // Coalesce to one store write per frame; pointermove can fire far more
    // often than the display refreshes and each write re-renders the scene.
    const onMove = (e: PointerEvent) => {
      // A second finger turns the gesture into a pinch; stop moving the object.
      if (!drag.current || pinch.current) return
      pending = e
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onUp = () => {
      const d = drag.current
      if (!d) return
      drag.current = null
      if (raf) { cancelAnimationFrame(raf); raf = 0 }
      pending = null
      setGhost(null)
      if (invalid) { invalid = false; setDragInvalid(false) }
      if (d.moved) {
        const c = useStore.getState().containers.find((k) => k.id === d.id)
        if (c) {
          logMovement({
            type: 'relocate', name: `${c.code} ${c.name}`, qty: 0,
            toContainerId: c.id, roomId: c.roomId,
            note: `Repositioned to x ${Math.round(c.x)} cm, z ${Math.round(c.z)} cm`,
          })
        }
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [moveContainer, logMovement, setDragInvalid, room.grid, settings.snapEnabled])

  // ------------------------------------------------------------- pan / zoom
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  /** Live touch points, keyed by pointerId — the basis for pinch detection. */
  const touches = useRef(new Map<number, { x: number; y: number }>()).current
  const pinch = useRef<{ dist: number; cx: number; cy: number; scale: number; tx: number; ty: number } | null>(null)

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (drag.current) return
    onSelect(null)
    pan.current = { x: e.clientX, y: e.clientY, tx: cam.tx, ty: cam.ty }
  }

  /* Every touch on the surface is tracked, including ones that landed on an
     object, so a second finger can promote an in-progress drag into a pinch. */
  const onAnyPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    let raf = 0
    let last: PointerEvent | null = null

    const apply = () => {
      raf = 0
      const p = pan.current
      if (!p || !last || pinch.current) return
      setCam((c) => ({ ...c, tx: p.tx + (last!.clientX - p.x), ty: p.ty + (last!.clientY - p.y) }))
    }

    const two = () => [...touches.values()].slice(0, 2)
    const spread = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }

      /*
        Two fingers: pinch to zoom about the midpoint, and translate by however
        far that midpoint moves, so the gesture zooms and pans at once. Both
        object dragging and one-finger panning are suspended for the duration —
        otherwise the first finger keeps dragging a shelf around while the
        second one zooms.
      */
      if (touches.size >= 2) {
        const [a, b] = two()
        const dist = spread(a, b)
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        if (!pinch.current) {
          drag.current = null
          pan.current = null
          setGhost(null)
          pinch.current = { dist, cx, cy, scale: camRef.current.scale, tx: camRef.current.tx, ty: camRef.current.ty }
          return
        }
        const p = pinch.current
        if (p.dist < 1) return
        const k = Math.max(4, Math.min(2000, p.scale * (dist / p.dist))) / p.scale
        setCam(() => ({
          scale: p.scale * k,
          // Zoom about the original midpoint, then follow the midpoint drift.
          tx: p.cx - (p.cx - p.tx) * k + (cx - p.cx),
          ty: p.cy - (p.cy - p.ty) * k + (cy - p.cy),
        }))
        return
      }

      if (!pan.current) return
      last = e
      if (!raf) raf = requestAnimationFrame(apply)
    }

    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId)
      // Releasing one finger ends the pinch; the remaining finger must not
      // suddenly jump the view, so panning only resumes on a fresh press.
      if (touches.size < 2) {
        pinch.current = null
        pan.current = null
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [touches])

  const onWheel = (e: React.WheelEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setCam((c) => {
      const ns = Math.max(4, Math.min(2000, c.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
      const k = ns / c.scale
      return { scale: ns, tx: mx - (mx - c.tx) * k, ty: my - (my - c.ty) * k }
    })
  }

  // ------------------------------------------------------------------- room
  const floor = boxFace(view, { x: 0, y: 0, z: 0, w, h: 0, d: l })
  const gridPath = useMemo(() => {
    if (!settings.showGrid) return ''
    const g = Math.max(M(room.grid), 0.05)
    const out: string[] = []
    const cols = Math.min(400, Math.max(1, Math.round(w / g)))
    const rows = Math.min(400, Math.max(1, Math.round(l / g)))
    for (let i = 0; i <= cols; i++) {
      const x = (i * w) / cols
      const a = project(view, x, 0, 0), b = project(view, x, 0, l)
      out.push(`M ${a[0].toFixed(3)} ${a[1].toFixed(3)} L ${b[0].toFixed(3)} ${b[1].toFixed(3)}`)
    }
    for (let j = 0; j <= rows; j++) {
      const z = (j * l) / rows
      const a = project(view, 0, 0, z), b = project(view, w, 0, z)
      out.push(`M ${a[0].toFixed(3)} ${a[1].toFixed(3)} L ${b[0].toFixed(3)} ${b[1].toFixed(3)}`)
    }
    return out.join(' ')
  }, [settings.showGrid, room.grid, w, l, view])

  const floorCol = room.floorColor || '#f6f7fb'

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        onPointerDownCapture={onAnyPointerDown}
        onPointerDown={onBackgroundDown}
        onWheel={onWheel}
        style={{ display: 'block', touchAction: 'none' }}
      >
        <g transform={`translate(${cam.tx} ${cam.ty}) scale(${cam.scale})`}>
          {/* The room outline doubles as the wall line — seen from directly
              above a wall has no visible face, only a thickness. */}
          <polygon points={floor} fill={floorCol} stroke={INK} strokeWidth={STROKE * 2} strokeLinejoin="round" />

          {gridPath && (
            <path d={gridPath} stroke="#8d99b3" strokeOpacity={0.28} strokeWidth={0.008} fill="none"
              style={{ pointerEvents: 'none' }} />
          )}

          {ghost && (
            <polygon
              points={boxFace(view, {
                x: M(ghost.x) - M(ghost.w) / 2, y: 0, z: M(ghost.z) - M(ghost.d) / 2,
                w: M(ghost.w), h: 0, d: M(ghost.d),
              })}
              fill="#e05252" fillOpacity={0.32} style={{ pointerEvents: 'none' }}
            />
          )}

          {ordered.map((c) => {
            const agg = byContainer.get(c.id)
            return (
              <PlanObject
                key={c.id}
                container={c}
                fill={c.capacity ? (agg?.slots ?? 0) / c.capacity : 0}
                count={agg?.count ?? 0}
                view={view}
                selected={selectedId === c.id}
                hovered={hoveredId === c.id}
                revealed={revealedId === c.id}
                showLabel={settings.showLabels}
                showBadge={settings.showFillBadges}
                onPick={onPick}
                onHover={onHover}
                onOpen={onOpen}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
