import { useEffect, useMemo, useState } from 'react'
import {
  Copy, Lock, LockOpen, Minus, Plus, Printer, RotateCw, Search, Tag, Trash2, Crosshair,
  PackagePlus, ArrowLeftRight,
} from 'lucide-react'
import type { Container, ContainerType, Item } from '../types'
import { CONTAINER_TYPES, containerMeta, ITEM_STATUSES } from '../types'
import { useStore, containerStats } from '../store'
import { Bar, Confirm, Field, Select, SelectField, TextField, Toggle, Empty } from './ui'
import { ItemForm } from './ItemForm'
import { LabelSheet } from './LabelSheet'
import { TypeIcon } from './TypeIcon'
import { cx, daysUntil, fmtMoney, fmtNum, fromCm, toCm, unitSuffix, volM3 } from '../lib/utils'

const SWATCHES = [
  '#ffe0a3', '#ffc9ac', '#ffb8b8', '#c8bff0', '#a9cdf7',
  '#9fe0cd', '#bfdfae', '#f0d9b5', '#d6dfec', '#e7ddd0',
]

/**
 * Compact numeric input with a unit chip, matching a CAD property sheet.
 *
 * Holds a draft while focused and only commits on blur or Enter. Writing
 * straight through on every keystroke made the fields hostile to edit: to
 * retype a width you first clear it, `Number('')` is 0, and the object
 * collapsed to the 1 cm floor and was often relocated by the re-placement
 * pass before the second digit arrived. In metres it was worse — "1.2" was
 * destroyed at the decimal point, because the committed 1 came straight back
 * through the cm round-trip as "0.01".
 */
function Num({
  label, value, onChange, suffix, step = 1, min, max, disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
  min?: number
  max?: number
  disabled?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(Number.isFinite(value) ? value : 0)

  const commit = () => {
    if (draft === null) return
    const n = Number(draft)
    setDraft(null)
    // An empty or unparseable box reverts rather than committing a zero.
    if (draft.trim() === '' || Number.isNaN(n)) return
    if (n !== value) onChange(n)
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type="number"
          className="input pr-9"
          value={shown}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); setDraft(null) }
          }}
        />
        {suffix && <span className="field-unit">{suffix}</span>}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: Item['status'] }) {
  const meta = ITEM_STATUSES.find((s) => s.value === status)
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: meta?.color }} title={meta?.label} />
}

export function ContainerInspector({ container }: { container: Container }) {
  const tab = useStore((s) => s.inspectorTab)
  const setTab = useStore((s) => s.setInspectorTab)
  const updateContainer = useStore((s) => s.updateContainer)
  const removeContainer = useStore((s) => s.removeContainer)
  const duplicateContainer = useStore((s) => s.duplicateContainer)
  const rotateContainer = useStore((s) => s.rotateContainer)
  const moveContainer = useStore((s) => s.moveContainer)
  const adjustQty = useStore((s) => s.adjustQty)
  const transferItem = useStore((s) => s.transferItem)
  const isPlacementValid = useStore((s) => s.isPlacementValid)
  const allItems = useStore((s) => s.items)
  const containers = useStore((s) => s.containers)
  const rooms = useStore((s) => s.rooms)
  const settings = useStore((s) => s.settings)

  const [confirmDel, setConfirmDel] = useState(false)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [q, setQ] = useState('')
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [transferFor, setTransferFor] = useState<Item | null>(null)

  const meta = containerMeta(container.type)
  const room = rooms.find((r) => r.id === container.roomId)
  const stats = useMemo(() => containerStats(allItems, container), [allItems, container])
  const valid = isPlacementValid(container)
  const u = unitSuffix(settings.units)
  const step = settings.units === 'cm' ? 5 : settings.units === 'in' ? 1 : 0.05

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return stats.items
    return stats.items.filter((i) =>
      [i.name, i.sku, i.barcode, i.lot, i.category, i.slot].some((f) => f?.toLowerCase().includes(s)),
    )
  }, [stats.items, q])

  const set = <K extends keyof Container>(k: K, v: Container[K]) =>
    updateContainer(container.id, { [k]: v } as Partial<Container>)

  return (
    <>
      {/* header */}
      <div className="flex items-start gap-2.5 border-b hairline p-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--panel-2)' }}>
          <TypeIcon type={container.type} size={38} color={container.color} />
        </div>
        <div className="min-w-0 flex-1">
          <input
            className="w-full truncate border-0 bg-transparent p-0 text-[13.5px] font-semibold outline-none"
            value={container.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <p className="mono truncate text-[11px] muted">{container.code} · {meta.label}</p>
          <div className="mt-1.5 flex flex-wrap gap-0.5">
            <button className="btn btn-ghost btn-sm" onClick={() => rotateContainer(container.id)} title="Rotate 90° (R)"><RotateCw size={12} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => duplicateContainer(container.id)} title="Duplicate (Ctrl+D)"><Copy size={12} /></button>
            <button className="btn btn-ghost btn-sm" title="Centre in room"
              onClick={() => room && moveContainer(container.id, room.width / 2, room.length / 2)}><Crosshair size={12} /></button>
            <button className={cx('btn btn-ghost btn-sm', container.locked && 'btn-active')} onClick={() => set('locked', !container.locked)}
              title={container.locked ? 'Unlock' : 'Lock position'}>
              {container.locked ? <Lock size={12} /> : <LockOpen size={12} />}
            </button>
            <button className="btn btn-ghost btn-sm text-[#e05252]" onClick={() => setConfirmDel(true)} title="Delete"><Trash2 size={12} /></button>
          </div>
        </div>
      </div>

      {!valid && (
        <p className="border-b hairline px-3 py-2 text-[11.5px]" style={{ background: '#fff1f1', color: '#b93b3b' }}>
          Overlapping another object or outside the room.
        </p>
      )}

      {/* tabs */}
      <div className="flex gap-1 border-b hairline px-3 py-2">
        <button className={cx('btn btn-sm flex-1', tab === 'object' && 'btn-active')} onClick={() => setTab('object')}>Properties</button>
        <button className={cx('btn btn-sm flex-1', tab === 'items' && 'btn-active')} onClick={() => setTab('items')} disabled={meta.obstacle}>
          Items {stats.count > 0 && <span className="chip px-1.5 py-0">{stats.count}</span>}
        </button>
      </div>

      {/* --------------------------------------------------------- properties */}
      {tab === 'object' && (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <SelectField
            label="Type"
            value={container.type}
            onChange={(v: ContainerType) => {
              const m = containerMeta(v)
              updateContainer(container.id, {
                type: v, color: m.color, levels: m.levels ?? 1, capacity: m.capacity ?? 10,
                w: m.size[0], d: m.size[1], h: m.size[2], tempC: m.tempC,
              })
            }}
            options={CONTAINER_TYPES.map((t) => ({ value: t.type, label: t.label }))}
          />

          <div>
            <p className="section-label mb-2">Dimensions</p>
            <div className="grid grid-cols-3 gap-2">
              <Num label="Width" suffix={u} step={step} value={fromCm(container.w, settings.units)}
                onChange={(v) => set('w', Math.max(1, toCm(v, settings.units)))} />
              <Num label="Length" suffix={u} step={step} value={fromCm(container.d, settings.units)}
                onChange={(v) => set('d', Math.max(1, toCm(v, settings.units)))} />
              <Num label="Height" suffix={u} step={step} value={fromCm(container.h, settings.units)}
                onChange={(v) => set('h', Math.max(1, toCm(v, settings.units)))} />
            </div>
            <p className="mt-1.5 text-[11px] muted">
              {fmtNum((container.w * container.d) / 10000, 2)} m² footprint · {fmtNum(volM3(container.w, container.d, container.h), 2)} m³
            </p>
          </div>

          <div>
            <p className="section-label mb-2">Position</p>
            <div className="grid grid-cols-3 gap-2">
              <Num label="Shift X" suffix={u} step={step} value={fromCm(container.x, settings.units)}
                onChange={(v) => moveContainer(container.id, toCm(v, settings.units), container.z)} />
              <Num label="Shift Z" suffix={u} step={step} value={fromCm(container.z, settings.units)}
                onChange={(v) => moveContainer(container.id, container.x, toCm(v, settings.units))} />
              <Num label="Over floor" suffix={u} step={step} min={0} value={fromCm(container.y, settings.units)}
                onChange={(v) => set('y', Math.max(0, toCm(v, settings.units)))} />
            </div>
            <div className="mt-2">
              <label className="label">Rotate Y</label>
              <div className="flex gap-1">
                {([0, 90, 180, 270] as const).map((r) => (
                  <button
                    key={r}
                    className={cx('btn btn-sm flex-1', container.rotation === r && 'btn-active')}
                    // Bounded: rotateContainer can refuse when there is no room,
                    // so never spin waiting for a rotation that cannot happen.
                    onClick={() => {
                      for (let i = 0; i < 4; i++) {
                        const cur = useStore.getState().containers.find((c) => c.id === container.id)
                        if (!cur || cur.rotation === r) break
                        rotateContainer(container.id)
                      }
                    }}
                  >
                    {r}°
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Capacity</p>
            <div className="grid grid-cols-2 gap-2">
              <Num label="Levels" value={container.levels} min={1} onChange={(v) => set('levels', Math.max(1, Math.round(v)))} />
              <Num label="Slot capacity" value={container.capacity} min={0} onChange={(v) => set('capacity', Math.max(0, Math.round(v)))} />
              <Num label="Max weight" suffix="kg" min={0} step={10} value={container.maxWeightKg ?? 0} onChange={(v) => set('maxWeightKg', v)} />
              <Num label="Target temp" suffix="°C" step={0.5} value={container.tempC ?? 20} onChange={(v) => set('tempC', v)} />
            </div>
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="muted">Occupancy</span>
                <span className="tabular-nums">{stats.usedSlots} / {container.capacity} · {Math.round(stats.fill * 100)}%</span>
              </div>
              <Bar ratio={stats.fill} />
              {container.maxWeightKg ? (
                <>
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="muted">Load</span>
                    <span className={cx('tabular-nums', stats.overweight && 'text-[#e05252]')}>
                      {fmtNum(stats.weight, 1)} / {fmtNum(container.maxWeightKg, 0)} kg
                    </span>
                  </div>
                  <Bar ratio={stats.weight / container.maxWeightKg} />
                </>
              ) : null}
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Colour</p>
            <div className="flex flex-wrap gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  className="h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: container.color === c ? 'var(--accent)' : 'var(--line)' }}
                  onClick={() => set('color', c)}
                />
              ))}
              <input
                type="color"
                className="h-7 w-9 cursor-pointer rounded-lg border hairline bg-transparent"
                value={container.color}
                onChange={(e) => set('color', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <TextField label="Code" mono value={container.code} onChange={(v) => set('code', v)} />
            <TextField label="Zone" value={container.zone ?? ''} onChange={(v) => set('zone', v)} />
          </div>

          <Toggle label="Lock position" hint="Prevents dragging and auto-arrange" checked={container.locked} onChange={(b) => set('locked', b)} />

          <Field label="Notes">
            <textarea className="textarea" value={container.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      )}

      {/* -------------------------------------------------------------- items
          Gated on the object being storable, not just on the tab. Only the tab
          *button* was disabled, so selecting a shelf, switching to Items and
          then clicking a pillar left a working "add item" panel open on a
          structural column — and the item saved. */}
      {tab === 'items' && !meta.obstacle && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-2 border-b hairline p-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-[15px] font-semibold tabular-nums">{stats.count}</p><p className="text-[10px] muted">lines</p></div>
              <div><p className="text-[15px] font-semibold tabular-nums">{fmtNum(stats.qty)}</p><p className="text-[10px] muted">units</p></div>
              <div><p className="text-[15px] font-semibold tabular-nums">{fmtNum(stats.weight, 1)}</p><p className="text-[10px] muted">kg</p></div>
              <div><p className="text-[15px] font-semibold tabular-nums">{fmtMoney(stats.value, settings.currency)}</p><p className="text-[10px] muted">value</p></div>
            </div>
            <Bar ratio={stats.fill} />
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 muted" />
                <input className="input pl-7" placeholder="Filter items…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={() => { setEditItem(null); setItemFormOpen(true) }}><PackagePlus size={13} /></button>
              <button className="btn" title="Print labels" onClick={() => setLabelsOpen(true)} disabled={!stats.count}><Printer size={13} /></button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <Empty
                title={stats.count ? 'No matching items' : 'This container is empty'}
                hint={stats.count ? 'Try a different search term.' : 'Add stock lines to track quantities, barcodes, lots and expiry.'}
                action={!stats.count && <button className="btn btn-primary" onClick={() => { setEditItem(null); setItemFormOpen(true) }}><PackagePlus size={13} /> Add item</button>}
              />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {filtered.map((it) => {
                  const dleft = daysUntil(it.expiryAt)
                  const low = it.minQty !== undefined && it.minQty > 0 && it.qty <= it.minQty
                  return (
                    <li key={it.id} className="px-3 py-2 hover:bg-[var(--panel-2)]">
                      <div className="flex items-start gap-2">
                        <StatusDot status={it.status} />
                        <button className="min-w-0 flex-1 text-left" onClick={() => { setEditItem(it); setItemFormOpen(true) }}>
                          <p className="truncate text-[12.5px] font-medium">{it.name}</p>
                          <p className="mono truncate text-[10.5px] muted">{it.sku}{it.slot ? ` · ${it.slot}` : ''}</p>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button className="btn btn-ghost btn-sm" onClick={() => adjustQty(it.id, -1, 'issue', 'Quick pick')}><Minus size={11} /></button>
                          <span className="w-12 text-center text-[12px] font-semibold tabular-nums">{fmtNum(it.qty)}</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => adjustQty(it.id, 1, 'receive', 'Quick receive')}><Plus size={11} /></button>
                          <button className="btn btn-ghost btn-sm" title="Transfer" onClick={() => setTransferFor(it)}><ArrowLeftRight size={11} /></button>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 pl-4">
                        {it.lot && <span className="chip"><Tag size={9} />{it.lot}</span>}
                        {low && <span className="chip" style={{ background: '#fff5e2', borderColor: '#f0d9a8' }}>low stock</span>}
                        {dleft !== null && dleft <= settings.expiryWarnDays && (
                          <span className="chip" style={{ background: dleft < 0 ? '#ffecec' : '#fff5e2', borderColor: dleft < 0 ? '#f2c2c2' : '#f0d9a8' }}>
                            {dleft < 0 ? `expired ${-dleft}d` : `exp ${dleft}d`}
                          </span>
                        )}
                        {it.tags.map((t) => <span key={t} className="chip">{t}</span>)}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <ItemForm open={itemFormOpen} onClose={() => { setItemFormOpen(false); setEditItem(null) }} item={editItem} containerId={container.id} />
      <LabelSheet open={labelsOpen} onClose={() => setLabelsOpen(false)} items={stats.items} title={`${container.code} — ${container.name}`} />
      <TransferDialog item={transferFor} onClose={() => setTransferFor(null)} onTransfer={transferItem} containers={containers} rooms={rooms} />
      <Confirm
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => removeContainer(container.id)}
        title={`Delete ${container.code}?`}
        message={`This removes the object and its ${stats.count} inventory line(s) permanently.`}
      />
    </>
  )
}

function TransferDialog({
  item, onClose, onTransfer, containers, rooms,
}: {
  item: Item | null
  onClose: () => void
  onTransfer: (id: string, to: string, qty?: number) => void
  containers: Container[]
  rooms: { id: string; code: string; name: string }[]
}) {
  const [target, setTarget] = useState('')
  const [qty, setQty] = useState(0)

  useEffect(() => {
    if (item) { setTarget(''); setQty(item.qty) }
  }, [item])

  if (!item) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="float relative w-full max-w-sm p-4">
        <h3 className="text-[13.5px] font-semibold">Transfer stock</h3>
        <p className="mb-3 text-[11.5px] muted">{item.name} · {item.sku}</p>
        <div className="space-y-2">
          <Num label="Quantity" value={qty} min={0} max={item.qty} onChange={setQty} suffix={item.uom} />
          <Field label="Destination container">
            <Select
              value={target}
              onChange={setTarget}
              ariaLabel="Destination container"
              options={rooms.flatMap((r) =>
                containers
                  .filter((c) => c.roomId === r.id && c.id !== item.containerId && c.capacity > 0)
                  .map((c) => ({ value: c.id, label: `${c.code} · ${c.name}`, group: `${r.code} — ${r.name}` })),
              )}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!target || qty <= 0} onClick={() => { onTransfer(item.id, target, qty); onClose() }}>
            Transfer
          </button>
        </div>
      </div>
    </div>
  )
}
