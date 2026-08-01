import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import type { Item, ItemStatus, Uom } from '../types'
import { ITEM_STATUSES, UOMS } from '../types'
import { useStore } from '../store'
import { Confirm, Modal, NumberField, Select, SelectField, TextField, Field } from './ui'
import { Barcode } from './Barcode'
import { generateBarcode, todayISO } from '../lib/utils'
import { t as tr, trf } from '../lib/i18n'

interface Props {
  open: boolean
  onClose: () => void
  /** Editing an existing line, or creating one inside this container. */
  item?: Item | null
  containerId?: string
}

const CATEGORIES = [
  'General', 'Hardware', 'Consumables', 'Packaging', 'Spare Parts', 'Electrical',
  'Chemicals', 'Fluids', 'Food', 'Pharma', 'Office', 'PPE', 'Logistics', 'Raw Material', 'Finished Goods',
]

export function ItemForm({ open, onClose, item, containerId }: Props) {
  const rooms = useStore((s) => s.rooms)
  const containers = useStore((s) => s.containers)
  const addItem = useStore((s) => s.addItem)
  const updateItem = useStore((s) => s.updateItem)
  const removeItem = useStore((s) => s.removeItem)
  const transferItem = useStore((s) => s.transferItem)
  const currency = useStore((s) => s.settings.currency)

  const blank = useMemo<Partial<Item>>(
    () => ({
      name: '', sku: '', barcode: generateBarcode(), category: 'General', qty: 1, uom: 'pcs' as Uom,
      slots: 1, status: 'in_stock' as ItemStatus, receivedAt: todayISO(), tags: [],
      containerId: containerId ?? '',
    }),
    [containerId],
  )

  const [draft, setDraft] = useState<Partial<Item>>(blank)
  const [tagText, setTagText] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!open) return
    if (item) {
      setDraft({ ...item })
      setTagText((item.tags ?? []).join(', '))
    } else {
      setDraft({ ...blank })
      setTagText('')
    }
  }, [open, item, blank])

  const set = <K extends keyof Item>(k: K, v: Item[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const containerOptions = useMemo(() => {
    const byRoom = new Map<string, typeof containers>()
    for (const c of containers) {
      const list = byRoom.get(c.roomId) ?? []
      list.push(c)
      byRoom.set(c.roomId, list)
    }
    return rooms.map((r) => ({ room: r, list: (byRoom.get(r.id) ?? []).filter((c) => c.capacity > 0) }))
  }, [rooms, containers])

  const save = () => {
    // Deduped: the tag list is keyed by value when rendered, so "fragile,
    // fragile" produced duplicate React keys.
    const tags = [...new Set(tagText.split(',').map((t) => t.trim()).filter(Boolean))]
    const target = draft.containerId || containerId
    if (!target) return
    if (item) {
      const movedContainer = draft.containerId && draft.containerId !== item.containerId
      updateItem(item.id, { ...draft, tags, containerId: item.containerId } as Partial<Item>)
      if (movedContainer) transferItem(item.id, draft.containerId!)
    } else {
      addItem(target, { ...draft, tags } as Partial<Item>)
    }
    onClose()
  }

  const totalValue = (draft.qty ?? 0) * (draft.unitCost ?? 0)
  const totalWeight = (draft.qty ?? 0) * (draft.unitWeightKg ?? 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? trf('Edit {sku}', { sku: item.sku }) : tr('New inventory line')}
      subtitle={item ? item.name : tr('Add stock to a container')}
      width="max-w-3xl"
      footer={
        <>
          {item && (
            // Confirmed, like every other destructive action in the app. It
            // sits one button away from Cancel and there is no undo.
            <button className="btn btn-danger mr-auto" onClick={() => setConfirmDel(true)}>
              <Trash2 size={13} />{tr("Delete line")}</button>
          )}
          <button className="btn" onClick={onClose}>{tr("Cancel")}</button>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={!draft.name?.trim() || !(draft.containerId || containerId)}
          >
            {item ? tr('Save changes') : tr('Add item')}
          </button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <TextField className="md:col-span-2" label={tr("Item name")} value={draft.name ?? ''} onChange={(v) => set('name', v)} placeholder={tr("e.g. Bearing 6204-2RS")} />
        <SelectField
          label={tr("Category")}
          value={draft.category ?? 'General'}
          onChange={(v) => set('category', v)}
          options={CATEGORIES.map((c) => ({ value: c, label: tr(c) }))}
        />

        <TextField label={tr("SKU / Part no.")} mono value={draft.sku ?? ''} onChange={(v) => set('sku', v)} placeholder="AUTO" />
        <Field label={tr("Barcode")}>
          <div className="flex gap-1.5">
            <input className="input mono" value={draft.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} />
            <button className="btn" title={tr("Generate new barcode")} onClick={() => set('barcode', generateBarcode())}>
              <RefreshCw size={13} />
            </button>
          </div>
        </Field>
        <Field label={tr("Preview")}>
          <div className="flex h-[34px] items-center justify-center overflow-hidden rounded-lg border hairline bg-white px-1">
            {draft.barcode ? (
              <Barcode value={draft.barcode} height={22} width={1} displayValue={false} />
            ) : (
              <span className="text-[11px] text-slate-400">{tr('no barcode')}</span>
            )}
          </div>
        </Field>

        <NumberField label={tr("Quantity")} value={draft.qty ?? 0} onChange={(v) => set('qty', v)} min={0} step={1} />
        <SelectField label={tr("Unit of measure")} value={(draft.uom ?? 'pcs') as Uom} onChange={(v) => set('uom', v)} options={UOMS.map((u) => ({ value: u, label: u }))} />
        <NumberField label={tr("Slots used")} value={draft.slots ?? 1} onChange={(v) => set('slots', Math.max(1, Math.round(v)))} min={1} hint={tr("How much container capacity this line consumes")} />

        <NumberField label={tr("Unit weight")} value={draft.unitWeightKg ?? 0} onChange={(v) => set('unitWeightKg', v)} min={0} step={0.01} suffix="kg" hint={trf('Line weight {n} kg', { n: totalWeight.toFixed(2) })} />
        <NumberField label={tr("Unit cost")} value={draft.unitCost ?? 0} onChange={(v) => set('unitCost', v)} min={0} step={0.01} suffix={currency} hint={trf('Line value {n} {cur}', { n: totalValue.toFixed(2), cur: currency })} />
        <NumberField label={tr("Reorder point")} value={draft.minQty ?? 0} onChange={(v) => set('minQty', v)} min={0} hint={tr("Low-stock alert threshold")} />

        <SelectField
          label={tr("Status")}
          value={(draft.status ?? 'in_stock') as ItemStatus}
          onChange={(v) => set('status', v)}
          options={ITEM_STATUSES.map((s) => ({ value: s.value, label: tr(s.label) }))}
        />
        <TextField label={tr("Lot / Batch")} value={draft.lot ?? ''} onChange={(v) => set('lot', v)} mono />
        <TextField label={tr("Serial no.")} value={draft.serial ?? ''} onChange={(v) => set('serial', v)} mono />

        <Field label={tr("Received date")}>
          <input type="date" className="input" value={draft.receivedAt ?? ''} onChange={(e) => set('receivedAt', e.target.value)} />
        </Field>
        <Field label={tr("Expiry date")} >
          <input type="date" className="input" value={draft.expiryAt ?? ''} onChange={(e) => set('expiryAt', e.target.value)} />
        </Field>
        <TextField label={tr("Supplier")} value={draft.supplier ?? ''} onChange={(v) => set('supplier', v)} />

        <Field label={tr("Location")} className="md:col-span-2">
          <Select
            value={draft.containerId ?? containerId ?? ''}
            onChange={(v) => set('containerId', v)}
            placeholder={tr("Select container…")}
            ariaLabel={tr("Location")}
            options={containerOptions.flatMap(({ room, list }) =>
              list.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}`, group: `${room.code} — ${room.name}` })),
            )}
          />
        </Field>
        <TextField label={tr("Sub-location / bin")} value={draft.slot ?? ''} onChange={(v) => set('slot', v)} placeholder="L2-B3" mono />

        <TextField className="md:col-span-2" label={tr("Tags (comma separated)")} value={tagText} onChange={setTagText} placeholder={tr("fast-mover, fragile")} />
        <Field label={tr("Notes")} className="md:col-span-3">
          <textarea className="textarea" value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      {item && (
        <Confirm
          open={confirmDel}
          onClose={() => setConfirmDel(false)}
          onConfirm={() => { removeItem(item.id); onClose() }}
          title={tr("Delete this stock line?")}
          message={`${item.sku} — ${item.name}. The quantity is written off and recorded in the movement history.`}
          confirmLabel={tr("Delete line")}
        />
      )}
    </Modal>
  )
}
