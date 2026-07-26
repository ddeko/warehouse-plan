import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import {
  Copy, Grid3x3, Magnet, Pencil, Plus, Trash2, Layers, Sparkles, ShieldAlert,
  Maximize2, Minus, Search, Sofa, LayoutList, Home, Tag, Eye, PanelRight, Orbit,
  Building2, DoorOpen,
} from 'lucide-react'
import type { Room } from '../types'
import { CONTAINER_META } from '../types'
import { useStore, containerStats } from '../store'
import { PlanScene } from '../svg/PlanScene'
import { CAMERA_PRESETS } from '../lib/viewpoints'

/* three.js is ~900 KB of the bundle and only the optional WebGL view needs it,
   so it is fetched on demand the first time that view is selected. */
const Scene = lazy(() => import('../three/Scene').then((m) => ({ default: m.Scene })))
import { ContainerInspector } from '../components/ContainerInspector'
import { CatalogPanel } from '../components/CatalogPanel'
import { TypeIcon } from '../components/TypeIcon'
import { RoomForm } from '../components/RoomForm'
import { Bar, Confirm, Empty, Select } from '../components/ui'
import { areaM2, cx, fmtLen, fmtNum } from '../lib/utils'
import { usedFloorArea } from '../lib/geometry'

/* ------------------------------------------------------------------ panels */

function RoomsPanel({ onClose, onEdit, onDelete, onAddRoom }: {
  onClose: () => void
  onEdit: (r: Room) => void
  onDelete: (id: string) => void
  onAddRoom: () => void
}) {
  const sites = useStore((s) => s.sites)
  const setActiveSite = useStore((s) => s.setActiveSite)
  const rooms = useStore((s) => s.rooms)
  const containers = useStore((s) => s.containers)
  const items = useStore((s) => s.items)
  const activeRoomId = useStore((s) => s.activeRoomId)
  const setActiveRoom = useStore((s) => s.setActiveRoom)
  const duplicateRoom = useStore((s) => s.duplicateRoom)
  const units = useStore((s) => s.settings.units)

  return (
    <div className="float pop-in flex w-[min(270px,calc(100vw-7rem))] flex-col overflow-hidden" style={{ maxHeight: '100%' }}>
      <header className="flex items-center justify-between border-b hairline px-3 py-2.5">
        <p className="text-[13px] font-semibold">Sites &amp; rooms</p>
        <button className="btn btn-ghost btn-sm" onClick={onClose} title="Close">✕</button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {sites.map((site) => (
          <div key={site.id}>
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <Building2 size={12} className="muted" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{site.name}</span>
              <span className="mono text-[10px] muted">{site.code}</span>
              <button className="btn btn-ghost btn-sm" title="Add room here"
                onClick={(e) => { e.stopPropagation(); setActiveSite(site.id); onAddRoom() }}><Plus size={11} /></button>
            </div>
            <div className="space-y-1.5">
        {rooms.filter((r) => r.siteId === site.id).map((r) => {
          const list = containers.filter((c) => c.roomId === r.id)
          const ids = new Set(list.map((c) => c.id))
          const lines = items.filter((i) => ids.has(i.containerId)).length
          const ratio = usedFloorArea(list) / (r.width * r.length)
          const active = r.id === activeRoomId
          return (
            <div
              key={r.id}
              onClick={() => setActiveRoom(r.id)}
              className={cx('cursor-pointer rounded-xl border p-2.5 transition-colors',
                active ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'hairline hover:bg-[var(--panel-2)]')}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold">{r.name}</p>
                  <p className="mono truncate text-[10.5px] muted">
                    {r.code} · {fmtLen(r.width, units)} × {fmtLen(r.length, units)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(r) }} title="Edit"><Pencil size={11} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); duplicateRoom(r.id) }} title="Duplicate"><Copy size={11} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(r.id) }} title="Delete"><Trash2 size={11} /></button>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10.5px] muted">
                <span>{list.length} objects · {lines} lines</span>
                <span>{Math.round(ratio * 100)}% floor</span>
              </div>
              <div className="mt-1"><Bar ratio={ratio} height={4} /></div>
            </div>
          )
        })}
            </div>
            {!rooms.some((r) => r.siteId === site.id) && (
              <p className="px-1 py-1.5 text-[11px] muted">No rooms at this site yet.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ObjectsPanel({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const containers = useStore((s) => s.containers)
  const items = useStore((s) => s.items)
  const selectContainer = useStore((s) => s.selectContainer)
  const selectedId = useStore((s) => s.selectedContainerId)
  const units = useStore((s) => s.settings.units)
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const all = containers.filter((c) => c.roomId === roomId)
    const s = q.trim().toLowerCase()
    return s ? all.filter((c) => `${c.code} ${c.name} ${c.type}`.toLowerCase().includes(s)) : all
  }, [containers, roomId, q])

  return (
    <div className="float pop-in flex w-[min(270px,calc(100vw-7rem))] flex-col overflow-hidden" style={{ maxHeight: '100%' }}>
      <header className="flex items-center justify-between border-b hairline px-3 py-2.5">
        <p className="text-[13px] font-semibold">Objects <span className="muted font-normal">({list.length})</span></p>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </header>
      <div className="border-b hairline p-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 muted" />
          <input className="input pl-8" placeholder="Filter objects…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {list.map((c) => {
          const st = containerStats(items, c)
          return (
            <li key={c.id}>
              <button
                className={cx('flex w-full items-center gap-2 rounded-lg p-1.5 text-left',
                  selectedId === c.id ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--panel-2)]')}
                onClick={() => selectContainer(c.id)}
              >
                <TypeIcon type={c.type} size={26} color={c.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{c.name}</span>
                  <span className="mono block truncate text-[10px] muted">
                    {c.code} · {fmtLen(c.w, units, false)}×{fmtLen(c.d, units, false)}×{fmtLen(c.h, units, false)}
                  </span>
                </span>
                {!CONTAINER_META[c.type].obstacle && (
                  <span className="w-10 shrink-0">
                    <span className="mb-0.5 block text-right text-[9.5px] tabular-nums muted">{Math.round(st.fill * 100)}%</span>
                    <Bar ratio={st.fill} height={3} />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------- view */

export function RoomsView() {
  const sites = useStore((s) => s.sites)
  const activeSiteId = useStore((s) => s.activeSiteId)
  const setActiveSite = useStore((s) => s.setActiveSite)
  const rooms = useStore((s) => s.rooms)
  const containers = useStore((s) => s.containers)
  const items = useStore((s) => s.items)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const activeRoomId = useStore((s) => s.activeRoomId)
  const setActiveRoom = useStore((s) => s.setActiveRoom)
  const selectedContainerId = useStore((s) => s.selectedContainerId)
  const revealedContainerId = useStore((s) => s.revealedContainerId)
  const selectContainer = useStore((s) => s.selectContainer)
  const setInspectorTab = useStore((s) => s.setInspectorTab)
  const cameraPreset = useStore((s) => s.cameraPreset)
  const setCameraPreset = useStore((s) => s.setCameraPreset)
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const freeOrbit = useStore((s) => s.freeOrbit)
  const setFreeOrbit = useStore((s) => s.setFreeOrbit)
  const leftPanel = useStore((s) => s.leftPanel)
  const toggleLeftPanel = useStore((s) => s.toggleLeftPanel)
  const inspectorOpen = useStore((s) => s.inspectorOpen)
  const setInspectorOpen = useStore((s) => s.setInspectorOpen)
  const toggleInspector = useStore((s) => s.toggleInspector)
  const removeRoom = useStore((s) => s.removeRoom)
  const autoArrange = useStore((s) => s.autoArrange)
  const moveContainer = useStore((s) => s.moveContainer)
  const rotateContainer = useStore((s) => s.rotateContainer)
  const removeContainer = useStore((s) => s.removeContainer)
  const duplicateContainer = useStore((s) => s.duplicateContainer)
  const loadSample = useStore((s) => s.loadSample)

  const [roomFormOpen, setRoomFormOpen] = useState(false)
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null)
  const [zoomCmd, setZoomCmd] = useState({ n: 0, dir: 0 })
  const [fitTick, setFitTick] = useState(0)

  const siteRooms = useMemo(
    () => (activeSiteId ? rooms.filter((r) => r.siteId === activeSiteId) : rooms),
    [rooms, activeSiteId],
  )
  const room = siteRooms.find((r) => r.id === activeRoomId) ?? siteRooms[0] ?? null

  useEffect(() => {
    if (!activeSiteId && sites[0]) { setActiveSite(sites[0].id); return }
    if (!activeRoomId && siteRooms[0]) setActiveRoom(siteRooms[0].id)
  }, [activeSiteId, sites, activeRoomId, siteRooms, setActiveSite, setActiveRoom])

  const roomContainers = useMemo(
    () => (room ? containers.filter((c) => c.roomId === room.id) : []),
    [containers, room],
  )
  const roomItems = useMemo(() => {
    const ids = new Set(roomContainers.map((c) => c.id))
    return items.filter((i) => ids.has(i.containerId))
  }, [items, roomContainers])

  const selected = roomContainers.find((c) => c.id === selectedContainerId) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (!selected) {
        if (e.key === 'Escape') selectContainer(null)
        return
      }
      const step = e.shiftKey ? (room?.grid ?? 10) * 5 : room?.grid ?? 10
      const nudge = (dx: number, dz: number) => {
        e.preventDefault()
        moveContainer(selected.id, selected.x + dx, selected.z + dz)
      }
      switch (e.key) {
        case 'ArrowLeft': nudge(-step, 0); break
        case 'ArrowRight': nudge(step, 0); break
        case 'ArrowUp': nudge(0, -step); break
        case 'ArrowDown': nudge(0, step); break
        case 'r': case 'R': rotateContainer(selected.id); break
        case 'Delete': case 'Backspace': removeContainer(selected.id); break
        case 'Escape': selectContainer(null); break
        case 'd': case 'D':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); duplicateContainer(selected.id) }
          break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, room, moveContainer, rotateContainer, removeContainer, duplicateContainer, selectContainer])

  if (!rooms.length) {
    return (
      <div className="h-full">
        <Empty
          title="No rooms yet"
          hint="Create a room by entering its width, length and height — then drop shelves, racks, fridges and pallets inside and drag them into place."
          action={
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => { setEditRoom(null); setRoomFormOpen(true) }}><Plus size={14} /> New room</button>
              <button className="btn" onClick={loadSample}><Sparkles size={14} /> Load sample warehouse</button>
            </div>
          }
        />
        <RoomForm open={roomFormOpen} onClose={() => setRoomFormOpen(false)} room={editRoom} />
      </div>
    )
  }

  const stats = room
    ? {
        floor: usedFloorArea(roomContainers) / (room.width * room.length),
        area: areaM2(room.width, room.length),
      }
    : null

  return (
    <div className="relative flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      {/* ------------------------------------------------------------ topbar */}
      <header className="flex h-[54px] min-w-0 shrink-0 items-center gap-1.5 border-b hairline px-2 sm:gap-2 sm:px-3" style={{ background: 'var(--panel)' }}>
        {/* Site → room, so it is always clear which location you are editing. */}
        {/* Below `sm` there is not room for both halves of the breadcrumb without
            the room name colliding with the buttons beside it. The site drops
            out rather than being truncated to nothing — it is still switchable
            from the Sites & rooms panel, and the room is what you actually
            change while laying out. */}
        <div className="hidden min-w-0 shrink items-center gap-1.5 sm:flex">
          <Building2 size={15} className="shrink-0 muted" />
          <Select
            className="w-[130px] font-medium lg:w-[176px]"
            value={activeSiteId ?? ''}
            onChange={setActiveSite}
            options={sites.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
            title="Site / location"
            ariaLabel="Site"
          />
        </div>

        <span className="hidden shrink-0 muted sm:inline">/</span>

        {/* Room names run longer than site names ("RM-01 — Parts & Tool Room"),
            so this one gets the extra width — and all of it on a phone. */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
          <DoorOpen size={15} className="hidden shrink-0 muted sm:block" />
          <Select
            className="w-full font-medium sm:w-[200px] lg:w-[240px]"
            value={room?.id ?? ''}
            onChange={setActiveRoom}
            options={siteRooms.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }))}
            title="Room"
            ariaLabel="Room"
          />
        </div>

        <button className="btn btn-sm btn-icon shrink-0" onClick={() => { setEditRoom(room); setRoomFormOpen(true) }} title="Edit this room's size and colours">
          <Pencil size={14} />
        </button>
        <button className="btn btn-sm btn-icon shrink-0" onClick={() => { setEditRoom(null); setRoomFormOpen(true) }} title="Add a room to this site">
          <Plus size={14} />
        </button>

        {/* Pushes the stats and the panel toggle to the right. A spacer rather
            than `ml-auto` on both: two auto margins split the free space between
            them, which left the toggle floating in the middle of the bar. On a
            phone the room select already claims the slack, so this collapses. */}
        <div className="hidden min-w-0 flex-1 sm:block" />

        {stats && (
          <span className="hidden shrink-0 items-center gap-3 text-[11.5px] muted xl:flex">
            <span>{roomContainers.length} objects</span>
            <span>{roomItems.length} lines</span>
            <span>{fmtNum(stats.area, 1)} m² · {Math.round(stats.floor * 100)}% used</span>
          </span>
        )}
        <button
          className={cx('btn btn-sm btn-icon shrink-0', inspectorOpen && 'btn-active')}
          onClick={toggleInspector}
          title={inspectorOpen ? 'Hide properties panel' : 'Show properties panel'}
          aria-pressed={inspectorOpen}
        >
          <PanelRight size={14} />
        </button>
      </header>

      {/* ---------------------------------------------------------- workspace */}
      {/* `relative` anchors the inspector drawer and its scrim below `lg`. */}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1">
        {room && viewMode !== 'webgl' && (
          <PlanScene
            room={room}
            containers={roomContainers}
            items={roomItems}
            settings={settings}
            selectedId={selectedContainerId}
            revealedId={revealedContainerId}
            onSelect={selectContainer}
            onOpenItems={(id) => { selectContainer(id); setInspectorTab('items'); setInspectorOpen(true) }}
            preset={cameraPreset}
            zoomCmd={zoomCmd}
            fitTick={fitTick}
          />
        )}
        {room && viewMode === 'webgl' && (
          <Suspense fallback={<div className="grid h-full place-items-center text-[12px] muted">Loading 3D engine…</div>}>
          <Scene
            room={room}
            containers={roomContainers}
            items={roomItems}
            settings={settings}
            selectedId={selectedContainerId}
            revealedId={revealedContainerId}
            onSelect={selectContainer}
            onOpenItems={(id) => { selectContainer(id); setInspectorTab('items'); setInspectorOpen(true) }}
            preset={cameraPreset}
            mode="3d"
            zoomCmd={zoomCmd}
            fitTick={fitTick}
            freeOrbit={freeOrbit}
          />
          </Suspense>
        )}

        {/*
          Tool rail over the canvas.

          `pointer-events-auto` belongs on the floating cards themselves, never
          on the columns holding them. A column stretches the full height of the
          viewport, so putting it there turned a transparent strip down each
          edge of the canvas into a click sink — objects underneath could not be
          selected or dragged there.
        */}
        <div className="pointer-events-none absolute inset-0 flex">
          <div className="flex flex-col gap-1.5 p-2 sm:p-3">
            <div className="float pointer-events-auto flex flex-col gap-1 p-1.5">
              <button className="rail-btn" data-active={leftPanel === 'rooms'} onClick={() => toggleLeftPanel('rooms')} title="Sites & rooms"><Home size={17} /></button>
              <button className="rail-btn" data-active={leftPanel === 'catalog'} onClick={() => toggleLeftPanel('catalog')} title="Add furniture"><Sofa size={17} /></button>
              <button className="rail-btn" data-active={leftPanel === 'objects'} onClick={() => toggleLeftPanel('objects')} title="Objects in room"><LayoutList size={17} /></button>
            </div>
          </div>

          {/* Panels stop short of the bottom so they never run into the hint strip. */}
          <div className="pointer-events-auto min-h-0 py-2 pr-2 sm:py-3 sm:pr-3" style={{ maxHeight: 'calc(100% - 56px)' }}>
            {leftPanel === 'rooms' && (
              <RoomsPanel
                onClose={() => toggleLeftPanel('rooms')}
                onEdit={(r) => { setEditRoom(r); setRoomFormOpen(true) }}
                onDelete={(id) => setDeleteRoomId(id)}
                onAddRoom={() => { setEditRoom(null); setRoomFormOpen(true) }}
              />
            )}
            {leftPanel === 'catalog' && room && <CatalogPanel roomId={room.id} onClose={() => toggleLeftPanel('catalog')} />}
            {leftPanel === 'objects' && room && <ObjectsPanel roomId={room.id} onClose={() => toggleLeftPanel('objects')} />}
          </div>

          <div className="flex-1" />

          {/*
            Right-hand viewport controls.

            The scrollable stack is the `pointer-events-auto` element, not the
            column around it: a full-height column would turn a transparent
            strip down the canvas edge into a click sink, while the stack only
            covers the buttons themselves. It has to scroll because the toggle
            group alone is taller than a landscape phone.
          */}
          {/* Bottom padding reserves the strip the viewpoint buttons occupy, so
              the scrolling stack stops above them instead of running underneath. */}
          <div className="flex min-h-0 flex-col items-end p-2 pb-14 sm:p-3 sm:pb-16">
            <div className="viewport-rail pointer-events-auto flex min-h-0 flex-col items-end gap-1.5 overflow-y-auto">
            <div className="float pointer-events-auto flex flex-col overflow-hidden">
              {([
                { m: 'plan' as const, label: '2D', title: 'Top-down floor plan — true shape, no heights' },
                { m: 'webgl' as const, label: '3D', title: 'WebGL scene — real perspective camera, so boxes read as solid boxes' },
              ]).map(({ m, label, title }) => (
                <button
                  key={m}
                  className={cx('px-3 py-1.5 text-[11.5px] font-semibold', viewMode === m ? 'text-white' : 'muted')}
                  style={viewMode === m ? { background: 'var(--accent)' } : undefined}
                  onClick={() => setViewMode(m)}
                  title={title}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="float pointer-events-auto flex flex-col gap-1 p-1.5">
              <button className="rail-btn h-8 w-8" onClick={() => setZoomCmd((c) => ({ n: c.n + 1, dir: 1 }))} title="Zoom in"><Plus size={16} /></button>
              <button className="rail-btn h-8 w-8" onClick={() => setZoomCmd((c) => ({ n: c.n + 1, dir: -1 }))} title="Zoom out"><Minus size={16} /></button>
              <button className="rail-btn h-8 w-8" onClick={() => setFitTick((t) => t + 1)} title="Fit room to view"><Maximize2 size={15} /></button>
            </div>

            {/* Scene toggles, moved off the top bar so the header only carries
                the site → room breadcrumb. */}
            <div className="float pointer-events-auto flex flex-col gap-1 p-1.5">
              <button className="rail-btn h-8 w-8" data-active={settings.snapEnabled} onClick={() => updateSettings({ snapEnabled: !settings.snapEnabled })} title="Snap to grid"><Magnet size={15} /></button>
              <button className="rail-btn h-8 w-8" data-active={settings.collisionEnabled} onClick={() => updateSettings({ collisionEnabled: !settings.collisionEnabled })} title="Collision detection"><ShieldAlert size={15} /></button>
              <button className="rail-btn h-8 w-8" data-active={settings.showGrid} onClick={() => updateSettings({ showGrid: !settings.showGrid })} title="Floor grid"><Grid3x3 size={15} /></button>
              <button className="rail-btn h-8 w-8" data-active={settings.showLabels} onClick={() => updateSettings({ showLabels: !settings.showLabels })} title="Object labels"><Tag size={15} /></button>
              <button className="rail-btn h-8 w-8" data-active={settings.showFillBadges} onClick={() => updateSettings({ showFillBadges: !settings.showFillBadges })} title="Fill badges"><Eye size={15} /></button>
              <button className="rail-btn h-8 w-8" data-active={settings.showWalls} onClick={() => updateSettings({ showWalls: !settings.showWalls })} title="Walls"><Home size={15} /></button>

              <span className="my-0.5 h-px w-full" style={{ background: 'var(--line)' }} />

              <button className="rail-btn h-8 w-8" onClick={() => room && autoArrange(room.id)} title="Auto-arrange: pack objects into tidy rows"><Layers size={15} /></button>
              {viewMode === 'webgl' && (
                <button
                  className="rail-btn h-8 w-8"
                  data-active={freeOrbit}
                  onClick={() => setFreeOrbit(!freeOrbit)}
                  title={freeOrbit ? 'Free orbit on — click to lock back to isometric' : 'Isometric locked — click to orbit freely'}
                >
                  <Orbit size={15} />
                </button>
              )}
            </div>

            </div>
          </div>

          {/*
            Viewpoint buttons, pinned to the bottom-right of the canvas.

            Deliberately outside the scrolling toolbar stack. Inside it they
            rode up and down with however many toggles happened to be showing,
            and a flex spacer only pins them while there is slack to absorb —
            the moment the stack overflowed they were pushed off instead.
            Anchoring to the viewport edge is the only thing that holds at
            every height.
          */}
          {viewMode !== 'plan' && (
            <div className="float pointer-events-auto absolute bottom-2 right-2 flex gap-1 p-1.5 sm:bottom-3 sm:right-3">
              {CAMERA_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  className={cx('h-7 w-8 rounded-lg text-[10.5px] font-bold transition-colors',
                    cameraPreset === i ? 'text-[var(--accent)]' : 'muted hover:bg-[var(--panel-2)]')}
                  style={cameraPreset === i ? { background: 'var(--accent-soft)' } : undefined}
                  onClick={() => setCameraPreset(i)}
                  title={`View from ${p.label}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hint strip. `whitespace-nowrap` matters: a centred absolute element is
            width-constrained to the half-width it sits in, so without it the
            text wrapped to two lines and grew up into the panels. */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] muted md:block"
          style={{ background: 'color-mix(in srgb, var(--panel) 90%, transparent)', border: '1px solid var(--line)' }}>
          <b className="font-semibold text-[var(--text)]">Drag</b> move ·
          {' '}<b className="font-semibold text-[var(--text)]">R</b> rotate ·
          {' '}<b className="font-semibold text-[var(--text)]">Ctrl+D</b> copy ·
          {' '}<b className="font-semibold text-[var(--text)]">Del</b> remove ·
          {' '}<b className="font-semibold text-[var(--text)]">Dbl-click</b> items
        </div>
        </div>

        {/* ------------------------------------------------------- inspector */}
        {/*
          A docked column from `lg` up: the canvas simply gives up the width and
          nothing can collide. Below that a 320 px column would leave almost no
          canvas, so it becomes an overlay drawer with a dismissable scrim.
        */}
        {inspectorOpen && (
          <div
            className="absolute inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setInspectorOpen(false)}
            aria-hidden
          />
        )}
        {inspectorOpen && (
          <aside
            className="absolute inset-y-0 right-0 z-40 flex w-[min(340px,100%)] shrink-0 flex-col overflow-hidden border-l hairline shadow-2xl lg:static lg:z-auto lg:w-[320px] lg:shadow-none"
            style={{ background: 'var(--panel)' }}
          >
            {/* Closing from inside matters on the drawer, where the header
                button can be a long reach away on a phone. */}
            <div className="flex shrink-0 items-center justify-between border-b hairline px-3 py-2 lg:hidden">
              <p className="text-[12px] font-semibold">Properties</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setInspectorOpen(false)} aria-label="Close properties">✕</button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {selected ? (
                <ContainerInspector container={selected} />
              ) : (
                <div className="p-4 text-center">
                  <p className="text-[12.5px] font-medium">Nothing selected</p>
                  <p className="mt-1 text-[11.5px] muted">Click an object in the room to edit its size, position and contents.</p>
                  <button className="btn btn-primary mt-3 w-full" onClick={() => useStore.getState().setLeftPanel('catalog')}>
                    <Plus size={13} /> Add an object
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

      </div>

      <RoomForm open={roomFormOpen} onClose={() => setRoomFormOpen(false)} room={editRoom} />
      <Confirm
        open={!!deleteRoomId}
        onClose={() => setDeleteRoomId(null)}
        onConfirm={() => deleteRoomId && removeRoom(deleteRoomId)}
        title="Delete room?"
        message="All objects inside this room and their inventory lines are deleted as well."
      />
    </div>
  )
}
