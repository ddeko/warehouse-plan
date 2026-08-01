import { useMemo, useState } from 'react'
import { Download, Plus, Search, Trash2, X } from 'lucide-react'
import type { MovementType } from '../types'
import { MOVEMENT_TYPES, UOMS } from '../types'
import { useStore } from '../store'
import { Confirm, Empty, Field, Modal, NumberField, Select, SelectField, TextField } from '../components/ui'
import { toCSV } from '../lib/csv'
import { cx, download, fmtDateTime, fmtNum } from '../lib/utils'
import { describeLocation } from '../lib/movements'
import { t as tr, trf } from '../lib/i18n'

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

  /** Everything the date range and search allow, before the type chips apply. */
  const inScope = useMemo(() => {
    const s = q.trim().toLowerCase()
    const cutoff = days > 0 ? Date.now() - days * 86_400_000 : 0
    return movements.filter((m) => {
      if (m.ts < cutoff) return false
      if (s && ![m.name, m.sku, m.reference, m.user, m.note, codeOf(m.fromContainerId), codeOf(m.toContainerId)]
        .some((f) => f?.toLowerCase().includes(s))) return false
      return true
    })
  }, [movements, q, days, cmap])

  const filtered = useMemo(
    () => (type ? inScope.filter((m) => m.type === type) : inScope),
    [inScope, type],
  )

  /*
   * Counted over `inScope`, not `filtered`.
   *
   * Deriving the chips from the already-type-filtered list meant clicking
   * "Receive" unmounted every other chip, so there was no way to switch
   * straight to "Issue" — you had to clear the filter first. The chips are the
   * type picker; they have to keep showing the types you could pick.
   */
  const summary = useMemo(() => {
    const acc: Record<string, { count: number; qty: number }> = {}
    for (const m of inScope) {
      const a = acc[m.type] ?? { count: 0, qty: 0 }
      a.count += 1
      a.qty += m.qty
      acc[m.type] = a
    }
    return acc
  }, [inScope])

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
            <h1 className="text-[15px] font-semibold">{tr("Movements & audit trail")}</h1>
            <p className="text-[11.5px] muted">{trf('{n} entries \u00b7 every receipt, pick, transfer, count and relocation', { n: fmtNum(filtered.length) })}</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 muted" />
              <input className="input w-full pl-7 sm:w-56" placeholder={tr("Search reference, SKU, user…")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select
              className="w-[130px]"
              value={type}
              onChange={(v) => setType(v as MovementType | '')}
              options={[{ value: '', label: tr('All types') }, ...MOVEMENT_TYPES.map((mt) => ({ value: mt.value, label: tr(mt.label) }))]}
              ariaLabel={tr("Filter by movement type")}
            />
            <Select
              className="w-[130px]"
              value={String(days)}
              onChange={(v) => setDays(Number(v))}
              options={[7, 30, 90, 365, 0].map((d) => ({ value: String(d), label: d === 0 ? tr('All time') : trf('Last {d} days', { d }) }))}
              ariaLabel={tr("Filter by date range")}
            />
            <button className="btn btn-primary" onClick={() => setPostOpen(true)} disabled={!containers.length}><Plus size={13} />{tr("Post movement")}</button>
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
                {tr(t.label)} · {s.count}
              </button>
            )
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <Empty title={tr("No movements in this window")} hint={tr("Change the date range or post a movement manually.")} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{tr("Timestamp")}</th><th>{tr("Type")}</th><th>{tr("Reference")}</th><th>{tr("Item")}</th>
                <th className="num">{tr("Qty")}</th><th>{tr("Location")}</th><th>{tr("User")}</th><th>{tr("Note")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const t = MOVEMENT_TYPES.find((x) => x.value === m.type)
                return (
                  <tr key={m.id}>
                    <td className="mono whitespace-nowrap muted">{fmtDateTime(m.ts)}</td>
                    <td><span className="chip" style={{ color: t?.color, borderColor: `${t?.color}55` }}>{t ? tr(t.label) : m.type}</span></td>
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
        title={tr("Clear movement history?")}
        message={tr("This deletes the audit trail. Stock levels and objects are not affected.")}
        confirmLabel={tr("Clear history")}
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
    /*
     * A zero quantity is rejected by every store action it could reach, but
     * the dialog still congratulated the user and closed — or, for a count,
     * wrote a row that renders as "—". Refuse it here where it can be
     * explained instead of silently swallowed downstream.
     */
    if (type !== 'adjust' && qty === 0) {
      notify('Enter a quantity above zero', 'warn')
      return
    }
    if (type === 'transfer') {
      if (!target) return
      transferItem(item.id, target, qty)
    } else if (type === 'receive') {
      adjustQty(item.id, Math.abs(qty), 'receive', note || reference || 'Manual receipt')
    } else if (type === 'issue' || type === 'dispose') {
      adjustQty(item.id, -Math.abs(qty), type, note || reference || 'Manual issue')
    } else if (type === 'adjust') {
      if (qty === 0) { notify('An adjustment of zero changes nothing', 'warn'); return }
      adjustQty(item.id, qty, 'adjust', note || reference || 'Manual adjustment')
    } else {
      logMovement({
        type, itemId: item.id, sku: item.sku, name: item.name, qty, uom: item.uom,
        toContainerId: item.containerId, reference, note: note || 'Cycle count',
      })
    }
    notify('Movement posted')
    onClose()
    // The dialog never unmounts, so every field has to be cleared by hand or
    // the next open comes up pre-filled with the last posting.
    setQty(1); setNote(''); setReference(''); setItemId(''); setTarget('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr("Post movement")}
      subtitle={tr("Record a receipt, pick, transfer, adjustment or count")}
      footer={
        <>
          <button className="btn" onClick={onClose}>{tr("Cancel")}</button>
          <button className="btn btn-primary" onClick={post} disabled={!item || (type === 'transfer' && !target)}>{tr("Post")}</button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={tr("Movement type")}
          value={type}
          onChange={(v: MovementType) => setType(v)}
          options={MOVEMENT_TYPES.filter((mt) => mt.value !== 'relocate').map((mt) => ({ value: mt.value, label: tr(mt.label) }))}
        />
        <Field label={tr("Item")}>
          <Select
            value={itemId}
            onChange={setItemId}
            placeholder={tr("Select stock line…")}
            ariaLabel={tr("Item")}
            options={items.map((i) => {
              const c = containers.find((k) => k.id === i.containerId)
              return { value: i.id, label: `${i.sku} — ${i.name} (${c?.code})`, hint: `${i.qty} ${i.uom}` }
            })}
          />
        </Field>
        <NumberField
          label={tr("Quantity")}
          value={qty}
          onChange={setQty}
          suffix={item?.uom}
          hint={type === 'adjust' ? 'Signed value: negative reduces stock' : undefined}
        />
        {type === 'transfer' ? (
          <Field label={tr("Destination")}>
            <Select
              value={target}
              onChange={setTarget}
              placeholder={tr("Select container…")}
              ariaLabel={tr("Destination container")}
              options={rooms.flatMap((r) =>
                containers
                  .filter((c) => c.roomId === r.id && c.capacity > 0 && c.id !== item?.containerId)
                  .map((c) => ({ value: c.id, label: `${c.code} · ${c.name}`, group: `${r.code} — ${r.name}` })),
              )}
            />
          </Field>
        ) : (
          <TextField label={tr("Reference")} value={reference} onChange={setReference} placeholder="GRN-10234" mono />
        )}
        <TextField className="sm:col-span-2" label={tr("Note")} value={note} onChange={setNote} />
        {item && (
          <p className="sm:col-span-2 rounded-lg border hairline p-2 text-[11px] muted panel-2">{tr("Current stock:")}<span className="font-semibold text-[var(--text)]">{fmtNum(item.qty)} {item.uom}</span>
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
