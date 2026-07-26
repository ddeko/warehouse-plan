import { useMemo, useState } from 'react'
import { Download, Plus, Search, Trash2, X } from 'lucide-react'
import type { MovementType } from '../types'
import { MOVEMENT_TYPES, UOMS } from '../types'
import { useStore } from '../store'
import { Confirm, Empty, Field, Modal, NumberField, Select, SelectField, TextField } from '../components/ui'
import { toCSV } from '../lib/csv'
import { cx, download, fmtDateTime, fmtNum } from '../lib/utils'
import { describeLocation } from '../lib/movements'

export function MovementsView() {
  const movements = useStore((s) => s.movements)
  const containers = useStore((s) => s.containers)
  const rooms = useStore((s) => s.rooms)
  const items = useStore((s) => s.items)
  const clearMovements = useStore((s) => s.clearMovements)

  const [q, setQ] = useState('')
  const [type, setType] = useState<'' | MovementType>('')
  const [days, setDays] = useState(30)
  const [confirmClear, setConfirmClear] = useState(false)
  const [postOpen, setPostOpen] = useState(false)

  const cmap = useMemo(() => new Map(containers.map((c) => [c.id, c])), [containers])
  const rmap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])
  const codeOf = (id?: string) => (id ? cmap.get(id)?.code ?? '—' : '—')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const cutoff = days > 0 ? Date.now() - days * 86_400_000 : 0
    return movements.filter((m) => {
      if (m.ts < cutoff) return false
      if (type && m.type !== type) return false
      if (s && ![m.name, m.sku, m.reference, m.user, m.note, codeOf(m.fromContainerId), codeOf(m.toContainerId)]
        .some((f) => f?.toLowerCase().includes(s))) return false
      return true
    })
  }, [movements, q, type, days, cmap])

  const summary = useMemo(() => {
    const acc: Record<string, { count: number; qty: number }> = {}
    for (const m of filtered) {
      const a = acc[m.type] ?? { count: 0, qty: 0 }
      a.count += 1
      a.qty += m.qty
      acc[m.type] = a
    }
    return acc
  }, [filtered])

  const exportCsv = () => {
    const rows = filtered.map((m) => ({
      timestamp: new Date(m.ts).toISOString(),
      type: m.type, sku: m.sku ?? '', name: m.name, qty: m.qty, uom: m.uom ?? '',
      from: codeOf(m.fromContainerId), to: codeOf(m.toContainerId),
      location: describeLocation(m, cmap, rmap),
      room: m.roomId ? rmap.get(m.roomId)?.code ?? '' : '',
      reference: m.reference ?? '', user: m.user, note: m.note ?? '',
    }))
    download(`movements-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), 'text/csv')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b hairline px-3 py-3 sm:px-5" style={{ background: 'var(--panel)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h1 className="text-[15px] font-semibold">Movements &amp; audit trail</h1>
            <p className="text-[11.5px] muted">{fmtNum(filtered.length)} entries · every receipt, pick, transfer, count and relocation</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 muted" />
              <input className="input w-full pl-7 sm:w-56" placeholder="Search reference, SKU, user…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select
              className="w-[130px]"
              value={type}
              onChange={(v) => setType(v as MovementType | '')}
              options={[{ value: '', label: 'All types' }, ...MOVEMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
              ariaLabel="Filter by movement type"
            />
            <Select
              className="w-[130px]"
              value={String(days)}
              onChange={(v) => setDays(Number(v))}
              options={[7, 30, 90, 365, 0].map((d) => ({ value: String(d), label: d === 0 ? 'All time' : `Last ${d} days` }))}
              ariaLabel="Filter by date range"
            />
            <button className="btn btn-primary" onClick={() => setPostOpen(true)} disabled={!containers.length}><Plus size={13} /> Post movement</button>
            <button className="btn" onClick={exportCsv} disabled={!filtered.length}><Download size={13} /> CSV</button>
            <button className="btn btn-danger" onClick={() => setConfirmClear(true)} disabled={!movements.length}><Trash2 size={13} /></button>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {MOVEMENT_TYPES.map((t) => {
            const s = summary[t.value]
            if (!s) return null
            return (
              <button key={t.value} className={cx('chip', type === t.value && 'btn-active')} onClick={() => setType(type === t.value ? '' : t.value)}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
                {t.label} · {s.count}
              </button>
            )
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <Empty title="No movements in this window" hint="Change the date range or post a movement manually." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th><th>Type</th><th>Reference</th><th>Item</th>
                <th className="num">Qty</th><th>Location</th><th>User</th><th>Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const t = MOVEMENT_TYPES.find((x) => x.value === m.type)
                return (
                  <tr key={m.id}>
                    <td className="mono whitespace-nowrap muted">{fmtDateTime(m.ts)}</td>
                    <td><span className="chip" style={{ color: t?.color, borderColor: `${t?.color}55` }}>{t?.label ?? m.type}</span></td>
                    <td className="mono muted">{m.reference ?? '—'}</td>
                    <td>
                      <span className="block max-w-[260px] truncate">{m.name}</span>
                      {m.sku && <span className="mono block text-[10px] muted">{m.sku}</span>}
                    </td>
                    <td className={cx('num tabular-nums', m.qty < 0 ? 'text-[#e05252]' : m.qty > 0 ? 'text-[#3fae8f]' : 'muted')}>
                      {m.qty === 0 ? '—' : <>{m.qty > 0 ? '+' : ''}{fmtNum(m.qty)} <span className="text-[10px] muted">{m.uom ?? ''}</span></>}
                    </td>
                    <td className="mono muted">{describeLocation(m, cmap, rmap)}</td>
                    <td className="muted">{m.user}</td>
                    <td className="max-w-[280px] truncate muted">{m.note ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <PostMovement open={postOpen} onClose={() => setPostOpen(false)} />

      <Confirm
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearMovements}
        title="Clear movement history?"
        message="This deletes the audit trail. Stock levels and objects are not affected."
        confirmLabel="Clear history"
      />
    </div>
  )
}

/** Manual posting: receive / issue / transfer / adjust against an existing line. */
function PostMovement({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useStore((s) => s.items)
  const containers = useStore((s) => s.containers)
  const rooms = useStore((s) => s.rooms)
  const adjustQty = useStore((s) => s.adjustQty)
  const transferItem = useStore((s) => s.transferItem)
  const logMovement = useStore((s) => s.logMovement)
  const notify = useStore((s) => s.notify)

  const [type, setType] = useState<MovementType>('receive')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState(1)
  const [target, setTarget] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')

  const item = items.find((i) => i.id === itemId)

  const post = () => {
    if (!item) return
    if (type === 'transfer') {
      if (!target) return
      transferItem(item.id, target, qty)
    } else if (type === 'receive') {
      adjustQty(item.id, Math.abs(qty), 'receive', note || reference || 'Manual receipt')
    } else if (type === 'issue' || type === 'dispose') {
      adjustQty(item.id, -Math.abs(qty), type, note || reference || 'Manual issue')
    } else if (type === 'adjust') {
      adjustQty(item.id, qty, 'adjust', note || reference || 'Manual adjustment')
    } else {
      logMovement({
        type, itemId: item.id, sku: item.sku, name: item.name, qty, uom: item.uom,
        toContainerId: item.containerId, reference, note: note || 'Cycle count',
      })
    }
    notify('Movement posted')
    onClose()
    setQty(1); setNote(''); setReference('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Post movement"
      subtitle="Record a receipt, pick, transfer, adjustment or count"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={post} disabled={!item || (type === 'transfer' && !target)}>Post</button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Movement type"
          value={type}
          onChange={(v: MovementType) => setType(v)}
          options={MOVEMENT_TYPES.filter((t) => t.value !== 'relocate').map((t) => ({ value: t.value, label: t.label }))}
        />
        <Field label="Item">
          <Select
            value={itemId}
            onChange={setItemId}
            placeholder="Select stock line…"
            ariaLabel="Item"
            options={items.map((i) => {
              const c = containers.find((k) => k.id === i.containerId)
              return { value: i.id, label: `${i.sku} — ${i.name} (${c?.code})`, hint: `${i.qty} ${i.uom}` }
            })}
          />
        </Field>
        <NumberField
          label="Quantity"
          value={qty}
          onChange={setQty}
          suffix={item?.uom}
          hint={type === 'adjust' ? 'Signed value: negative reduces stock' : undefined}
        />
        {type === 'transfer' ? (
          <Field label="Destination">
            <Select
              value={target}
              onChange={setTarget}
              placeholder="Select container…"
              ariaLabel="Destination container"
              options={rooms.flatMap((r) =>
                containers
                  .filter((c) => c.roomId === r.id && c.capacity > 0 && c.id !== item?.containerId)
                  .map((c) => ({ value: c.id, label: `${c.code} · ${c.name}`, group: `${r.code} — ${r.name}` })),
              )}
            />
          </Field>
        ) : (
          <TextField label="Reference" value={reference} onChange={setReference} placeholder="GRN-10234" mono />
        )}
        <TextField className="sm:col-span-2" label="Note" value={note} onChange={setNote} />
        {item && (
          <p className="sm:col-span-2 rounded-lg border hairline p-2 text-[11px] muted panel-2">
            Current stock: <span className="font-semibold text-[var(--text)]">{fmtNum(item.qty)} {item.uom}</span>
            {' '}in {containers.find((c) => c.id === item.containerId)?.code}
            {type !== 'transfer' && type !== 'count' && (
              <> → after posting: <span className="font-semibold text-[var(--text)]">
                {fmtNum(Math.max(0, item.qty + (type === 'receive' ? Math.abs(qty) : type === 'adjust' ? qty : -Math.abs(qty))))} {item.uom}
              </span></>
            )}
          </p>
        )}
      </div>
    </Modal>
  )
}
