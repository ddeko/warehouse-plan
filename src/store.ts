import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppData, Container, ContainerType, ID, Item, Movement, MovementType, Room, Rotation, Settings, Site,
} from './types'
import { CONTAINER_META } from './types'
import { checkPlacement, clampToRoom, findFreeSpot, footprint, snap } from './lib/geometry'
import { generateBarcode, nextCode, todayISO, uid } from './lib/utils'
import { buildSeed } from './lib/seed'

export const ROOM_FLOOR = '#f6f7fb'
export const ROOM_WALL = '#eef1f8'

export const DEFAULT_SETTINGS: Settings = {
  units: 'cm',
  snapEnabled: true,
  showGrid: true,
  showWalls: true,
  // Off by default: on a full room, a label per object buries the drawing.
  // The toolbar toggles them back on when you need to read codes.
  showLabels: false,
  showFillBadges: true,
  collisionEnabled: true,
  wallClearance: 0,
  operator: 'operator',
  currency: 'USD',
  expiryWarnDays: 30,
  theme: 'light',
}

export type View = 'dashboard' | 'rooms' | 'inventory' | 'movements' | 'reports' | 'data'
export type LeftPanel = 'rooms' | 'catalog' | 'objects' | null

interface UIState {
  view: View
  activeSiteId: ID | null
  activeRoomId: ID | null
  selectedContainerId: ID | null
  inspectorTab: 'object' | 'items'
  cameraPreset: number
  /** 'plan' is the SVG floor plan; 'webgl' is the three.js perspective scene. */
  viewMode: 'plan' | 'webgl'
  /** Off keeps the camera pinned to the preset elevation. */
  freeOrbit: boolean
  leftPanel: LeftPanel
  inspectorOpen: boolean
  /** live placement feedback while dragging in the 3D view */
  dragInvalid: boolean
  toast: { id: string; msg: string; kind: 'ok' | 'warn' | 'err' } | null
}

interface Store extends AppData, UIState {
  // --- ui -----------------------------------------------------------------
  setView: (v: View) => void
  setActiveSite: (id: ID | null) => void
  setActiveRoom: (id: ID | null) => void
  selectContainer: (id: ID | null) => void
  setInspectorTab: (t: 'object' | 'items') => void
  setCameraPreset: (n: number) => void
  setViewMode: (m: 'plan' | 'webgl') => void
  setFreeOrbit: (b: boolean) => void
  setLeftPanel: (p: LeftPanel) => void
  toggleLeftPanel: (p: Exclude<LeftPanel, null>) => void
  setInspectorOpen: (b: boolean) => void
  setDragInvalid: (b: boolean) => void
  notify: (msg: string, kind?: 'ok' | 'warn' | 'err') => void
  dismissToast: () => void

  // --- settings -----------------------------------------------------------
  updateSettings: (patch: Partial<Settings>) => void

  // --- sites --------------------------------------------------------------
  addSite: (patch?: Partial<Site>) => Site
  updateSite: (id: ID, patch: Partial<Site>) => void
  removeSite: (id: ID) => void

  // --- rooms --------------------------------------------------------------
  addRoom: (patch?: Partial<Room>) => Room
  updateRoom: (id: ID, patch: Partial<Room>) => void
  removeRoom: (id: ID) => void
  duplicateRoom: (id: ID) => void

  // --- containers ---------------------------------------------------------
  addContainer: (roomId: ID, type: ContainerType, patch?: Partial<Container>) => Container | null
  updateContainer: (id: ID, patch: Partial<Container>) => void
  moveContainer: (id: ID, x: number, z: number, opts?: { commit?: boolean }) => boolean
  rotateContainer: (id: ID) => void
  removeContainer: (id: ID) => void
  duplicateContainer: (id: ID) => void
  autoArrange: (roomId: ID) => void
  /** true when the container currently overlaps something / leaves the room */
  isPlacementValid: (c: Container) => boolean

  // --- items --------------------------------------------------------------
  addItem: (containerId: ID, patch?: Partial<Item>) => Item
  updateItem: (id: ID, patch: Partial<Item>) => void
  removeItem: (id: ID) => void
  transferItem: (id: ID, toContainerId: ID, qty?: number) => void
  adjustQty: (id: ID, delta: number, type?: MovementType, note?: string) => void

  // --- movements ----------------------------------------------------------
  logMovement: (m: Omit<Movement, 'id' | 'ts' | 'user'> & Partial<Pick<Movement, 'ts' | 'user'>>) => void
  clearMovements: () => void

  // --- data ---------------------------------------------------------------
  exportData: () => AppData
  importData: (data: Partial<AppData>, mode: 'replace' | 'merge') => void
  loadSample: () => void
  resetAll: () => void
}

const emptyData = (): AppData => ({
  sites: [], rooms: [], containers: [], items: [], movements: [], settings: { ...DEFAULT_SETTINGS },
})

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      view: 'dashboard',
      activeSiteId: null,
      activeRoomId: null,
      selectedContainerId: null,
      inspectorTab: 'object',
      cameraPreset: 0,
      viewMode: 'plan',
      freeOrbit: false,
      leftPanel: null,
      inspectorOpen: true,
      dragInvalid: false,
      toast: null,

      setView: (view) => set({ view }),
      /** Switching site follows through to that site's first room. */
      setActiveSite: (activeSiteId) => {
        const first = get().rooms.find((r) => r.siteId === activeSiteId)
        set({ activeSiteId, activeRoomId: first?.id ?? null, selectedContainerId: null })
      },
      setActiveRoom: (activeRoomId) => {
        const room = get().rooms.find((r) => r.id === activeRoomId)
        set({ activeRoomId, activeSiteId: room?.siteId ?? get().activeSiteId, selectedContainerId: null })
      },
      selectContainer: (selectedContainerId) => set({ selectedContainerId }),
      setInspectorTab: (inspectorTab) => set({ inspectorTab }),
      setCameraPreset: (cameraPreset) => set({ cameraPreset }),
      setViewMode: (viewMode) => set({ viewMode }),
      setFreeOrbit: (freeOrbit) => set({ freeOrbit }),
      setLeftPanel: (leftPanel) => set({ leftPanel }),
      toggleLeftPanel: (p) => set((s) => ({ leftPanel: s.leftPanel === p ? null : p })),
      setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
      setDragInvalid: (dragInvalid) => set({ dragInvalid }),
      notify: (msg, kind = 'ok') => {
        const id = uid()
        set({ toast: { id, msg, kind } })
        setTimeout(() => {
          if (get().toast?.id === id) set({ toast: null })
        }, 2600)
      },
      dismissToast: () => set({ toast: null }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      // ---------------------------------------------------------------- sites
      addSite: (patch = {}) => {
        const sites = get().sites
        const site: Site = {
          id: uid('site'),
          code: '',
          name: `Site ${sites.length + 1}`,
          kind: 'warehouse',
          createdAt: Date.now(),
          ...patch,
        }
        if (!site.code.trim()) site.code = nextCode('ST', sites.map((s) => s.code))
        if (!site.name.trim()) site.name = `Site ${sites.length + 1}`
        set((s) => ({ sites: [...s.sites, site], activeSiteId: site.id }))
        return site
      },

      updateSite: (id, patch) => {
        set((s) => ({ sites: s.sites.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      },

      removeSite: (id) => {
        const s = get()
        const roomIds = new Set(s.rooms.filter((r) => r.siteId === id).map((r) => r.id))
        const containerIds = new Set(s.containers.filter((c) => roomIds.has(c.roomId)).map((c) => c.id))
        const remainingSites = s.sites.filter((x) => x.id !== id)
        const nextSiteId = s.activeSiteId === id ? remainingSites[0]?.id ?? null : s.activeSiteId
        set({
          sites: remainingSites,
          rooms: s.rooms.filter((r) => !roomIds.has(r.id)),
          containers: s.containers.filter((c) => !containerIds.has(c.id)),
          items: s.items.filter((i) => !containerIds.has(i.containerId)),
          activeSiteId: nextSiteId,
          activeRoomId: s.rooms.find((r) => r.siteId === nextSiteId)?.id ?? null,
          selectedContainerId: null,
        })
        get().notify('Site deleted', 'warn')
      },

      // ---------------------------------------------------------------- rooms
      addRoom: (patch = {}) => {
        const rooms = get().rooms
        const room: Room = {
          id: uid('room'),
          // A room must belong to a site; fall back to the active one, then to
          // the first, creating a default site if the project has none yet.
          siteId: patch.siteId ?? get().activeSiteId ?? get().sites[0]?.id ?? get().addSite({ name: 'Main site' }).id,
          code: '',
          name: `Room ${rooms.length + 1}`,
          width: 800,
          length: 600,
          height: 300,
          grid: 10,
          floorColor: ROOM_FLOOR,
          wallColor: ROOM_WALL,
          zone: 'A',
          createdAt: Date.now(),
          ...patch,
        }
        // Forms submit an empty code to mean "auto", so assign after merging.
        if (!room.code.trim()) {
          const siblings = rooms.filter((r) => r.siteId === room.siteId).map((r) => r.code)
          room.code = nextCode('RM', siblings)
        }
        if (!room.name.trim()) room.name = `Room ${rooms.length + 1}`
        set((s) => ({ rooms: [...s.rooms, room], activeRoomId: room.id, activeSiteId: room.siteId }))
        return room
      },

      updateRoom: (id, patch) => {
        set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
        const room = get().rooms.find((r) => r.id === id)
        if (!room) return

        const s = get()
        const opts = { collision: s.settings.collisionEnabled, clearance: s.settings.wallClearance }

        /*
         * Shrinking a room has to re-home everything that no longer fits.
         * Clamping each object independently — the previous behaviour — pushes
         * them all against the same edge and silently stacks them on top of one
         * another, which is what turns a tidy plan into a pile of overlapping
         * racks. Re-place them one at a time against the objects already
         * settled, largest first so the big items get the good spots.
         */
        const inRoom = s.containers.filter((c) => c.roomId === id)
        const others = s.containers.filter((c) => c.roomId !== id)
        const order = [...inRoom].sort((a, b) => {
          const fa = footprint(a), fb = footprint(b)
          return fb.w * fb.d - fa.w * fa.d
        })

        const settled: Container[] = []
        let displaced = 0
        for (const c of order) {
          const h = Math.max(1, Math.min(c.h, room.height))
          const y = Math.max(0, Math.min(c.y, room.height - h))
          const p = clampToRoom(footprint(c), room, s.settings.wallClearance)
          let next: Container = { ...c, h, y, x: p.x, z: p.z }
          const canCollide = opts.collision && !CONTAINER_META[c.type].obstacle
          if (canCollide && !checkPlacement(next, settled, room, { ...opts, collision: true }).ok) {
            const spot = findFreeSpot(next, settled, room, { ...opts, collision: true, grid: room.grid })
            if (spot) next = { ...next, x: spot.x, z: spot.z }
            else displaced++
          }
          settled.push(next)
        }

        const byId = new Map(settled.map((c) => [c.id, c]))
        set({ containers: [...others, ...inRoom.map((c) => byId.get(c.id) ?? c)] })
        if (displaced > 0) {
          get().notify(`${displaced} object(s) no longer fit and are overlapping`, 'warn')
        }
      },

      removeRoom: (id) => {
        const containerIds = get().containers.filter((c) => c.roomId === id).map((c) => c.id)
        set((s) => ({
          rooms: s.rooms.filter((r) => r.id !== id),
          containers: s.containers.filter((c) => c.roomId !== id),
          items: s.items.filter((i) => !containerIds.includes(i.containerId)),
          activeRoomId: s.activeRoomId === id ? null : s.activeRoomId,
          selectedContainerId: null,
        }))
      },

      duplicateRoom: (id) => {
        const s = get()
        const src = s.rooms.find((r) => r.id === id)
        if (!src) return
        const room: Room = {
          ...src,
          id: uid('room'),
          code: nextCode('RM', s.rooms.map((r) => r.code)),
          name: `${src.name} (copy)`,
          createdAt: Date.now(),
        }
        const containers: Container[] = []
        const items: Item[] = []
        for (const c of s.containers.filter((c) => c.roomId === id)) {
          const nc: Container = { ...c, id: uid('cnt'), roomId: room.id, createdAt: Date.now() }
          containers.push(nc)
          for (const it of s.items.filter((i) => i.containerId === c.id)) {
            items.push({ ...it, id: uid('itm'), containerId: nc.id, createdAt: Date.now(), updatedAt: Date.now() })
          }
        }
        set((st) => ({
          rooms: [...st.rooms, room],
          containers: [...st.containers, ...containers],
          items: [...st.items, ...items],
          activeRoomId: room.id,
        }))
        get().notify(`Duplicated ${src.name}`)
      },

      // ----------------------------------------------------------- containers
      addContainer: (roomId, type, patch = {}) => {
        const s = get()
        const room = s.rooms.find((r) => r.id === roomId)
        if (!room) return null
        const meta = CONTAINER_META[type]
        const w = patch.w ?? meta.size[0]
        const d = patch.d ?? meta.size[1]
        const h = patch.h ?? Math.min(meta.size[2], room.height)
        const prefix = type.slice(0, 3).toUpperCase()
        const draft: Container = {
          id: uid('cnt'),
          roomId,
          code: '',
          name: meta.label,
          type,
          x: room.width / 2,
          z: room.length / 2,
          y: 0,
          w, d, h,
          rotation: 0,
          color: meta.color,
          levels: meta.levels ?? 1,
          capacity: meta.capacity ?? 10,
          tempC: meta.tempC,
          zone: room.zone,
          locked: false,
          createdAt: Date.now(),
          ...patch,
        }
        if (!draft.code.trim()) draft.code = nextCode(prefix, s.containers.map((c) => c.code))
        if (!draft.name.trim()) draft.name = meta.label
        const spot = findFreeSpot(draft, s.containers, room, {
          collision: s.settings.collisionEnabled && !meta.obstacle,
          clearance: s.settings.wallClearance,
          grid: s.settings.snapEnabled ? room.grid : 10,
        })
        if (!spot) {
          get().notify('No free floor space left in this room', 'err')
          return null
        }
        const container: Container = { ...draft, x: spot.x, z: spot.z }
        set((st) => ({ containers: [...st.containers, container], selectedContainerId: container.id, inspectorTab: 'object' }))
        get().logMovement({
          type: 'relocate', name: `${container.code} ${container.name} created`, qty: 0,
          toContainerId: container.id, roomId, note: 'Object added to room',
        })
        return container
      },

      updateContainer: (id, patch) => {
        const s = get()
        const cur = s.containers.find((c) => c.id === id)
        if (!cur) return
        const room = s.rooms.find((r) => r.id === (patch.roomId ?? cur.roomId))
        const next: Container = { ...cur, ...patch }
        next.w = Math.max(1, next.w)
        next.d = Math.max(1, next.d)
        next.capacity = Math.max(0, Math.round(next.capacity))
        next.levels = Math.max(1, Math.round(next.levels))
        if (room) {
          next.h = Math.max(1, Math.min(next.h, room.height))
          next.y = Math.max(0, Math.min(next.y, room.height - next.h))
          const p = clampToRoom(footprint(next), room, s.settings.wallClearance)
          next.x = p.x
          next.z = p.z
        }

        // Only geometry changes can create an overlap; renaming or recolouring
        // must never relocate anything.
        const geometryChanged =
          next.w !== cur.w || next.d !== cur.d || next.h !== cur.h ||
          next.y !== cur.y || next.rotation !== cur.rotation ||
          next.type !== cur.type || next.roomId !== cur.roomId

        if (room && geometryChanged) {
          const opts = {
            collision: s.settings.collisionEnabled && !CONTAINER_META[next.type].obstacle,
            clearance: s.settings.wallClearance,
          }
          if (!checkPlacement(next, s.containers, room, opts).ok) {
            // Growing an object into its neighbours used to be written straight
            // to state — the drag path refused overlaps but the size fields did
            // not. Keep the new size and slide it to the nearest free spot; only
            // refuse outright when the room genuinely has nowhere to put it.
            const spot = findFreeSpot(next, s.containers, room, { ...opts, grid: room.grid })
            if (!spot) {
              get().notify(`No free space for ${next.code} at that size`, 'err')
              return
            }
            next.x = spot.x
            next.z = spot.z
          }
        }

        set((st) => ({ containers: st.containers.map((c) => (c.id === id ? next : c)) }))
      },

      moveContainer: (id, x, z, opts = {}) => {
        const s = get()
        const c = s.containers.find((c) => c.id === id)
        if (!c || c.locked) return false
        const room = s.rooms.find((r) => r.id === c.roomId)
        if (!room) return false
        const grid = s.settings.snapEnabled ? room.grid : 0
        const rect = footprint(c)
        const clamped = clampToRoom(
          { ...rect, cx: snap(x, grid), cz: snap(z, grid) },
          room,
          s.settings.wallClearance,
        )
        const candidate = { ...c, x: clamped.x, z: clamped.z }
        const res = checkPlacement(candidate, s.containers, room, {
          collision: s.settings.collisionEnabled && !CONTAINER_META[c.type].obstacle,
          clearance: s.settings.wallClearance,
        })
        if (!res.ok) return false
        set((st) => ({ containers: st.containers.map((k) => (k.id === id ? candidate : k)) }))
        if (opts.commit) {
          get().logMovement({
            type: 'relocate', name: `${c.code} moved`, qty: 0, toContainerId: c.id, roomId: c.roomId,
            note: `→ x ${Math.round(clamped.x)} cm, z ${Math.round(clamped.z)} cm`,
          })
        }
        return true
      },

      rotateContainer: (id) => {
        const s = get()
        const c = s.containers.find((c) => c.id === id)
        if (!c || c.locked) return
        const room = s.rooms.find((r) => r.id === c.roomId)
        if (!room) return
        const rotation = (((c.rotation + 90) % 360) as Rotation)
        const candidate = { ...c, rotation }
        const p = clampToRoom(footprint(candidate), room, s.settings.wallClearance)
        candidate.x = p.x
        candidate.z = p.z
        const res = checkPlacement(candidate, s.containers, room, {
          collision: s.settings.collisionEnabled && !CONTAINER_META[c.type].obstacle,
          clearance: s.settings.wallClearance,
        })
        if (!res.ok) {
          const spot = findFreeSpot(candidate, s.containers, room, {
            collision: s.settings.collisionEnabled && !CONTAINER_META[c.type].obstacle,
            clearance: s.settings.wallClearance,
            grid: room.grid,
          })
          if (!spot) {
            get().notify('Not enough space to rotate here', 'err')
            return
          }
          candidate.x = spot.x
          candidate.z = spot.z
        }
        set((st) => ({ containers: st.containers.map((k) => (k.id === id ? candidate : k)) }))
      },

      removeContainer: (id) => {
        const c = get().containers.find((c) => c.id === id)
        set((s) => ({
          containers: s.containers.filter((k) => k.id !== id),
          items: s.items.filter((i) => i.containerId !== id),
          selectedContainerId: s.selectedContainerId === id ? null : s.selectedContainerId,
        }))
        if (c) get().notify(`Deleted ${c.code}`, 'warn')
      },

      duplicateContainer: (id) => {
        const s = get()
        const src = s.containers.find((c) => c.id === id)
        if (!src) return
        const room = s.rooms.find((r) => r.id === src.roomId)
        if (!room) return
        const draft: Container = {
          ...src,
          id: uid('cnt'),
          code: nextCode(src.type.slice(0, 3).toUpperCase(), s.containers.map((c) => c.code)),
          createdAt: Date.now(),
        }
        const spot = findFreeSpot(draft, s.containers, room, {
          collision: s.settings.collisionEnabled && !CONTAINER_META[src.type].obstacle,
          clearance: s.settings.wallClearance,
          grid: room.grid,
        })
        if (!spot) {
          get().notify('No space for a copy', 'err')
          return
        }
        const copy = { ...draft, x: spot.x, z: spot.z }
        set((st) => ({ containers: [...st.containers, copy], selectedContainerId: copy.id }))
        get().notify(`Duplicated as ${copy.code}`)
      },

      autoArrange: (roomId) => {
        const s = get()
        const room = s.rooms.find((r) => r.id === roomId)
        if (!room) return
        const inRoom = s.containers.filter((c) => c.roomId === roomId)
        const movable = inRoom.filter((c) => !c.locked && !CONTAINER_META[c.type].obstacle)
        const fixed = inRoom.filter((c) => c.locked || CONTAINER_META[c.type].obstacle)
        // Largest first packs denser and leaves usable gaps for small items.
        const sorted = [...movable].sort((a, b) => footprint(b).w * footprint(b).d - footprint(a).w * footprint(a).d)
        const placed: Container[] = [...fixed]
        const gap = Math.max(room.grid, 10)
        let cursorX = s.settings.wallClearance
        let cursorZ = s.settings.wallClearance
        let rowDepth = 0
        const result: Container[] = []
        for (const c of sorted) {
          const f = footprint(c)
          if (cursorX + f.w > room.width - s.settings.wallClearance) {
            cursorX = s.settings.wallClearance
            cursorZ += rowDepth + gap
            rowDepth = 0
          }
          const draft = { ...c, x: cursorX + f.w / 2, z: cursorZ + f.d / 2 }
          const spot = findFreeSpot(draft, placed, room, {
            collision: s.settings.collisionEnabled,
            clearance: s.settings.wallClearance,
            grid: room.grid,
          })
          // No spot means the row packing has run out of floor. Leaving the
          // object at its untested draft position stacked it on a neighbour and
          // then packed later objects against that phantom footprint, so keep
          // it where it already was instead.
          const final = spot ? { ...draft, x: spot.x, z: spot.z } : c
          result.push(final)
          placed.push(final)
          cursorX += f.w + gap
          rowDepth = Math.max(rowDepth, f.d)
        }
        const byId = new Map(result.map((c) => [c.id, c]))
        set((st) => ({ containers: st.containers.map((c) => byId.get(c.id) ?? c) }))
        get().notify(`Re-arranged ${result.length} objects`)
      },

      isPlacementValid: (c) => {
        const s = get()
        const room = s.rooms.find((r) => r.id === c.roomId)
        if (!room) return true
        return checkPlacement(c, s.containers, room, {
          collision: s.settings.collisionEnabled && !CONTAINER_META[c.type].obstacle,
          clearance: s.settings.wallClearance,
        }).ok
      },

      // ---------------------------------------------------------------- items
      addItem: (containerId, patch = {}) => {
        const s = get()
        const seq = s.items.length + 1
        const now = Date.now()
        const item: Item = {
          id: uid('itm'),
          containerId,
          sku: `SKU-${String(seq).padStart(5, '0')}`,
          barcode: generateBarcode(),
          name: 'New item',
          category: 'General',
          qty: 1,
          uom: 'pcs',
          slots: 1,
          status: 'in_stock',
          receivedAt: todayISO(),
          tags: [],
          createdAt: now,
          updatedAt: now,
          ...patch,
        }
        if (!item.sku.trim()) item.sku = `SKU-${String(seq).padStart(5, '0')}`
        if (!item.barcode.trim()) item.barcode = generateBarcode()
        set((st) => ({ items: [...st.items, item] }))
        get().logMovement({
          type: 'receive', itemId: item.id, sku: item.sku, name: item.name,
          qty: item.qty, uom: item.uom, toContainerId: containerId,
          roomId: s.containers.find((c) => c.id === containerId)?.roomId,
          note: 'Initial receipt',
        })
        return item
      },

      updateItem: (id, patch) => {
        const prev = get().items.find((i) => i.id === id)
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)),
        }))
        if (prev && patch.qty !== undefined && patch.qty !== prev.qty) {
          const delta = patch.qty - prev.qty
          get().logMovement({
            type: 'adjust', itemId: id, sku: prev.sku, name: prev.name, qty: delta, uom: prev.uom,
            toContainerId: prev.containerId, note: `Qty ${prev.qty} → ${patch.qty}`,
          })
        }
      },

      removeItem: (id) => {
        const it = get().items.find((i) => i.id === id)
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
        if (it) {
          get().logMovement({
            type: 'dispose', itemId: it.id, sku: it.sku, name: it.name, qty: -it.qty, uom: it.uom,
            fromContainerId: it.containerId, note: 'Removed from inventory',
          })
        }
      },

      transferItem: (id, toContainerId, qty) => {
        const s = get()
        const it = s.items.find((i) => i.id === id)
        if (!it || it.containerId === toContainerId) return
        const amount = qty === undefined ? it.qty : Math.min(qty, it.qty)
        if (amount <= 0) return
        if (amount >= it.qty) {
          set((st) => ({
            items: st.items.map((i) => (i.id === id ? { ...i, containerId: toContainerId, updatedAt: Date.now() } : i)),
          }))
        } else {
          // Split the slot footprint with the quantity. Copying `slots` intact
          // double-counted capacity: 40 of 100 units moved out still claimed a
          // full line's worth of slots in both containers.
          const totalSlots = Math.max(1, it.slots || 1)
          const movedSlots = Math.max(1, Math.round((totalSlots * amount) / it.qty))
          const keptSlots = Math.max(1, totalSlots - movedSlots)
          const split: Item = {
            ...it, id: uid('itm'), containerId: toContainerId, qty: amount, slots: movedSlots,
            createdAt: Date.now(), updatedAt: Date.now(),
          }
          set((st) => ({
            items: [
              ...st.items.map((i) =>
                i.id === id ? { ...i, qty: i.qty - amount, slots: keptSlots, updatedAt: Date.now() } : i),
              split,
            ],
          }))
        }
        get().logMovement({
          type: 'transfer', itemId: id, sku: it.sku, name: it.name, qty: amount, uom: it.uom,
          fromContainerId: it.containerId, toContainerId,
          note: `${amount} ${it.uom} moved`,
        })
        get().notify(`Transferred ${amount} ${it.uom} of ${it.name}`)
      },

      adjustQty: (id, delta, type = 'adjust', note) => {
        const it = get().items.find((i) => i.id === id)
        if (!it) return
        const qty = Math.max(0, it.qty + delta)
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, qty, updatedAt: Date.now() } : i)) }))
        get().logMovement({
          type, itemId: id, sku: it.sku, name: it.name, qty: delta, uom: it.uom,
          toContainerId: it.containerId, note: note ?? `Qty ${it.qty} → ${qty}`,
        })
      },

      // ------------------------------------------------------------ movements
      logMovement: (m) => {
        const mv: Movement = {
          id: uid('mv'),
          ts: m.ts ?? Date.now(),
          user: m.user ?? get().settings.operator,
          ...m,
        } as Movement

        // Nudging an object around the plan would otherwise flood the audit
        // trail with near-identical rows, so consecutive repositionings of the
        // same object collapse into the most recent one.
        const head = get().movements[0]
        if (
          mv.type === 'relocate' &&
          head?.type === 'relocate' &&
          head.toContainerId === mv.toContainerId &&
          mv.ts - head.ts < 60_000
        ) {
          set((s) => ({ movements: [mv, ...s.movements.slice(1)] }))
          return
        }

        set((s) => ({ movements: [mv, ...s.movements].slice(0, 2000) }))
      },

      clearMovements: () => set({ movements: [] }),

      // ----------------------------------------------------------------- data
      exportData: () => {
        const { sites, rooms, containers, items, movements, settings } = get()
        return { sites, rooms, containers, items, movements, settings }
      },

      importData: (data, mode) => {
        // Guard the shape, not just the presence: a malformed file used to be
        // written straight to state, then thrown on every subsequent render.
        const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
        const sites = arr<Site>(data.sites)
        const rooms = arr<Room>(data.rooms)
        if (!sites.length && !rooms.length && !arr(data.items).length) {
          get().notify('Nothing importable found in that file', 'err')
          return
        }
        // Older backups have no sites — adopt their rooms into one.
        let adopted = sites
        let normalisedRooms = rooms
        if (!adopted.length && rooms.length) {
          const fallback: Site = {
            id: uid('site'), code: 'ST-01', name: 'Imported site', kind: 'warehouse', createdAt: Date.now(),
          }
          adopted = [fallback]
          normalisedRooms = rooms.map((r) => ({ ...r, siteId: r.siteId ?? fallback.id }))
        }

        if (mode === 'replace') {
          set({
            sites: adopted,
            rooms: normalisedRooms,
            containers: arr<Container>(data.containers),
            items: arr<Item>(data.items),
            movements: arr<Movement>(data.movements),
            settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
            activeSiteId: adopted[0]?.id ?? null,
            activeRoomId: normalisedRooms[0]?.id ?? null,
            selectedContainerId: null,
          })
        } else {
          set((s) => ({
            sites: [...s.sites, ...adopted],
            rooms: [...s.rooms, ...normalisedRooms],
            containers: [...s.containers, ...arr<Container>(data.containers)],
            items: [...s.items, ...arr<Item>(data.items)],
            movements: [...s.movements, ...arr<Movement>(data.movements)],
          }))
        }
        get().notify(`Imported ${adopted.length} sites, ${normalisedRooms.length} rooms, ${arr(data.items).length} items`)
      },

      loadSample: () => {
        const seed = buildSeed()
        set({
          sites: seed.sites,
          rooms: seed.rooms,
          containers: seed.containers,
          items: seed.items,
          movements: seed.movements,
          settings: { ...get().settings },
          activeSiteId: seed.sites[0]?.id ?? null,
          activeRoomId: seed.rooms[0]?.id ?? null,
          selectedContainerId: null,
          view: 'rooms',
        })
        get().notify('Sample data loaded')
      },

      resetAll: () => {
        set({
          ...emptyData(),
          settings: { ...get().settings },
          activeSiteId: null,
          activeRoomId: null,
          selectedContainerId: null,
          view: 'dashboard',
        })
        get().notify('All data cleared', 'warn')
      },
    }),
    {
      name: 'storespace.v1',
      version: 3,
      migrate: (persisted: any, from: number) => {
        if (!persisted) return persisted
        let next = persisted

        // v2 switched to the pastel/toon look: repaint anything still carrying
        // the old dark palette so existing projects pick up the new theme.
        if (from < 2) {
          next = {
            ...next,
            settings: { ...DEFAULT_SETTINGS, ...(next.settings ?? {}), theme: 'light' },
            rooms: (next.rooms ?? []).map((r: Room) => ({ ...r, floorColor: ROOM_FLOOR, wallColor: ROOM_WALL })),
            containers: (next.containers ?? []).map((c: Container) => ({
              ...c,
              color: CONTAINER_META[c.type]?.color ?? c.color,
            })),
          }
        }

        // v3 introduced sites above rooms. Existing projects have loose rooms,
        // so adopt them all into one site rather than dropping them.
        if (from < 3) {
          const rooms: Room[] = next.rooms ?? []
          const site: Site = {
            id: uid('site'),
            code: 'ST-01',
            name: 'Main site',
            kind: 'warehouse',
            createdAt: Date.now(),
          }
          next = {
            ...next,
            sites: rooms.length || next.sites?.length ? [site] : [],
            rooms: rooms.map((r) => ({ ...r, siteId: r.siteId ?? site.id })),
            activeSiteId: rooms.length ? site.id : null,
          }
        }

        return next
      },
      partialize: (s) => ({
        sites: s.sites,
        rooms: s.rooms,
        containers: s.containers,
        items: s.items,
        movements: s.movements,
        settings: s.settings,
        activeSiteId: s.activeSiteId,
        activeRoomId: s.activeRoomId,
        view: s.view,
      }),
    },
  ),
)

// ------------------------------------------------------------------ selectors

export const containersOfRoom = (s: Store | AppData, roomId: ID | null) =>
  roomId ? s.containers.filter((c) => c.roomId === roomId) : []

export const itemsOfContainer = (s: Store | AppData, containerId: ID | null) =>
  containerId ? s.items.filter((i) => i.containerId === containerId) : []

/** Slots used vs capacity for a container, 0..1+ */
export function fillRatio(items: Item[], container: Container): number {
  if (!container.capacity) return 0
  const used = items.reduce((n, i) => n + (i.slots || 1), 0)
  return used / container.capacity
}

export function containerStats(all: Item[], container: Container) {
  const items = all.filter((i) => i.containerId === container.id)
  const usedSlots = items.reduce((n, i) => n + (i.slots || 1), 0)
  const qty = items.reduce((n, i) => n + i.qty, 0)
  const weight = items.reduce((n, i) => n + (i.unitWeightKg ?? 0) * i.qty, 0)
  const value = items.reduce((n, i) => n + (i.unitCost ?? 0) * i.qty, 0)
  return {
    items, count: items.length, usedSlots, qty, weight, value,
    fill: container.capacity ? usedSlots / container.capacity : 0,
    overweight: container.maxWeightKg ? weight > container.maxWeightKg : false,
  }
}
