import type { AppData, Container, ContainerType, Item, Movement, Room, Site, Uom } from '../types'
import { CONTAINER_META } from '../types'
import { generateBarcode, uid } from './utils'

/** Small deterministic PRNG so the demo dataset looks the same each time. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const CATALOG: { name: string; category: string; uom: Uom; cost: number; weight: number; perishable?: boolean }[] = [
  { name: 'Steel Bracket M8', category: 'Hardware', uom: 'pcs', cost: 1.4, weight: 0.12 },
  { name: 'Hex Bolt 10×60', category: 'Hardware', uom: 'box', cost: 12.5, weight: 2.4 },
  { name: 'Nitrile Gloves L', category: 'Consumables', uom: 'box', cost: 8.9, weight: 0.6 },
  { name: 'Packing Tape 48mm', category: 'Packaging', uom: 'roll', cost: 1.95, weight: 0.35 },
  { name: 'Corrugated Box 400×300', category: 'Packaging', uom: 'pcs', cost: 0.72, weight: 0.28 },
  { name: 'Stretch Wrap 500mm', category: 'Packaging', uom: 'roll', cost: 14.0, weight: 2.9 },
  { name: 'Hydraulic Oil ISO 46', category: 'Fluids', uom: 'l', cost: 4.6, weight: 0.88 },
  { name: 'Degreaser Concentrate', category: 'Chemicals', uom: 'l', cost: 6.2, weight: 1.02 },
  { name: 'Bearing 6204-2RS', category: 'Spare Parts', uom: 'pcs', cost: 5.4, weight: 0.11 },
  { name: 'Drive Belt A-42', category: 'Spare Parts', uom: 'pcs', cost: 9.8, weight: 0.4 },
  { name: 'LED Tube 18W', category: 'Electrical', uom: 'pcs', cost: 7.3, weight: 0.25 },
  { name: 'Cable 3×2.5mm²', category: 'Electrical', uom: 'm', cost: 2.1, weight: 0.14 },
  { name: 'Frozen Beef Patties', category: 'Food', uom: 'kg', cost: 7.9, weight: 1, perishable: true },
  { name: 'Chilled Dairy Cream', category: 'Food', uom: 'l', cost: 3.2, weight: 1.02, perishable: true },
  { name: 'Fresh Produce Mix', category: 'Food', uom: 'kg', cost: 2.4, weight: 1, perishable: true },
  { name: 'Vaccine Vials Batch', category: 'Pharma', uom: 'pack', cost: 210, weight: 0.4, perishable: true },
  { name: 'Copier Paper A4 80g', category: 'Office', uom: 'pack', cost: 4.5, weight: 2.5 },
  { name: 'Safety Helmet White', category: 'PPE', uom: 'pcs', cost: 11.2, weight: 0.42 },
  { name: 'Hi-Vis Vest XL', category: 'PPE', uom: 'pcs', cost: 6.4, weight: 0.2 },
  { name: 'Pallet Wood EUR', category: 'Logistics', uom: 'pcs', cost: 13.0, weight: 25 },
]

const SUPPLIERS = ['Nordwind Supply', 'Atlas Components', 'BluePeak Logistics', 'Meridian Foods', 'Orion Industrial']

interface Layout {
  type: ContainerType
  name: string
  x: number
  z: number
  rotation?: 0 | 90 | 180 | 270
  w?: number
  d?: number
  h?: number
}

export function buildSeed(): AppData {
  const rand = rng(20260725)
  const now = Date.now()
  const day = 86_400_000

  // Two sites so the site → room hierarchy is visible straight away, and so
  // duplicate room codes across sites are exercised by the demo data.
  const sites: Site[] = [
    {
      id: uid('site'), code: 'ST-01', name: 'Northgate Depot', kind: 'warehouse',
      address: '14 Northgate Way', city: 'Leeds', country: 'UK', manager: 'a.novak',
      notes: 'Primary distribution hub, 24/5 operation.', createdAt: now - 120 * day,
    },
    {
      id: uid('site'), code: 'ST-02', name: 'Harbour Cold Chain', kind: 'distribution',
      address: 'Dock Road, Unit 7', city: 'Hull', country: 'UK', manager: 'm.tan',
      notes: 'Temperature-controlled overflow near the port.', createdAt: now - 95 * day,
    },
  ]

  const rooms: Room[] = [
    {
      id: uid('room'), siteId: sites[0].id, code: 'RM-01', name: 'Main Warehouse',
      width: 2400, length: 1600, height: 600, grid: 20,
      floorColor: '#f6f7fb', wallColor: '#eef1f8', zone: 'A', tempC: 18, humidity: 45,
      notes: 'Primary bulk storage. Forklift aisles minimum 300 cm.', createdAt: now - 90 * day,
    },
    {
      id: uid('room'), siteId: sites[0].id, code: 'RM-02', name: 'Parts & Tool Room',
      width: 700, length: 500, height: 280, grid: 10,
      floorColor: '#faf6f1', wallColor: '#f3ede6', zone: 'B', tempC: 20, humidity: 40,
      notes: 'Small parts, consumables and workshop staging.', createdAt: now - 60 * day,
    },
    {
      id: uid('room'), siteId: sites[1].id, code: 'RM-01', name: 'Cold Store',
      width: 900, length: 700, height: 320, grid: 10,
      floorColor: '#eef6fa', wallColor: '#e6f0f6', zone: 'C', tempC: 2, humidity: 80,
      notes: 'Chilled and frozen goods. HACCP logged twice daily.', createdAt: now - 80 * day,
    },
  ]

  /**
   * Laid out on a deliberate grid: racking runs in aligned rows separated by
   * 310 cm forklift aisles, and the right-hand third is zoned for inbound,
   * bulk and packing. Everything is placed on round coordinates so the demo
   * reads as a planned warehouse rather than scattered furniture.
   */
  const rackRows = [220, 640, 1060]
  const rackCols = [220, 520, 820, 1120]
  const racks: Layout[] = rackRows.flatMap((z, ri) =>
    rackCols.map((x, ci) => ({
      type: 'rack' as ContainerType,
      name: `Rack ${String.fromCharCode(65 + ri)}${ci + 1}`,
      x,
      z,
    })),
  )

  // Keyed by room name, not code: codes are only unique within a site now, so
  // 'RM-01' exists at both sites.
  const layouts: Record<string, Layout[]> = {
    'Main Warehouse': [
      ...racks,
      { type: 'pillar', name: 'Column P1', x: 1330, z: 430 },
      { type: 'pillar', name: 'Column P2', x: 1330, z: 850 },

      // inbound / bulk zone
      { type: 'stack', name: 'Bulk Stack 1', x: 1560, z: 200 },
      { type: 'stack', name: 'Bulk Stack 2', x: 1700, z: 200 },
      { type: 'pallet', name: 'Inbound Pallet 1', x: 1560, z: 380 },
      { type: 'pallet', name: 'Inbound Pallet 2', x: 1700, z: 380 },
      { type: 'pallet', name: 'Outbound Pallet', x: 1840, z: 380 },
      { type: 'cage', name: 'Roll Cage 1', x: 1560, z: 560 },
      { type: 'cage', name: 'Roll Cage 2', x: 1660, z: 560 },

      // Fluids. The drums sit in front of the tank along the viewing diagonal
      // rather than behind it, so a 2 m tank never swallows their clicks.
      { type: 'tank', name: 'Bulk Tank', x: 2150, z: 420 },
      { type: 'drum', name: 'Oil Drum 1', x: 2300, z: 720 },
      { type: 'drum', name: 'Oil Drum 2', x: 2300, z: 800 },

      // packing bench line
      { type: 'workbench', name: 'Packing Bench', x: 1700, z: 760 },
      { type: 'table', name: 'Staging Table', x: 1700, z: 900 },

      // picking shelves along the right wall
      { type: 'shelf', name: 'Picking Shelf 1', x: 2350, z: 140, rotation: 90 },
      { type: 'shelf', name: 'Picking Shelf 2', x: 2350, z: 280, rotation: 90 },
      { type: 'shelf', name: 'Picking Shelf 3', x: 2350, z: 420, rotation: 90 },
      { type: 'shelf', name: 'Picking Shelf 4', x: 2350, z: 560, rotation: 90 },

      { type: 'door', name: 'Dock Door', x: 700, z: 1590, w: 300 },
    ],

    'Cold Store': [
      { type: 'freezer', name: 'Freezer F1', x: 110, z: 90 },
      { type: 'freezer', name: 'Freezer F2', x: 215, z: 90 },
      { type: 'freezer', name: 'Freezer F3', x: 320, z: 90 },
      { type: 'fridge', name: 'Fridge C1', x: 480, z: 90 },
      { type: 'fridge', name: 'Fridge C2', x: 570, z: 90 },
      { type: 'fridge', name: 'Fridge C3', x: 660, z: 90 },
      { type: 'fridge', name: 'Fridge C4', x: 750, z: 90 },
      { type: 'shelf', name: 'Chill Shelf 1', x: 110, z: 300 },
      { type: 'shelf', name: 'Chill Shelf 2', x: 250, z: 300 },
      { type: 'shelf', name: 'Chill Shelf 3', x: 390, z: 300 },
      { type: 'crate', name: 'Crate CR1', x: 600, z: 300 },
      { type: 'crate', name: 'Crate CR2', x: 700, z: 300 },
      { type: 'pallet', name: 'Cold Pallet', x: 250, z: 480 },
      { type: 'door', name: 'Cold Door', x: 800, z: 690 },
    ],

    'Parts & Tool Room': [
      { type: 'cupboard', name: 'Cupboard 1', x: 80, z: 60 },
      { type: 'cupboard', name: 'Cupboard 2', x: 190, z: 60 },
      { type: 'cabinet', name: 'Tool Cabinet', x: 300, z: 60 },
      { type: 'unit', name: 'Parts Unit A', x: 500, z: 60 },
      { type: 'unit', name: 'Parts Unit B', x: 150, z: 250 },
      { type: 'workbench', name: 'Repair Bench', x: 400, z: 250 },
      { type: 'shelf', name: 'Small Parts Shelf', x: 660, z: 220, rotation: 90 },
      { type: 'box', name: 'Tote 1', x: 80, z: 400 },
      { type: 'box', name: 'Tote 2', x: 160, z: 400 },
      { type: 'bin', name: 'Scrap Bin', x: 620, z: 420 },
    ],
  }

  const containers: Container[] = []
  const counters: Record<string, number> = {}
  for (const room of rooms) {
    for (const l of layouts[room.name] ?? []) {
      const meta = CONTAINER_META[l.type]
      const prefix = l.type.slice(0, 3).toUpperCase()
      counters[prefix] = (counters[prefix] ?? 0) + 1
      containers.push({
        id: uid('cnt'),
        roomId: room.id,
        code: `${prefix}-${String(counters[prefix]).padStart(2, '0')}`,
        name: l.name,
        type: l.type,
        x: l.x, z: l.z, y: 0,
        w: l.w ?? meta.size[0],
        d: l.d ?? meta.size[1],
        h: Math.min(l.h ?? meta.size[2], room.height),
        rotation: l.rotation ?? 0,
        color: meta.color,
        levels: meta.levels ?? 1,
        capacity: meta.capacity ?? 10,
        maxWeightKg: l.type === 'rack' ? 1200 : l.type === 'pallet' ? 800 : l.type === 'shelf' ? 300 : undefined,
        tempC: meta.tempC ?? room.tempC,
        zone: room.zone,
        locked: !!meta.obstacle,
        createdAt: room.createdAt + 1000,
      })
    }
  }

  const storable = containers.filter((c) => !CONTAINER_META[c.type].obstacle)
  const items: Item[] = []
  const movements: Movement[] = []
  let seq = 1

  for (const c of storable) {
    // Leave roughly a fifth of the objects empty so "filled only" rendering shows.
    if (rand() < 0.18) continue
    const lines = 1 + Math.floor(rand() * Math.min(5, Math.max(1, c.capacity / 6)))
    const cold = c.type === 'fridge' || c.type === 'freezer'
    let freeSlots = c.capacity
    for (let n = 0; n < lines; n++) {
      if (freeSlots <= 0) break
      const pool = cold ? CATALOG.filter((p) => p.perishable) : CATALOG.filter((p) => !p.perishable || rand() < 0.2)
      const p = pool[Math.floor(rand() * pool.length)] ?? CATALOG[0]
      const qty = Math.max(1, Math.round(rand() * 120))
      const received = now - Math.floor(rand() * 120) * day
      const perishable = p.perishable || rand() < 0.15
      const expiry = perishable ? received + Math.floor(20 + rand() * 200) * day : undefined
      const expired = expiry !== undefined && expiry < now
      const roll = rand()
      // Never seed a container past its own capacity — over-fill should only
      // show up where the demo deliberately creates an alert.
      const slots = Math.max(1, Math.min(freeSlots, 1 + Math.floor(rand() * 2)))
      freeSlots -= slots
      items.push({
        id: uid('itm'),
        containerId: c.id,
        sku: `${p.category.slice(0, 3).toUpperCase()}-${String(seq).padStart(5, '0')}`,
        barcode: generateBarcode(),
        name: p.name,
        category: p.category,
        qty,
        uom: p.uom,
        slots,
        unitWeightKg: p.weight,
        unitCost: p.cost,
        minQty: Math.round(qty * (0.1 + rand() * 0.4)),
        lot: `L${String(1000 + Math.floor(rand() * 9000))}`,
        status: expired ? 'expired' : roll > 0.94 ? 'quarantine' : roll > 0.88 ? 'reserved' : roll > 0.85 ? 'damaged' : 'in_stock',
        supplier: SUPPLIERS[Math.floor(rand() * SUPPLIERS.length)],
        slot: `L${1 + Math.floor(rand() * c.levels)}-${String.fromCharCode(65 + Math.floor(rand() * 4))}${1 + Math.floor(rand() * 6)}`,
        receivedAt: new Date(received).toISOString().slice(0, 10),
        expiryAt: expiry ? new Date(expiry).toISOString().slice(0, 10) : undefined,
        tags: rand() > 0.7 ? ['fast-mover'] : rand() > 0.85 ? ['fragile'] : [],
        createdAt: received,
        updatedAt: received,
      })
      seq++
    }
  }

  // A believable movement history over the last 45 days.
  const types: Movement['type'][] = ['receive', 'issue', 'transfer', 'adjust', 'count']
  for (let i = 0; i < 160; i++) {
    const it = items[Math.floor(rand() * items.length)]
    if (!it) break
    const type = types[Math.floor(rand() * types.length)]
    const from = containers.find((c) => c.id === it.containerId)
    const to = storable[Math.floor(rand() * storable.length)]
    const qty = Math.max(1, Math.round(rand() * 30))
    movements.push({
      id: uid('mv'),
      ts: now - Math.floor(rand() * 45 * day),
      type,
      itemId: it.id,
      sku: it.sku,
      name: it.name,
      qty: type === 'issue' ? -qty : qty,
      uom: it.uom,
      fromContainerId: type === 'transfer' || type === 'issue' ? from?.id : undefined,
      toContainerId: type === 'transfer' ? to.id : type === 'receive' ? from?.id : undefined,
      roomId: from?.roomId,
      reference: `${type === 'receive' ? 'GRN' : type === 'issue' ? 'PICK' : 'DOC'}-${10000 + Math.floor(rand() * 9000)}`,
      user: ['operator', 'a.novak', 'j.reyes', 'm.tan'][Math.floor(rand() * 4)],
      note: type === 'count' ? 'Cycle count variance' : undefined,
    })
  }
  movements.sort((a, b) => b.ts - a.ts)

  return {
    sites,
    rooms,
    containers,
    items,
    movements,
    settings: {
      units: 'cm', snapEnabled: true, showGrid: true, showWalls: true, showLabels: false,
      showFillBadges: true, collisionEnabled: true, wallClearance: 0, operator: 'operator',
      currency: 'USD', expiryWarnDays: 30, theme: 'light',
    },
  }
}
