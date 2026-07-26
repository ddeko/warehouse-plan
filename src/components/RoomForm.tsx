import { useEffect, useState } from 'react'
import type { Room } from '../types'
import { useStore } from '../store'
import { Field, Modal, NumberField, TextField } from './ui'
import { areaM2, cx, fmtNum, fromCm, toCm, unitSuffix, volM3 } from '../lib/utils'

const FLOOR_SWATCHES = ['#f6f7fb', '#eef6fa', '#faf6f1', '#f3f1fa', '#eef8f1', '#fdf6ee', '#f1f4f8']
const WALL_SWATCHES = ['#eef1f8', '#e6f0f6', '#f3ede6', '#ece9f6', '#e7f3ec', '#f8f0e6']

const PRESETS: { label: string; w: number; l: number; h: number; grid: number }[] = [
  { label: 'Small store 4×3 m', w: 400, l: 300, h: 260, grid: 10 },
  { label: 'Stock room 8×6 m', w: 800, l: 600, h: 300, grid: 10 },
  { label: 'Warehouse 24×16 m', w: 2400, l: 1600, h: 600, grid: 20 },
  { label: 'Container 40 ft', w: 1203, l: 235, h: 239, grid: 5 },
  { label: 'Cold store 9×7 m', w: 900, l: 700, h: 320, grid: 10 },
]

export function RoomForm({ open, onClose, room }: { open: boolean; onClose: () => void; room?: Room | null }) {
  const addRoom = useStore((s) => s.addRoom)
  const updateRoom = useStore((s) => s.updateRoom)
  const units = useStore((s) => s.settings.units)
  const rooms = useStore((s) => s.rooms)
  const sites = useStore((s) => s.sites)
  const activeSiteId = useStore((s) => s.activeSiteId)

  const [d, setD] = useState<Partial<Room>>({})

  useEffect(() => {
    if (!open) return
    setD(
      room
        ? { ...room }
        : {
            code: '', name: `Room ${rooms.length + 1}`, width: 800, length: 600, height: 300, grid: 10,
            siteId: activeSiteId ?? sites[0]?.id,
            floorColor: '#f6f7fb', wallColor: '#eef1f8', zone: 'A', tempC: 20, humidity: 50,
          },
    )
  }, [open, room, rooms.length])

  const set = <K extends keyof Room>(k: K, v: Room[K]) => setD((x) => ({ ...x, [k]: v }))
  const u = unitSuffix(units)
  const step = units === 'm' ? 0.1 : units === 'in' ? 1 : 10

  const save = () => {
    const payload = {
      ...d,
      width: Math.max(50, d.width ?? 800),
      length: Math.max(50, d.length ?? 600),
      height: Math.max(50, d.height ?? 300),
      grid: Math.max(1, d.grid ?? 10),
    }
    if (room) updateRoom(room.id, payload)
    else addRoom(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={room ? `Edit ${room.code}` : 'New room'}
      subtitle={room ? room.name : 'Define the floor area that objects are placed in'}
      width="max-w-2xl"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{room ? 'Save room' : 'Create room'}</button>
        </>
      }
    >
      {!room && (
        <div className="mb-4">
          <p className="label">Start from a preset</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="btn btn-sm"
                onClick={() => setD((x) => ({ ...x, width: p.w, length: p.l, height: p.h, grid: p.grid }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Site / location" className="md:col-span-2">
          <select className="select" value={d.siteId ?? ''} onChange={(e) => set('siteId', e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </Field>
        <TextField label="Code" mono value={d.code ?? ''} onChange={(v) => set('code', v)} placeholder="AUTO" hint="Unique within the site" />

        <TextField label="Room name" value={d.name ?? ''} onChange={(v) => set('name', v)} className="md:col-span-3" />

        <NumberField
          label={`Width (X)`}
          suffix={u}
          step={step}
          min={0.5}
          value={fromCm(d.width ?? 0, units)}
          onChange={(v) => set('width', toCm(v, units))}
        />
        <NumberField
          label={`Length (Z)`}
          suffix={u}
          step={step}
          min={0.5}
          value={fromCm(d.length ?? 0, units)}
          onChange={(v) => set('length', toCm(v, units))}
        />
        <NumberField
          label={`Height (Y)`}
          suffix={u}
          step={step}
          min={0.5}
          value={fromCm(d.height ?? 0, units)}
          onChange={(v) => set('height', toCm(v, units))}
        />

        <NumberField
          label="Snap grid"
          suffix={u}
          step={units === 'cm' ? 5 : 0.05}
          min={0.01}
          value={fromCm(d.grid ?? 10, units)}
          onChange={(v) => set('grid', Math.max(1, toCm(v, units)))}
          hint="Objects snap to this spacing"
        />
        <TextField label="Zone" value={d.zone ?? ''} onChange={(v) => set('zone', v)} placeholder="A" />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Temp" suffix="°C" step={0.5} value={d.tempC ?? 20} onChange={(v) => set('tempC', v)} />
          <NumberField label="RH" suffix="%" step={1} min={0} max={100} value={d.humidity ?? 50} onChange={(v) => set('humidity', v)} />
        </div>

        <Field label="Floor colour" className="md:col-span-1">
          <div className="flex flex-wrap gap-1.5">
            {FLOOR_SWATCHES.map((c) => (
              <button
                key={c}
                className="h-6 w-6 rounded-md border-2"
                style={{ background: c, borderColor: d.floorColor === c ? 'var(--accent)' : 'transparent' }}
                onClick={() => set('floorColor', c)}
              />
            ))}
          </div>
        </Field>
        <Field label="Wall colour" className="md:col-span-1">
          <div className="flex flex-wrap gap-1.5">
            {WALL_SWATCHES.map((c) => (
              <button
                key={c}
                className="h-6 w-6 rounded-md border-2"
                style={{ background: c, borderColor: d.wallColor === c ? 'var(--accent)' : 'transparent' }}
                onClick={() => set('wallColor', c)}
              />
            ))}
          </div>
        </Field>
        <div className="flex items-end">
          <div className="w-full rounded-lg border hairline p-2 text-[11px] muted panel-2">
            <p>Floor area <span className="font-semibold text-[var(--text)]">{fmtNum(areaM2(d.width ?? 0, d.length ?? 0), 2)} m²</span></p>
            <p>Volume <span className="font-semibold text-[var(--text)]">{fmtNum(volM3(d.width ?? 0, d.length ?? 0, d.height ?? 0), 2)} m³</span></p>
          </div>
        </div>

        <Field label="Notes" className="md:col-span-3">
          <textarea className="textarea" value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
