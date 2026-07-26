import { useMemo, useState } from 'react'
import {
  ArrowUpDown, Download, Filter, MapPin, PackagePlus, Printer, Search, X, ScanLine,
} from 'lucide-react'
import type { Item, ItemStatus } from '../types'
import { ITEM_STATUSES } from '../types'
import { useStore } from '../store'
import { ItemForm } from '../components/ItemForm'
import { LabelSheet } from '../components/LabelSheet'
import { Empty, Select } from '../components/ui'
import { toCSV } from '../lib/csv'
import { cx, daysUntil, download, fmtDate, fmtMoney, fmtNum } from '../lib/utils'

type SortKey = 'name' | 'sku' | 'qty' | 'value' | 'expiry' | 'location' | 'category' | 'updated'

export function InventoryView() {
  const items = useStore((s) => s.items)
  const containers = useStore((s) => s.containers)
  const rooms = useStore((s) => s.rooms)
  const settings = useStore((s) => s.settings)
  const setView = useStore((s) => s.setView)
  const setActiveRoom = useStore((s) => s.setActiveRoom)
  const revealContainer = useStore((s) => s.revealContainer)
  const setInspectorTab = useStore((s) => s.setInspectorTab)

  const [q, setQ] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const [containerFilter, setContainerFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | ItemStatus>('')
  const [flag, setFlag] = useState<'' | 'low' | 'expiring' | 'expired'>('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updated', dir: -1 })
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [labelsOpen, setLabelsOpen] = useState(false)

  const locate = useMemo(() => {
    const cmap = new Map(containers.map((c) => [c.id, c]))
    const rmap = new Map(rooms.map((r) => [r.id, r]))
    return (containerId: string) => {
      const c = cmap.get(containerId)
      const r = c ? rmap.get(c.roomId) : undefined
      return { container: c, room: r, label: `${r?.code ?? '—'} / ${c?.code ?? '—'}` }
    }
  }, [containers, rooms])

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let out = items.filter((i) => {
      if (s && ![i.name, i.sku, i.barcode, i.lot, i.serial, i.supplier, i.category, i.slot, ...i.tags]
        .some((f) => f?.toString().toLowerCase().includes(s))) return false
      const loc = locate(i.containerId)
      if (roomFilter && loc.room?.id !== roomFilter) return false
      if (containerFilter && i.containerId !== containerFilter) return false
      if (categoryFilter && i.category !== categoryFilter) return false
      if (statusFilter && i.status !== statusFilter) return false
      if (flag === 'low' && !((i.minQty ?? 0) > 0 && i.qty <= (i.minQty ?? 0))) return false
      if (flag === 'expiring') {
        const d = daysUntil(i.expiryAt)
        if (d === null || d < 0 || d > settings.expiryWarnDays) return false
      }
      if (flag === 'expired') {
        const d = daysUntil(i.expiryAt)
        if (d === null || d >= 0) return false
      }
      return true
    })

    const val = (i: Item) => (i.unitCost ?? 0) * i.qty
    out = [...out].sort((a, b) => {
      const dir = sort.dir
      switch (sort.key) {
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'sku': return a.sku.localeCompare(b.sku) * dir
        case 'qty': return (a.qty - b.qty) * dir
        case 'value': return (val(a) - val(b)) * dir
        case 'category': return a.category.localeCompare(b.category) * dir
        case 'location': return locate(a.containerId).label.localeCompare(locate(b.containerId).label) * dir
        case 'expiry': return ((a.expiryAt ?? '9999').localeCompare(b.expiryAt ?? '9999')) * dir
        default: return (a.updatedAt - b.updatedAt) * dir
      }
    })
    return out
  }, [items, q, roomFilter, containerFilter, categoryFilter, statusFilter, flag, sort, locate, settings.expiryWarnDays])

  const totals = useMemo(() => ({
    qty: filtered.reduce((n, i) => n + i.qty, 0),
    value: filtered.reduce((n, i) => n + (i.unitCost ?? 0) * i.qty, 0),
    weight: filtered.reduce((n, i) => n + (i.unitWeightKg ?? 0) * i.qty, 0),
  }), [filtered])

  const th = (key: SortKey, label: string, extra?: string) => (
    <th
      className={cx('cursor-pointer select-none', extra)}
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }))}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.key === key && <ArrowUpDown size={10} />}
      </span>
    </th>
  )

  const exportCsv = () => {
    const rows = filtered.map((i) => {
      const loc = locate(i.containerId)
      return {
        sku: i.sku, barcode: i.barcode, name: i.name, category: i.category, status: i.status,
        qty: i.qty, uom: i.uom, slots: i.slots,
        unit_cost: i.unitCost ?? '', line_value: (i.unitCost ?? 0) * i.qty,
        unit_weight_kg: i.unitWeightKg ?? '', line_weight_kg: (i.unitWeightKg ?? 0) * i.qty,
        min_qty: i.minQty ?? '', lot: i.lot ?? '', serial: i.serial ?? '', supplier: i.supplier ?? '',
        room: loc.room?.code ?? '', room_name: loc.room?.name ?? '',
        container: loc.container?.code ?? '', container_name: loc.container?.name ?? '',
        sub_location: i.slot ?? '', received: i.receivedAt ?? '', expiry: i.expiryAt ?? '',
        tags: i.tags.join('|'), notes: i.notes ?? '',
      }
    })
    download(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), 'text/csv')
  }

  const jump = (i: Item) => {
    const c = containers.find((k) => k.id === i.containerId)
    if (!c) return
    setInspectorTab('items')
    revealContainer(c.id)
  }

  const toggle = (id: string) =>
    setSelection((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const selectedItems = filtered.filter((i) => selection.has(i.id))
  const activeFilters = [roomFilter, containerFilter, categoryFilter, statusFilter, flag].filter(Boolean).length

  return (
    <div className="flex h-full flex-col">
      <header className="border-b hairline px-3 py-3 sm:px-5" style={{ background: 'var(--panel)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h1 className="text-[15px] font-semibold">Inventory</h1>
            <p className="text-[11.5px] muted">
              {fmtNum(filtered.length)} of {fmtNum(items.length)} lines · {fmtNum(totals.qty)} units ·
              {' '}{fmtMoney(totals.value, settings.currency)} · {fmtNum(totals.weight, 1)} kg
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <ScanLine size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 muted" />
              <input
                className="input w-full pl-7 sm:w-64"
                placeholder="Search or scan barcode…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button className="absolute right-1.5 top-1/2 -translate-y-1/2 muted" onClick={() => setQ('')}><X size={13} /></button>
              )}
            </div>
            <button className="btn" onClick={exportCsv} disabled={!filtered.length}><Download size={13} /> CSV</button>
            <button className="btn" onClick={() => setLabelsOpen(true)} disabled={!(selectedItems.length || filtered.length)}>
              <Printer size={13} /> Labels{selectedItems.length ? ` (${selectedItems.length})` : ''}
            </button>
            <button className="btn btn-primary" onClick={() => { setEditItem(null); setFormOpen(true) }} disabled={!containers.length}>
              <PackagePlus size={13} /> New item
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] muted"><Filter size={12} /> Filters{activeFilters ? ` (${activeFilters})` : ''}</span>
          <Select
            className="w-[150px]"
            value={roomFilter}
            onChange={(v) => { setRoomFilter(v); setContainerFilter('') }}
            options={[{ value: '', label: 'All rooms' }, ...rooms.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }))]}
            ariaLabel="Filter by room"
          />
          <Select
            className="w-[160px]"
            value={containerFilter}
            onChange={setContainerFilter}
            options={[
              { value: '', label: 'All containers' },
              ...containers.filter((c) => !roomFilter || c.roomId === roomFilter).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })),
            ]}
            ariaLabel="Filter by container"
          />
          <Select
            className="w-[140px]"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
            ariaLabel="Filter by category"
          />
          <Select
            className="w-[130px]"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as ItemStatus | '')}
            options={[{ value: '', label: 'Any status' }, ...ITEM_STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
            ariaLabel="Filter by status"
          />
          {(['low', 'expiring', 'expired'] as const).map((f) => (
            <button key={f} className={cx('btn btn-sm', flag === f && 'btn-active')} onClick={() => setFlag(flag === f ? '' : f)}>
              {f === 'low' ? 'Low stock' : f === 'expiring' ? `Expiring ≤${settings.expiryWarnDays}d` : 'Expired'}
            </button>
          ))}
          {activeFilters > 0 && (
            <button className="btn btn-sm" onClick={() => { setRoomFilter(''); setContainerFilter(''); setCategoryFilter(''); setStatusFilter(''); setFlag('') }}>
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <Empty
            title={items.length ? 'No items match these filters' : 'No inventory yet'}
            hint={items.length ? 'Adjust or clear the filters above.' : 'Add stock lines to containers to start tracking quantities, barcodes, lots and expiry dates.'}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={selection.size > 0 && selection.size === filtered.length}
                    onChange={(e) => setSelection(e.target.checked ? new Set(filtered.map((i) => i.id)) : new Set())}
                  />
                </th>
                {th('name', 'Item')}
                {th('sku', 'SKU / Barcode')}
                {th('category', 'Category')}
                <th>Status</th>
                {th('qty', 'Qty', 'num')}
                <th className="num">Value</th>
                {th('location', 'Location')}
                {th('expiry', 'Expiry')}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const loc = locate(i.containerId)
                const d = daysUntil(i.expiryAt)
                const low = (i.minQty ?? 0) > 0 && i.qty <= (i.minQty ?? 0)
                const status = ITEM_STATUSES.find((s) => s.value === i.status)
                return (
                  <tr key={i.id} className={cx(selection.has(i.id) && 'selected')}>
                    <td><input type="checkbox" checked={selection.has(i.id)} onChange={() => toggle(i.id)} /></td>
                    <td>
                      <button className="text-left" onClick={() => { setEditItem(i); setFormOpen(true) }}>
                        <span className="block font-medium">{i.name}</span>
                        {(i.lot || i.slot || i.tags.length > 0) && (
                          <span className="mono block text-[10px] muted">
                            {[i.lot && `lot ${i.lot}`, i.slot, ...i.tags].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="mono">
                      <span className="block">{i.sku}</span>
                      <span className="block text-[10px] muted">{i.barcode}</span>
                    </td>
                    <td className="muted">{i.category}</td>
                    <td>
                      <span className="chip" style={{ color: status?.color, borderColor: `${status?.color}55` }}>{status?.label}</span>
                    </td>
                    <td className={cx('num tabular-nums', low && 'text-amber-400')}>
                      {fmtNum(i.qty)} <span className="text-[10px] muted">{i.uom}</span>
                    </td>
                    <td className="num tabular-nums muted">{fmtMoney((i.unitCost ?? 0) * i.qty, settings.currency)}</td>
                    <td className="mono">
                      <button className="hover:underline" onClick={() => jump(i)} title="Show in layout">{loc.label}</button>
                    </td>
                    <td className={cx('mono', d !== null && d < 0 ? 'text-red-400' : d !== null && d <= settings.expiryWarnDays ? 'text-amber-400' : 'muted')}>
                      {i.expiryAt ? `${fmtDate(i.expiryAt)}${d !== null ? ` (${d}d)` : ''}` : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => jump(i)} title="Locate"><MapPin size={12} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ItemForm open={formOpen} onClose={() => { setFormOpen(false); setEditItem(null) }} item={editItem} />
      <LabelSheet
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        items={selectedItems.length ? selectedItems : filtered}
        title={selectedItems.length ? `${selectedItems.length} selected` : 'Filtered inventory'}
      />
    </div>
  )
}
