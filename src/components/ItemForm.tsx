import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import type { Item, ItemStatus, Uom } from '../types'
import { ITEM_STATUSES, UOMS } from '../types'
import { useStore } from '../store'
import { Modal, NumberField, Select, SelectField, TextField, Field } from './ui'
import { Barcode } from './Barcode'
import { generateBarcode, todayISO } from '../lib/utils'

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
    const tags = tagText.split(',').map((t) => t.trim()).filter(Boolean)
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
      title={item ? `Edit ${item.sku}` : 'New inventory line'}
      subtitle={item ? item.name : 'Add stock to a container'}
      width="max-w-3xl"
      footer={
        <>
          {item && (
            <button
              className="btn btn-danger mr-auto"
              onClick={() => { removeItem(item.id); onClose() }}
            >
              <Trash2 size={13} /> Delete line
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!draft.name || !(draft.containerId || containerId)}>
            {item ? 'Save changes' : 'Add item'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <TextField className="md:col-span-2" label="Item name" value={draft.name ?? ''} onChange={(v) => set('name', v)} placeholder="e.g. Bearing 6204-2RS" />
        <SelectField
          label="Category"
          value={draft.category ?? 'General'}
          onChange={(v) => set('category', v)}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />

        <TextField label="SKU / Part no." mono value={draft.sku ?? ''} onChange={(v) => set('sku', v)} placeholder="AUTO" />
        <Field label="Barcode">
          <div className="flex gap-1.5">
            <input className="input mono" value={draft.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} />
            <button className="btn" title="Generate new barcode" onClick={() => set('barcode', generateBarcode())}>
              <RefreshCw size={13} />
            </button>
          </div>
        </Field>
        <Field label="Preview">
          <div className="flex h-[34px] items-center justify-center overflow-hidden rounded-lg border hairline bg-white px-1">
            {draft.barcode ? (
              <Barcode value={draft.barcode} height={22} width={1} displayValue={false} />
            ) : (
              <span className="text-[11px] text-slate-400">no barcode</span>
            )}
          </div>
        </Field>

        <NumberField label="Quantity" value={draft.qty ?? 0} onChange={(v) => set('qty', v)} min={0} step={1} />
        <SelectField label="Unit of measure" value={(draft.uom ?? 'pcs') as Uom} onChange={(v) => set('uom', v)} options={UOMS.map((u) => ({ value: u, label: u }))} />
        <NumberField label="Slots used" value={draft.slots ?? 1} onChange={(v) => set('slots', Math.max(1, Math.round(v)))} min={1} hint="How much container capacity this line consumes" />

        <NumberField label="Unit weight" value={draft.unitWeightKg ?? 0} onChange={(v) => set('unitWeightKg', v)} min={0} step={0.01} suffix="kg" hint={`Line weight ${totalWeight.toFixed(2)} kg`} />
        <NumberField label="Unit cost" value={draft.unitCost ?? 0} onChange={(v) => set('unitCost', v)} min={0} step={0.01} suffix={currency} hint={`Line value ${totalValue.toFixed(2)} ${currency}`} />
        <NumberField label="Reorder point" value={draft.minQty ?? 0} onChange={(v) => set('minQty', v)} min={0} hint="Low-stock alert threshold" />

        <SelectField
          label="Status"
          value={(draft.status ?? 'in_stock') as ItemStatus}
          onChange={(v) => set('status', v)}
          options={ITEM_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
        <TextField label="Lot / Batch" value={draft.lot ?? ''} onChange={(v) => set('lot', v)} mono />
        <TextField label="Serial no." value={draft.serial ?? ''} onChange={(v) => set('serial', v)} mono />

        <Field label="Received date">
          <input type="date" className="input" value={draft.receivedAt ?? ''} onChange={(e) => set('receivedAt', e.target.value)} />
        </Field>
        <Field label="Expiry date" >
          <input type="date" className="input" value={draft.expiryAt ?? ''} onChange={(e) => set('expiryAt', e.target.value)} />
        </Field>
        <TextField label="Supplier" value={draft.supplier ?? ''} onChange={(v) => set('supplier', v)} />

        <Field label="Location" className="md:col-span-2">
          <Select
            value={draft.containerId ?? containerId ?? ''}
            onChange={(v) => set('containerId', v)}
            placeholder="Select container…"
            ariaLabel="Location"
            options={containerOptions.flatMap(({ room, list }) =>
              list.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}`, group: `${room.code} — ${room.name}` })),
            )}
          />
        </Field>
        <TextField label="Sub-location / bin" value={draft.slot ?? ''} onChange={(v) => set('slot', v)} placeholder="L2-B3" mono />

        <TextField className="md:col-span-2" label="Tags (comma separated)" value={tagText} onChange={setTagText} placeholder="fast-mover, fragile" />
        <Field label="Notes" className="md:col-span-3">
          <textarea className="textarea" value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
