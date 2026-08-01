import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  AppData, Container, ContainerType, ID, Item, Movement, MovementType, Room, Rotation, Settings, Site,
} from './types'
import { containerMeta } from './types'
import { checkPlacement, clampToRoom, findFreeSpot, footprint, snap } from './lib/geometry'
import { generateBarcode, nextCode, todayISO, uid } from './lib/utils'
import { buildSeed } from './lib/seed'
import { STORAGE_KEY, guardedStorage } from './lib/storage'

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
  // Follows the browser on a fresh install; an explicit choice is persisted.
  language: typeof navigator !== 'undefined' && navigator.language?.startsWith('id') ? 'id' : 'en',
}

export type View = 'dashboard' | 'rooms' | 'inventory' | 'movements' | 'reports' | 'data'
export type LeftPanel = 'rooms' | 'catalog' | 'objects' | null

interface UIState {
  view: View
  activeSiteId: ID | null
  activeRoomId: ID | null
  selectedContainerId: ID | null
  /** Container to flash in the layout after a search jump. Clears itself. */
  revealedContainerId: ID | null
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
  /** First-run walkthrough. Deliberately unpersisted — "seen once" is its own
   *  localStorage flag, so a reload never reopens a tour mid-step. */
  tourOpen: boolean
  toast: { id: string; msg: string; kind: 'ok' | 'warn' | 'err' } | null
}

interface Store extends AppData, UIState {
  // --- ui -----------------------------------------------------------------
  setView: (v: View) => void
  setActiveSite: (id: ID | null) => void
  setActiveRoom: (id: ID | null) => void
  selectContainer: (id: ID | null) => void
  /** Jump to a container and flash it in the layout. */
  revealContainer: (id: ID) => void
  setInspectorTab: (t: 'object' | 'items') => void
  setCameraPreset: (n: number) => void
  setViewMode: (m: 'plan' | 'webgl') => void
  setFreeOrbit: (b: boolean) => void
  setLeftPanel: (p: LeftPanel) => void
  toggleLeftPanel: (p: Exclude<LeftPanel, null>) => void
  setInspectorOpen: (b: boolean) => void
  /** Flip the properties panel from the live store value, not a captured one. */
  toggleInspector: () => void
  setDragInvalid: (b: boolean) => void
  setTourOpen: (b: boolean) => void
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

/** Stamped into every backup so a future build knows what it is reading. */
export const SCHEMA_VERSION = 4

type ImportSet = { sites: Site[]; rooms: Room[]; containers: Container[]; items: Item[]; movements: Movement[] }

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)

/**
 * Coerce whatever was in the file into records the app can actually render.
 *
 * The old guard only checked that the top-level fields were arrays, so a room
 * with `width: "12"`, an item with no `tags`, or a container referring to a
 * room that is not in the file all went straight into state and threw on the
 * next render. Anything unusable is dropped rather than repaired blindly, and
 * orphans are discarded because a container with no room can never be reached
 * or deleted through the UI.
 */
function normaliseImport(data: Partial<AppData>): ImportSet | null {
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

  const sites: Site[] = arr<any>(data.sites)
    .filter((s) => s && typeof s === 'object' && str(s.id))
    .map((s) => ({
      ...s, id: str(s.id), code: str(s.code, 'ST'), name: str(s.name, 'Site'),
      kind: str(s.kind, 'warehouse') as Site['kind'], createdAt: num(s.createdAt, Date.now()),
    }))

  let rooms: Room[] = arr<any>(data.rooms)
    .filter((r) => r && typeof r === 'object' && str(r.id))
    .map((r) => ({
      ...r, id: str(r.id), code: str(r.code, 'RM'), name: str(r.name, 'Room'),
      // Zero or missing dimensions divide through as NaN in every occupancy
      // figure, which then renders as "NaN%" beside a full green bar.
      width: Math.max(50, num(r.width, 600)),
      length: Math.max(50, num(r.length, 400)),
      height: Math.max(50, num(r.height, 300)),
      grid: Math.max(1, num(r.grid, 20)),
    }))

  // Older backups predate sites entirely — adopt their rooms into one.
  let adopted = sites
  const orphanRooms = rooms.filter((r) => !sites.some((s) => s.id === r.siteId))
  if (orphanRooms.length) {
    const fallback: Site = {
      id: uid('site'), code: 'ST-01', name: 'Imported site', kind: 'warehouse', createdAt: Date.now(),
    }
    adopted = [...sites, fallback]
    rooms = rooms.map((r) => (orphanRooms.includes(r) ? { ...r, siteId: fallback.id } : r))
  }

  const roomIds = new Set(rooms.map((r) => r.id))
  const containers: Container[] = arr<any>(data.containers)
    .filter((c) => c && typeof c === 'object' && str(c.id) && roomIds.has(c.roomId))
    .map((c) => ({
      ...c, id: str(c.id), code: str(c.code, 'CNT'), name: str(c.name, 'Object'),
      type: str(c.type, 'box') as Container['type'],
      w: Math.max(1, num(c.w, 60)), d: Math.max(1, num(c.d, 40)), h: Math.max(1, num(c.h, 40)),
      x: num(c.x, 0), z: num(c.z, 0), y: num(c.y, 0),
      rotation: ([0, 90, 180, 270].includes(c.rotation) ? c.rotation : 0) as Container['rotation'],
      capacity: Math.max(0, num(c.capacity, 0)),
    }))

  const containerIds = new Set(containers.map((c) => c.id))
  const items: Item[] = arr<any>(data.items)
    .filter((i) => i && typeof i === 'object' && str(i.id) && containerIds.has(i.containerId))
    .map((i) => ({
      ...i, id: str(i.id), sku: str(i.sku, 'SKU'), name: str(i.name, 'Item'),
      barcode: str(i.barcode), category: str(i.category, 'General'),
      qty: Math.max(0, num(i.qty, 0)), slots: Math.max(0, num(i.slots, 1)),
      // Spread in several views; a missing array threw "not iterable".
      tags: Array.isArray(i.tags) ? i.tags.filter((t: unknown) => typeof t === 'string') : [],
    }))

  const movements: Movement[] = arr<any>(data.movements)
    .filter((m) => m && typeof m === 'object' && str(m.id))
    .map((m) => ({ ...m, id: str(m.id), ts: num(m.ts, Date.now()), qty: num(m.qty, 0) }))
    .sort((a, b) => b.ts - a.ts)

  if (!adopted.length && !rooms.length && !items.length) return null
  return { sites: adopted, rooms, containers, items, movements }
}

/**
 * Disposal rows for stock removed as a side effect of deleting its container.
 *
 * Deleting a single line already logged a `dispose`, but deleting the shelf it
 * sat on removed four hundred of them in silence — so the ledger went on
 * claiming stock that no longer existed anywhere, while the receipts that put
 * it there stayed put. Built as plain rows rather than repeated `logMovement`
 * calls so the whole cascade lands in the same `set`.
 */
function disposalRows(items: Item[], user: string, why: string): Movement[] {
  const ts = Date.now()
  return items.map((it) => ({
    id: uid('mv'),
    ts,
    user,
    type: 'dispose' as MovementType,
    itemId: it.id,
    sku: it.sku,
    name: it.name,
    qty: -it.qty,
    uom: it.uom,
    fromContainerId: it.containerId,
    note: why,
  })) as Movement[]
}

/**
 * Force an item's numbers into the range the rest of the app assumes.
 *
 * `min={0}` on a number input stops the spinner, not the keyboard, and
 * `Number('-5')` is a perfectly good number — so a typed negative quantity
 * reached the store, turned the dashboard's unit and value totals negative,
 * and tripped the low-stock alert on a line that supposedly held minus five.
 * Mutates in place; every caller owns a fresh draft.
 */
function clampItem(it: Item) {
  it.qty = Math.max(0, num(it.qty, 0))
  it.slots = Math.max(0, num(it.slots, 1))
  if (it.unitCost !== undefined) it.unitCost = Math.max(0, num(it.unitCost, 0))
  if (it.unitWeightKg !== undefined) it.unitWeightKg = Math.max(0, num(it.unitWeightKg, 0))
  if (it.minQty !== undefined) it.minQty = Math.max(0, num(it.minQty, 0))
}

/** Fresh ids throughout, with every parent reference rewritten to match. */
function remapIds(set: ImportSet): ImportSet {
  const siteMap = new Map(set.sites.map((s) => [s.id, uid('site')]))
  const roomMap = new Map(set.rooms.map((r) => [r.id, uid('room')]))
  const contMap = new Map(set.containers.map((c) => [c.id, uid('cnt')]))
  const itemMap = new Map(set.items.map((i) => [i.id, uid('itm')]))
  const to = <T,>(m: Map<string, string>, id: T): T => (m.get(id as string) ?? id) as T

  return {
    sites: set.sites.map((s) => ({ ...s, id: to(siteMap, s.id) })),
    rooms: set.rooms.map((r) => ({ ...r, id: to(roomMap, r.id), siteId: to(siteMap, r.siteId) })),
    containers: set.containers.map((c) => ({ ...c, id: to(contMap, c.id), roomId: to(roomMap, c.roomId) })),
    items: set.items.map((i) => ({ ...i, id: to(itemMap, i.id), containerId: to(contMap, i.containerId) })),
    movements: set.movements.map((m) => ({
      ...m,
      id: uid('mv'),
      itemId: m.itemId ? to(itemMap, m.itemId) : m.itemId,
      roomId: m.roomId ? to(roomMap, m.roomId) : m.roomId,
      fromContainerId: m.fromContainerId ? to(contMap, m.fromContainerId) : m.fromContainerId,
      toContainerId: m.toContainerId ? to(contMap, m.toContainerId) : m.toContainerId,
    })),
  }
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      view: 'dashboard',
      activeSiteId: null,
      activeRoomId: null,
      selectedContainerId: null,
      revealedContainerId: null,
      inspectorTab: 'object',
      cameraPreset: 0,
      viewMode: 'webgl',
      freeOrbit: false,
      leftPanel: null,
      inspectorOpen: true,
      dragInvalid: false,
      tourOpen: false,
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

      /**
       * Jump to a container from anywhere (search, an alert, the inventory
       * table) and make it obvious which one was found.
       *
       * Selecting alone is not enough: selection looks identical whether you
       * clicked the object yourself or arrived from a search across three
       * rooms, so on a busy floor plan you still have to hunt for the thing you
       * just searched for. The reveal flag drives a temporary highlight that
       * clears itself, keeping the emphasis on "this is the one" without
       * leaving a second permanent selection state behind.
       */
      revealContainer: (id) => {
        const c = get().containers.find((k) => k.id === id)
        if (!c) return
        const room = get().rooms.find((r) => r.id === c.roomId)
        set({
          view: 'rooms',
          activeRoomId: c.roomId,
          activeSiteId: room?.siteId ?? get().activeSiteId,
          selectedContainerId: id,
          inspectorOpen: true,
          revealedContainerId: id,
        })
        setTimeout(() => {
          if (get().revealedContainerId === id) set({ revealedContainerId: null })
        }, 2400)
      },
      setInspectorTab: (inspectorTab) => set({ inspectorTab }),
      setCameraPreset: (cameraPreset) => set({ cameraPreset }),
      setViewMode: (viewMode) => set({ viewMode }),
      setFreeOrbit: (freeOrbit) => set({ freeOrbit }),
      setLeftPanel: (leftPanel) => set({ leftPanel }),
      toggleLeftPanel: (p) => set((s) => ({ leftPanel: s.leftPanel === p ? null : p })),
      setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
      /**
       * Flip the panel from the current store value, never from a captured one.
       *
       * `onClick={() => setInspectorOpen(!inspectorOpen)}` reads whatever
       * `inspectorOpen` was when that handler was created. If a click lands
       * against a render that has not committed yet, it writes back the value
       * it already has and the toggle silently does nothing — which is why the
       * panel would refuse to reopen, and why it showed up in the 3D view,
       * where every toggle resizes a WebGL canvas and renders are slow enough
       * for the two to overlap.
       */
      toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
      setDragInvalid: (dragInvalid) => set({ dragInvalid }),
      setTourOpen: (tourOpen) => set({ tourOpen }),
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
        const siteChanged = s.activeSiteId === id
        const nextSiteId = siteChanged ? remainingSites[0]?.id ?? null : s.activeSiteId
        const lost = s.items.filter((i) => containerIds.has(i.containerId))
        const site = s.sites.find((x) => x.id === id)
        set({
          sites: remainingSites,
          rooms: s.rooms.filter((r) => !roomIds.has(r.id)),
          containers: s.containers.filter((c) => !containerIds.has(c.id)),
          items: s.items.filter((i) => !containerIds.has(i.containerId)),
          movements: [
            ...disposalRows(lost, s.settings.operator, `Site ${site?.code ?? ''} deleted`),
            ...s.movements,
          ].slice(0, 2000),
          activeSiteId: nextSiteId,
          // Only re-home the room selection when the site actually changed.
          // Resetting it unconditionally yanked the user out of the room they
          // were editing whenever they deleted some *other* site.
          activeRoomId: siteChanged
            ? s.rooms.find((r) => r.siteId === nextSiteId)?.id ?? null
            : s.activeRoomId,
          selectedContainerId: siteChanged ? null : s.selectedContainerId,
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
        const before = get().rooms.find((r) => r.id === id)
        set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
        const room = get().rooms.find((r) => r.id === id)
        if (!room) return

        /*
         * Only re-home the contents when the room actually changed shape.
         * The pass used to run on every patch, so renaming a room — or just
         * recolouring its floor — re-placed anything that happened to overlap
         * and announced "N object(s) no longer fit". Deliberate overlaps are a
         * supported state; collision detection is a setting the user can turn
         * off, and turning it back on should not be a trap.
         */
        const resized = !before || (['width', 'length', 'height'] as const).some(
          (k) => patch[k] !== undefined && patch[k] !== before[k],
        )
        if (!resized) return

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
          const canCollide = opts.collision && !containerMeta(c.type).obstacle
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
        const containerIds = new Set(get().containers.filter((c) => c.roomId === id).map((c) => c.id))
        const room = get().rooms.find((r) => r.id === id)
        set((s) => ({
          rooms: s.rooms.filter((r) => r.id !== id),
          containers: s.containers.filter((c) => c.roomId !== id),
          items: s.items.filter((i) => !containerIds.has(i.containerId)),
          movements: [
            ...disposalRows(
              s.items.filter((i) => containerIds.has(i.containerId)),
              s.settings.operator,
              `Room ${room?.code ?? ''} deleted`,
            ),
            ...s.movements,
          ].slice(0, 2000),
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
        const meta = containerMeta(type)
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
          collision: s.settings.collisionEnabled,
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
            collision: s.settings.collisionEnabled,
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
          collision: s.settings.collisionEnabled,
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
          collision: s.settings.collisionEnabled,
          clearance: s.settings.wallClearance,
        })
        if (!res.ok) {
          const spot = findFreeSpot(candidate, s.containers, room, {
            collision: s.settings.collisionEnabled,
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
          movements: [
            ...disposalRows(
              s.items.filter((i) => i.containerId === id),
              s.settings.operator,
              `${c?.code ?? 'Object'} deleted`,
            ),
            ...s.movements,
          ].slice(0, 2000),
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
          collision: s.settings.collisionEnabled,
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
        const movable = inRoom.filter((c) => !c.locked && !containerMeta(c.type).obstacle)
        const fixed = inRoom.filter((c) => c.locked || containerMeta(c.type).obstacle)
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
          collision: s.settings.collisionEnabled,
          clearance: s.settings.wallClearance,
        }).ok
      },

      // ---------------------------------------------------------------- items
      addItem: (containerId, patch = {}) => {
        const s = get()
        /*
         * Continue the highest SKU actually in use, not the row count.
         * Counting collided the moment anything was deleted: five items minus
         * one leaves four, so the next add re-issued SKU-00005. Duplicate SKUs
         * then made barcode search jump to whichever line came first.
         */
        const seq = s.items.reduce((max, i) => {
          const n = Number(/^SKU-(\d+)$/.exec(i.sku)?.[1])
          return Number.isFinite(n) && n > max ? n : max
        }, 0) + 1
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
        clampItem(item)
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
        if (!prev) return
        // A blank SKU or barcode is backfilled on create but used to be
        // accepted verbatim on edit, so clearing the field — whose placeholder
        // still reads AUTO — emptied the column, the CSV export and the label.
        const next = { ...prev, ...patch, updatedAt: Date.now() }
        if (!next.sku.trim()) next.sku = prev.sku
        if (!next.barcode.trim()) next.barcode = prev.barcode
        if (!next.name.trim()) next.name = prev.name
        clampItem(next)
        set((s) => ({ items: s.items.map((i) => (i.id === id ? next : i)) }))
        if (patch.qty !== undefined && next.qty !== prev.qty) {
          const delta = next.qty - prev.qty
          get().logMovement({
            type: 'adjust', itemId: id, sku: prev.sku, name: prev.name, qty: delta, uom: prev.uom,
            toContainerId: prev.containerId, note: `Qty ${prev.qty} → ${next.qty}`,
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
        // Stock moved into a container that is not there vanishes from every
        // view with no way to get it back.
        if (!s.containers.some((c) => c.id === toContainerId)) {
          get().notify('That destination no longer exists', 'err')
          return
        }
        const amount = qty === undefined ? it.qty : Math.min(qty, it.qty)
        if (amount <= 0) return
        if (amount >= it.qty) {
          set((st) => ({
            items: st.items.map((i) => (i.id === id ? { ...i, containerId: toContainerId, updatedAt: Date.now() } : i)),
          }))
        } else {
          /*
           * Split the slot footprint with the quantity, and make sure the two
           * halves still sum to the original.
           *
           * Rounding each side independently and flooring both at 1 inflated
           * the total on the commonest case there is: a single-slot line of
           * 100 units, transfer 40, and `max(1, round(0.4))` plus
           * `max(1, 1 - 1)` turned one slot into two. Every partial transfer
           * added capacity that no goods occupied, permanently, until
           * containers reported themselves full while holding the same stock.
           */
          const totalSlots = Math.max(1, it.slots || 1)
          const movedSlots = Math.min(totalSlots, Math.max(0, Math.round((totalSlots * amount) / it.qty)))
          const keptSlots = totalSlots - movedSlots
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
        /*
         * Log what actually happened, not what was asked for. Issuing 10 from
         * a line holding 3 clamps the stock to zero, but the row used to still
         * read -10 while its own note said "Qty 3 → 0" — a movement that
         * contradicted itself, and a per-type total on the movements screen
         * that over-reported by the seven units that never existed.
         */
        const applied = qty - it.qty
        if (applied === 0) return
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, qty, updatedAt: Date.now() } : i)) }))
        get().logMovement({
          type, itemId: id, sku: it.sku, name: it.name, qty: applied, uom: it.uom,
          toContainerId: it.containerId,
          note: note ?? (applied === delta
            ? `Qty ${it.qty} → ${qty}`
            : `Qty ${it.qty} → ${qty} (${delta > 0 ? '+' : ''}${delta} requested, only ${applied} possible)`),
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
      /**
       * Backups carry the schema version they were written at.
       *
       * Without it a file taken today is indistinguishable from one taken two
       * schemas ago, so `importData` had no way to know whether to migrate and
       * simply never did. The field is additive — older backups lacking it are
       * still readable, they are just assumed to predate versioning.
       */
      exportData: () => {
        const { sites, rooms, containers, items, movements, settings } = get()
        return { schemaVersion: SCHEMA_VERSION, sites, rooms, containers, items, movements, settings }
      },

      importData: (data, mode) => {
        const raw = normaliseImport(data)
        if (!raw) {
          get().notify('Nothing importable found in that file', 'err')
          return
        }

        /*
         * Merge has to renumber everything it brings in.
         *
         * Ids were previously carried across untouched, so merging a backup
         * that overlapped the current data — most obviously, the same file
         * twice — produced two of every record under one id. `find` returned
         * the first and the twin became unreachable, while `filter` matched
         * both and doubled every quantity, weight and value the container
         * reported. Fresh ids on the incoming side make the collision
         * impossible; the maps then rewrite the parent references so the
         * imported tree still points at itself.
         */
        const incoming = mode === 'merge' ? remapIds(raw) : raw

        if (mode === 'replace') {
          set({
            sites: incoming.sites,
            rooms: incoming.rooms,
            containers: incoming.containers,
            items: incoming.items,
            movements: incoming.movements,
            settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
            activeSiteId: incoming.sites[0]?.id ?? null,
            activeRoomId: incoming.rooms[0]?.id ?? null,
            selectedContainerId: null,
          })
        } else {
          set((s) => ({
            sites: [...s.sites, ...incoming.sites],
            rooms: [...s.rooms, ...incoming.rooms],
            containers: [...s.containers, ...incoming.containers],
            items: [...s.items, ...incoming.items],
            // Newest-first is an invariant the movements table and the
            // dashboard's "recent activity" both read without sorting, so a
            // plain concat left the ledger visibly out of order.
            movements: [...s.movements, ...incoming.movements].sort((a, b) => b.ts - a.ts),
            // A merge into an empty app used to leave both pointers null,
            // which looked exactly like the import having done nothing.
            activeSiteId: s.activeSiteId ?? incoming.sites[0]?.id ?? null,
            activeRoomId: s.activeRoomId ?? incoming.rooms[0]?.id ?? null,
          }))
        }
        const { sites, rooms, items } = incoming
        get().notify(`Imported ${sites.length} sites, ${rooms.length} rooms, ${items.length} items`)
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
      name: STORAGE_KEY,
      storage: createJSONStorage(() => guardedStorage),
      version: SCHEMA_VERSION,
      /*
       * Nested objects are replaced wholesale by zustand's default shallow
       * merge, so a persisted `settings` from before a new key existed would
       * leave that key `undefined` for every existing user — silently
       * disabling whatever reads it. Re-seed the defaults underneath.
       */
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>
        /*
         * Sanitise on the way in, exactly as an imported file is.
         *
         * A blob can be corrupt without being unparseable — a truncated write,
         * a hand edit, a field that changed shape between builds — and it
         * arrives here having bypassed every check `importData` applies. It
         * used to go straight into state and throw on the first render.
         */
        const clean = normaliseImport(p) ?? {
          sites: [], rooms: [], containers: [], items: [], movements: [],
        }
        return {
          ...current,
          ...p,
          ...clean,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        }
      },
      /*
       * Never throw out of here. A migration that throws takes the whole
       * rehydrate down with it, and the user lands on an empty app holding
       * their only copy hostage. Loading the data unmigrated is worse than a
       * clean migration but far better than appearing to have lost it — the
       * guards downstream (`containerMeta`, the array checks) are there
       * precisely so odd-shaped data stays navigable.
       */
      migrate: (persisted: any, from: number) => {
        try {
          return migrateState(persisted, from)
        } catch (e) {
          console.error('StoreSpace: migration failed, loading data unmigrated.', e)
          return persisted
        }
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

function migrateState(persisted: any, from: number) {
        if (!persisted) return persisted
        let next = persisted

        // v2 switched to the pastel/toon look: repaint anything still carrying
        // the old dark palette so existing projects pick up the new theme.
        if (from < 2) {
          next = {
            ...next,
            settings: { ...DEFAULT_SETTINGS, ...(next.settings ?? {}), theme: 'light' },
            rooms: (Array.isArray(next.rooms) ? next.rooms : []).map((r: Room) => ({ ...r, floorColor: ROOM_FLOOR, wallColor: ROOM_WALL })),
            containers: (Array.isArray(next.containers) ? next.containers : []).map((c: Container) => ({
              ...c,
              color: containerMeta(c.type).color ?? c.color,
            })),
          }
        }

        // v3 introduced sites above rooms. Existing projects have loose rooms,
        // so adopt them all into one site rather than dropping them.
        if (from < 3) {
          const rooms: Room[] = Array.isArray(next.rooms) ? next.rooms : []
          // Any sites already on the blob are real and must survive. The first
          // cut replaced them with a single synthetic site while leaving the
          // rooms' original `siteId` values pointing at the sites it had just
          // discarded, which orphaned every room.
          const existing: Site[] = Array.isArray(next.sites) ? next.sites : []
          const loose = rooms.filter((r) => !existing.some((s) => s.id === r.siteId))
          const site: Site = {
            id: uid('site'),
            code: 'ST-01',
            name: existing.length ? 'Imported rooms' : 'Main site',
            kind: 'warehouse',
            createdAt: Date.now(),
          }
          const sites = loose.length ? [...existing, site] : existing
          next = {
            ...next,
            sites,
            rooms: rooms.map((r) => (loose.includes(r) ? { ...r, siteId: site.id } : r)),
            activeSiteId: sites[0]?.id ?? null,
          }
        }

        // v4: obstacles are not storage. They had no `capacity` in their type
        // metadata, so `meta.capacity ?? 10` handed every pillar and doorway
        // ten slots — which the capacity report then printed as "0/10" and the
        // room occupancy percentages quietly counted as free space.
        if (from < 4) {
          next = {
            ...next,
            containers: (Array.isArray(next.containers) ? next.containers : []).map((c: Container) =>
              containerMeta(c.type).obstacle ? { ...c, capacity: 0 } : c),
          }
        }

        return next
}

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
