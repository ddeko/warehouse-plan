import { useMemo } from 'react'
import {
  AlertTriangle, ArrowRight, Boxes, CalendarClock, CircleDollarSign, Layers, Package,
  Scale, Sparkles, TrendingDown, Warehouse, Plus,
} from 'lucide-react'
import { useStore, containerStats } from '../store'
import { Bar, Empty, Stat, SectionTitle } from '../components/ui'
import { CONTAINER_META, ITEM_STATUSES } from '../types'
import { areaM2, cx, daysUntil, fmtDateTime, fmtMoney, fmtNum } from '../lib/utils'
import { usedFloorArea } from '../lib/geometry'
import { describeLocation } from '../lib/movements'

export function Dashboard() {
  const rooms = useStore((s) => s.rooms)
  const containers = useStore((s) => s.containers)
  const items = useStore((s) => s.items)
  const movements = useStore((s) => s.movements)
  const settings = useStore((s) => s.settings)
  const setView = useStore((s) => s.setView)
  const setActiveRoom = useStore((s) => s.setActiveRoom)
  const selectContainer = useStore((s) => s.selectContainer)
  const setInspectorTab = useStore((s) => s.setInspectorTab)
  const loadSample = useStore((s) => s.loadSample)

  const kpis = useMemo(() => {
    const qty = items.reduce((n, i) => n + i.qty, 0)
    const value = items.reduce((n, i) => n + (i.unitCost ?? 0) * i.qty, 0)
    const weight = items.reduce((n, i) => n + (i.unitWeightKg ?? 0) * i.qty, 0)
    const storable = containers.filter((c) => !CONTAINER_META[c.type].obstacle)
    const cap = storable.reduce((n, c) => n + c.capacity, 0)
    const slots = items.reduce((n, i) => n + (i.slots || 1), 0)
    const floor = rooms.reduce((n, r) => n + r.width * r.length, 0)
    const usedFloor = usedFloorArea(containers)
    return { qty, value, weight, cap, slots, floor, usedFloor, storable: storable.length }
  }, [items, containers, rooms])

  const alerts = useMemo(() => {
    const lowStock = items.filter((i) => (i.minQty ?? 0) > 0 && i.qty <= (i.minQty ?? 0))
    const expiring = items
      .map((i) => ({ i, d: daysUntil(i.expiryAt) }))
      .filter((x) => x.d !== null && x.d <= settings.expiryWarnDays)
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
    const over = containers
      .map((c) => ({ c, st: containerStats(items, c) }))
      .filter((x) => x.st.fill > 1 || x.st.overweight)
    const emptyContainers = containers.filter(
      (c) => !CONTAINER_META[c.type].obstacle && !items.some((i) => i.containerId === c.id),
    )
    return { lowStock, expiring, over, emptyContainers }
  }, [items, containers, settings.expiryWarnDays])

  const byCategory = useMemo(() => {
    const map = new Map<string, { qty: number; value: number; lines: number }>()
    for (const i of items) {
      const cur = map.get(i.category) ?? { qty: 0, value: 0, lines: 0 }
      cur.qty += i.qty
      cur.value += (i.unitCost ?? 0) * i.qty
      cur.lines += 1
      map.set(i.category, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 8)
  }, [items])

  const containerMap = useMemo(() => new Map(containers.map((c) => [c.id, c])), [containers])
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])

  const byStatus = useMemo(() => {
    return ITEM_STATUSES.map((s) => ({
      ...s,
      count: items.filter((i) => i.status === s.value).length,
    })).filter((s) => s.count > 0)
  }, [items])

  const jumpToContainer = (containerId: string, tab: 'object' | 'items' = 'items') => {
    const c = containers.find((k) => k.id === containerId)
    if (!c) return
    setActiveRoom(c.roomId)
    selectContainer(c.id)
    setInspectorTab(tab)
    setView('rooms')
  }

  if (!rooms.length && !items.length) {
    return (
      <Empty
        title="Welcome to StoreSpace"
        hint="Model your rooms to real dimensions, place shelves, racks, fridges and pallets inside them, then track every item, barcode, lot and movement. Start from a sample warehouse or build your own."
        action={
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={loadSample}><Sparkles size={14} /> Load sample warehouse</button>
            <button className="btn" onClick={() => setView('rooms')}><Plus size={14} /> Create first room</button>
          </div>
        }
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center justify-between gap-3 border-b hairline px-5 py-3.5" style={{ background: 'var(--panel)' }}>
        <div>
          <h1 className="text-[15px] font-semibold">Dashboard</h1>
          <p className="text-[11.5px] muted">Live snapshot across {rooms.length} rooms and {containers.length} storage objects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setView('rooms')}>Open layout <ArrowRight size={13} /></button>
      </header>

      {/* Capped width: on a wide monitor the six-column KPI row and the cards
          below stretched into unreadably long lines. */}
      <div className="mx-auto max-w-[1560px] space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="Rooms"
            value={rooms.length}
            sub={`${fmtNum(rooms.reduce((n, r) => n + areaM2(r.width, r.length), 0), 1)} m² floor`}
            icon={<Warehouse size={14} />}
          />
          <Stat label="Storage objects" value={containers.length} sub={`${kpis.storable} hold stock`} icon={<Boxes size={14} />} />
          <Stat label="Stock lines" value={fmtNum(items.length)} sub={`${fmtNum(kpis.qty)} units`} icon={<Package size={14} />} />
          <Stat
            label="Slot occupancy"
            value={`${kpis.cap ? Math.round((kpis.slots / kpis.cap) * 100) : 0}%`}
            sub={`${fmtNum(kpis.slots)} / ${fmtNum(kpis.cap)} slots`}
            tone={kpis.cap && kpis.slots / kpis.cap > 0.9 ? 'warn' : 'info'}
            icon={<Layers size={14} />}
          />
          <Stat label="Inventory value" value={fmtMoney(kpis.value, settings.currency)} sub={`${fmtNum(kpis.weight, 0)} kg total`} tone="good" icon={<CircleDollarSign size={14} />} />
          <Stat
            label="Open alerts"
            value={alerts.lowStock.length + alerts.expiring.length + alerts.over.length}
            sub="low stock · expiry · capacity"
            tone={alerts.lowStock.length + alerts.expiring.length + alerts.over.length > 0 ? 'bad' : 'good'}
            icon={<AlertTriangle size={14} />}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* rooms */}
          <section className="card p-3 lg:col-span-2">
            <SectionTitle right={<button className="btn btn-sm" onClick={() => setView('rooms')}>Manage</button>}>Room utilisation</SectionTitle>
            <div className="space-y-2.5">
              {rooms.map((r) => {
                const list = containers.filter((c) => c.roomId === r.id)
                const ids = new Set(list.map((c) => c.id))
                const roomItems = items.filter((i) => ids.has(i.containerId))
                const floorRatio = usedFloorArea(list) / (r.width * r.length)
                const cap = list.reduce((n, c) => n + c.capacity, 0)
                const slots = roomItems.reduce((n, i) => n + (i.slots || 1), 0)
                return (
                  <button
                    key={r.id}
                    className="w-full rounded-lg p-2 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => { setActiveRoom(r.id); setView('rooms') }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{r.name}</span>
                      <span className="mono shrink-0 text-[10.5px] muted">
                        {r.width / 100}×{r.length / 100} m · {list.length} obj · {roomItems.length} lines
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-3">
                      <div>
                        <div className="mb-0.5 flex justify-between text-[10px] muted"><span>Floor</span><span>{Math.round(floorRatio * 100)}%</span></div>
                        <Bar ratio={floorRatio} height={4} />
                      </div>
                      <div>
                        <div className="mb-0.5 flex justify-between text-[10px] muted"><span>Slots</span><span>{cap ? Math.round((slots / cap) * 100) : 0}%</span></div>
                        <Bar ratio={cap ? slots / cap : 0} height={4} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* status mix */}
          <section className="card p-3">
            <SectionTitle>Stock status</SectionTitle>
            {byStatus.length === 0 ? (
              <p className="py-6 text-center text-[12px] muted">No stock recorded.</p>
            ) : (
              <div className="space-y-2">
                {byStatus.map((s) => (
                  <div key={s.value}>
                    <div className="mb-0.5 flex justify-between text-[11px]">
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                      <span className="tabular-nums muted">{s.count}</span>
                    </div>
                    <Bar ratio={s.count / Math.max(1, items.length)} color={s.color} height={4} />
                  </div>
                ))}
              </div>
            )}

            <SectionTitle>Top categories by value</SectionTitle>
            <div className="space-y-1.5">
              {byCategory.map(([cat, v]) => (
                <div key={cat}>
                  <div className="mb-0.5 flex justify-between text-[11px]">
                    <span className="truncate">{cat}</span>
                    <span className="tabular-nums muted">{fmtMoney(v.value, settings.currency)}</span>
                  </div>
                  <Bar ratio={v.value / Math.max(1, byCategory[0][1].value)} height={4} />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* alerts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <AlertCard
            title="Low stock"
            icon={<TrendingDown size={13} />}
            tone="#f59e0b"
            empty="All lines above their reorder point."
            rows={alerts.lowStock.slice(0, 8).map((i) => ({
              id: i.id,
              main: i.name,
              sub: `${i.sku} · ${fmtNum(i.qty)} ${i.uom} ≤ min ${fmtNum(i.minQty ?? 0)}`,
              onClick: () => jumpToContainer(i.containerId),
            }))}
            more={Math.max(0, alerts.lowStock.length - 8)}
          />
          <AlertCard
            title="Expiring / expired"
            icon={<CalendarClock size={13} />}
            tone="#ef4444"
            empty={`Nothing expires in the next ${settings.expiryWarnDays} days.`}
            rows={alerts.expiring.slice(0, 8).map(({ i, d }) => ({
              id: i.id,
              main: i.name,
              sub: `${i.sku} · ${d! < 0 ? `expired ${-d!} days ago` : `${d} days left`}`,
              onClick: () => jumpToContainer(i.containerId),
            }))}
            more={Math.max(0, alerts.expiring.length - 8)}
          />
          <AlertCard
            title="Capacity & load"
            icon={<Scale size={13} />}
            tone="#ef4444"
            empty="No container is over capacity or overweight."
            rows={alerts.over.slice(0, 8).map(({ c, st }) => ({
              id: c.id,
              main: `${c.code} — ${c.name}`,
              sub: st.overweight
                ? `${fmtNum(st.weight, 0)} kg over ${fmtNum(c.maxWeightKg ?? 0, 0)} kg limit`
                : `${st.usedSlots}/${c.capacity} slots (${Math.round(st.fill * 100)}%)`,
              onClick: () => jumpToContainer(c.id, 'object'),
            }))}
            more={Math.max(0, alerts.over.length - 8)}
          />
        </div>

        {/* recent activity */}
        <section className="card p-3">
          <SectionTitle right={<button className="btn btn-sm" onClick={() => setView('movements')}>All movements</button>}>Recent activity</SectionTitle>
          {movements.length === 0 ? (
            <p className="py-6 text-center text-[12px] muted">No movements recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Type</th><th>Item</th><th className="num">Qty</th><th>Location</th><th>User</th></tr>
                </thead>
                <tbody>
                  {movements.slice(0, 10).map((m) => (
                    <tr key={m.id}>
                      <td className="mono whitespace-nowrap muted">{fmtDateTime(m.ts)}</td>
                      <td><span className="chip">{m.type}</span></td>
                      <td className="max-w-[240px] truncate">{m.name}</td>
                      <td className={cx('num tabular-nums', m.qty < 0 ? 'text-[#e05252]' : m.qty > 0 ? 'text-[#3fae8f]' : 'muted')}>
                        {m.qty === 0 ? '—' : `${m.qty > 0 ? '+' : ''}${fmtNum(m.qty)} ${m.uom ?? ''}`}
                      </td>
                      <td className="mono muted">{describeLocation(m, containerMap, roomMap)}</td>
                      <td className="muted">{m.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function AlertCard({
  title, icon, tone, rows, empty, more,
}: {
  title: string
  icon: React.ReactNode
  tone: string
  rows: { id: string; main: string; sub: string; onClick: () => void }[]
  empty: string
  more: number
}) {
  return (
    <section className="card p-3">
      <SectionTitle right={<span className="chip" style={{ color: rows.length ? tone : undefined, borderColor: rows.length ? `${tone}55` : undefined }}>{rows.length}</span>}>
        <span className="flex items-center gap-1.5" style={{ color: rows.length ? tone : undefined }}>{icon}{title}</span>
      </SectionTitle>
      {rows.length === 0 ? (
        <p className="py-5 text-center text-[11.5px] muted">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r) => (
            <li key={r.id}>
              <button className="w-full rounded-md px-1.5 py-1 text-left hover:bg-[var(--panel-2)]" onClick={r.onClick}>
                <span className="block truncate text-[12.5px]">{r.main}</span>
                <span className="mono block truncate text-[10.5px] muted">{r.sub}</span>
              </button>
            </li>
          ))}
          {more > 0 && <li className="px-1.5 pt-1 text-[10.5px] muted">+{more} more</li>}
        </ul>
      )}
    </section>
  )
}
