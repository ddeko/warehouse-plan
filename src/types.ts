/**
 * Domain model. All linear dimensions are stored in CENTIMETRES as numbers so
 * that room and container sizes stay exactly comparable (no float drift from
 * mixing metres and millimetres). The UI can display cm / m / in via settings.
 */

export type ID = string

export type Uom =
  | 'pcs' | 'box' | 'pack' | 'set' | 'pallet' | 'roll' | 'bag'
  | 'kg' | 'g' | 'ton'
  | 'l' | 'ml'
  | 'm' | 'cm' | 'm2' | 'm3'

export const UOMS: Uom[] = [
  'pcs', 'box', 'pack', 'set', 'pallet', 'roll', 'bag',
  'kg', 'g', 'ton', 'l', 'ml', 'm', 'cm', 'm2', 'm3',
]

/** Physical kinds of storage furniture / containers that live inside a room. */
export type ContainerType =
  | 'shelf'
  | 'rack'
  | 'pallet'
  | 'stack'
  | 'box'
  | 'crate'
  | 'cupboard'
  | 'cabinet'
  | 'fridge'
  | 'freezer'
  | 'unit'
  | 'bin'
  | 'drum'
  | 'tank'
  | 'cage'
  | 'table'
  | 'workbench'
  | 'pillar'
  | 'door'

export type ContainerCategory = 'storage' | 'containers' | 'appliances' | 'surfaces' | 'structure'

export const CONTAINER_CATEGORIES: { key: ContainerCategory; label: string }[] = [
  { key: 'storage', label: 'Shelving & storage' },
  { key: 'containers', label: 'Containers & bulk' },
  { key: 'appliances', label: 'Cold storage' },
  { key: 'surfaces', label: 'Work surfaces' },
  { key: 'structure', label: 'Structure' },
]

export interface ContainerTypeMeta {
  type: ContainerType
  label: string
  category: ContainerCategory
  /** Default size in cm: [width (X), length/depth (Z), height (Y)] */
  size: [number, number, number]
  /** Soft pastel fill used by the toon renderer and the catalogue icons. */
  color: string
  /**
   * Renders as a cylinder filling the object's footprint.
   *
   * Collision stays axis-aligned against that footprint — there is no circular
   * hull, and the doc used to claim otherwise.
   */
  round?: boolean
  /** Default number of storable levels/slots. */
  levels?: number
  /** Default capacity expressed in "slot units". */
  capacity?: number
  /** Non-storage obstacles: no item list, still block movement. */
  obstacle?: boolean
  /** Default target temperature in °C, when the type is climate controlled. */
  tempC?: number
  hint: string
}

export const CONTAINER_TYPES: ContainerTypeMeta[] = [
  { type: 'shelf', label: 'Shelf', category: 'storage', size: [120, 45, 180], color: '#ffe0a3', levels: 5, capacity: 60, hint: 'Open shelving, multiple levels' },
  { type: 'rack', label: 'Pallet Rack', category: 'storage', size: [270, 110, 400], color: '#a9cdf7', levels: 4, capacity: 24, hint: 'Heavy duty racking bay' },
  { type: 'unit', label: 'Storage Unit', category: 'storage', size: [200, 60, 220], color: '#bfdfae', levels: 6, capacity: 80, hint: 'Modular multi-compartment unit' },
  { type: 'cupboard', label: 'Cupboard', category: 'storage', size: [100, 50, 200], color: '#c8bff0', levels: 4, capacity: 40, hint: 'Closed doors, dry goods' },
  { type: 'cabinet', label: 'Cabinet', category: 'storage', size: [90, 45, 130], color: '#b9c4f2', levels: 3, capacity: 30, hint: 'Drawer cabinet / tool store' },
  { type: 'cage', label: 'Roll Cage', category: 'storage', size: [80, 70, 170], color: '#d6dfec', levels: 3, capacity: 18, hint: 'Mobile roll cage / trolley' },

  { type: 'pallet', label: 'Pallet', category: 'containers', size: [120, 100, 15], color: '#f0d9b5', levels: 1, capacity: 1, hint: 'Euro/standard pallet base' },
  { type: 'stack', label: 'Stack', category: 'containers', size: [120, 100, 160], color: '#ffc9ac', levels: 8, capacity: 8, hint: 'Stacked goods on the floor' },
  { type: 'box', label: 'Box', category: 'containers', size: [60, 40, 40], color: '#f7dcbc', levels: 1, capacity: 20, hint: 'Single carton or tote' },
  { type: 'crate', label: 'Crate', category: 'containers', size: [80, 60, 60], color: '#e8ceac', levels: 1, capacity: 30, hint: 'Reusable plastic/wood crate' },
  { type: 'bin', label: 'Bin', category: 'containers', size: [50, 50, 70], color: '#dcecb4', round: true, levels: 1, capacity: 12, hint: 'Round bin / hopper' },
  { type: 'drum', label: 'Drum', category: 'containers', size: [58, 58, 88], color: '#ffb8b8', round: true, levels: 1, capacity: 1, hint: '200 L steel drum' },
  { type: 'tank', label: 'Tank', category: 'containers', size: [150, 150, 200], color: '#b7e3ec', round: true, levels: 1, capacity: 1, hint: 'Bulk liquid tank (IBC/vessel)' },

  { type: 'fridge', label: 'Fridge', category: 'appliances', size: [70, 70, 185], color: '#9fe0cd', levels: 4, capacity: 40, tempC: 4, hint: 'Chilled storage 0–8 °C' },
  { type: 'freezer', label: 'Freezer', category: 'appliances', size: [90, 70, 90], color: '#a8dcf0', levels: 2, capacity: 24, tempC: -18, hint: 'Frozen storage below −15 °C' },

  { type: 'table', label: 'Table', category: 'surfaces', size: [160, 80, 75], color: '#e7ddd0', levels: 1, capacity: 10, hint: 'Staging / sorting table' },
  { type: 'workbench', label: 'Workbench', category: 'surfaces', size: [180, 75, 90], color: '#dcd3c6', levels: 2, capacity: 16, hint: 'Packing or repair bench' },

  // Obstacles carry an explicit zero capacity. Leaving it undefined let the
  // `?? 10` default in `addContainer` hand a structural column ten storage
  // slots, which then showed up as "0/10" in the capacity report.
  { type: 'pillar', label: 'Pillar', category: 'structure', size: [40, 40, 300], color: '#e2e6ee', obstacle: true, capacity: 0, hint: 'Structural column (obstacle)' },
  { type: 'door', label: 'Door / Access', category: 'structure', size: [110, 20, 210], color: '#bfe9cb', obstacle: true, capacity: 0, hint: 'Doorway, keep clear (obstacle)' },
]

export const CONTAINER_META: Record<ContainerType, ContainerTypeMeta> =
  Object.fromEntries(CONTAINER_TYPES.map((t) => [t.type, t])) as Record<ContainerType, ContainerTypeMeta>

/**
 * Stand-in for a type this build does not know about.
 *
 * Treated as an obstacle with no capacity: an unrecognised object still takes
 * up floor space and still blocks movement, but nothing will try to stock it.
 */
const UNKNOWN_META: ContainerTypeMeta = {
  type: 'box' as ContainerType,
  label: 'Unknown type',
  category: 'structure',
  size: [60, 40, 40],
  color: '#d8dde6',
  capacity: 0,
  obstacle: true,
  hint: 'This object came from a newer or hand-edited file and is not recognised.',
}

/**
 * Always use this instead of indexing `CONTAINER_META` directly.
 *
 * `Container.type` is typed, but data does not have to obey the type: a
 * hand-edited backup, or one written by a build that has since renamed a type,
 * carries whatever string it likes. A raw `CONTAINER_META[c.type].obstacle`
 * threw on the dashboard — the default view — which unmounted the whole React
 * tree. Because both the bad data and `view` are persisted, every reload
 * re-crashed and there was no way back to the reset button. Degrading to a
 * placeholder keeps the app navigable so the user can delete the object.
 */
export function containerMeta(type: ContainerType | string): ContainerTypeMeta {
  return CONTAINER_META[type as ContainerType] ?? UNKNOWN_META
}

export type Rotation = 0 | 90 | 180 | 270

export type SiteKind = 'warehouse' | 'distribution' | 'store' | 'factory' | 'yard' | 'office'

export const SITE_KINDS: { value: SiteKind; label: string }[] = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'distribution', label: 'Distribution centre' },
  { value: 'store', label: 'Retail store' },
  { value: 'factory', label: 'Factory' },
  { value: 'yard', label: 'Yard / outdoor' },
  { value: 'office', label: 'Office' },
]

/**
 * A physical location. Sites own rooms, rooms own containers, containers own
 * items — so the same room code can exist at two sites without colliding.
 */
export interface Site {
  id: ID
  code: string
  name: string
  kind: SiteKind
  address?: string
  city?: string
  country?: string
  manager?: string
  notes?: string
  createdAt: number
}

export interface Room {
  id: ID
  siteId: ID
  code: string
  name: string
  /** cm, X axis */
  width: number
  /** cm, Z axis */
  length: number
  /** cm, Y axis */
  height: number
  /** snap grid size in cm */
  grid: number
  floorColor: string
  wallColor: string
  /** Optional climate + operational metadata */
  tempC?: number
  humidity?: number
  zone?: string
  notes?: string
  createdAt: number
}

export interface Container {
  id: ID
  roomId: ID
  code: string
  name: string
  type: ContainerType
  /** centre of the footprint, cm, measured from the room's near-left corner */
  x: number
  z: number
  /** elevation of the base above the floor, cm (wall shelves, mezzanines) */
  y: number
  /** unrotated dimensions in cm */
  w: number
  d: number
  h: number
  rotation: Rotation
  color: string
  levels: number
  /** how many "slots" of stock the container holds before it is full */
  capacity: number
  maxWeightKg?: number
  tempC?: number
  zone?: string
  locked: boolean
  notes?: string
  createdAt: number
}

export type ItemStatus = 'in_stock' | 'reserved' | 'quarantine' | 'damaged' | 'expired'

export const ITEM_STATUSES: { value: ItemStatus; label: string; color: string }[] = [
  { value: 'in_stock', label: 'In stock', color: '#22c55e' },
  { value: 'reserved', label: 'Reserved', color: '#3b82f6' },
  { value: 'quarantine', label: 'Quarantine', color: '#f59e0b' },
  { value: 'damaged', label: 'Damaged', color: '#ef4444' },
  { value: 'expired', label: 'Expired', color: '#a855f7' },
]

export interface Item {
  id: ID
  containerId: ID
  sku: string
  barcode: string
  name: string
  category: string
  qty: number
  uom: Uom
  /** slots consumed inside the container (defaults to 1) */
  slots: number
  unitWeightKg?: number
  unitCost?: number
  minQty?: number
  lot?: string
  serial?: string
  status: ItemStatus
  supplier?: string
  /** free-text sub-location, e.g. "L2-B3" */
  slot?: string
  receivedAt?: string
  expiryAt?: string
  notes?: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type MovementType = 'receive' | 'issue' | 'transfer' | 'adjust' | 'relocate' | 'count' | 'dispose'

export const MOVEMENT_TYPES: { value: MovementType; label: string; sign: -1 | 0 | 1; color: string }[] = [
  { value: 'receive', label: 'Receive (GRN)', sign: 1, color: '#22c55e' },
  { value: 'issue', label: 'Issue / Pick', sign: -1, color: '#ef4444' },
  { value: 'transfer', label: 'Transfer', sign: 0, color: '#3b82f6' },
  { value: 'adjust', label: 'Adjustment', sign: 0, color: '#f59e0b' },
  { value: 'relocate', label: 'Relocate object', sign: 0, color: '#8b5cf6' },
  { value: 'count', label: 'Cycle count', sign: 0, color: '#14b8a6' },
  { value: 'dispose', label: 'Dispose / Scrap', sign: -1, color: '#a855f7' },
]

export interface Movement {
  id: ID
  ts: number
  type: MovementType
  itemId?: ID
  sku?: string
  name: string
  qty: number
  uom?: Uom
  fromContainerId?: ID
  toContainerId?: ID
  roomId?: ID
  reference?: string
  user: string
  note?: string
}

export type Units = 'cm' | 'm' | 'in'

export interface Settings {
  units: Units
  snapEnabled: boolean
  showGrid: boolean
  showWalls: boolean
  showLabels: boolean
  showFillBadges: boolean
  collisionEnabled: boolean
  wallClearance: number
  operator: string
  currency: string
  expiryWarnDays: number
  theme: 'dark' | 'light'
  /** UI language. Data the user typed is never translated. */
  language: 'en' | 'id'
}

export interface AppData {
  /**
   * Schema the backup was written at. Absent on files exported before
   * versioning existed, which are treated as pre-v3.
   */
  schemaVersion?: number
  sites: Site[]
  rooms: Room[]
  containers: Container[]
  items: Item[]
  movements: Movement[]
  settings: Settings
}
