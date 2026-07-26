import { useState } from 'react'
import { Printer, X } from 'lucide-react'
import type { Item } from '../types'
import { Barcode } from './Barcode'
import { Select } from './ui'
import { useStore } from '../store'
import { fmtDate, fmtNum } from '../lib/utils'

/**
 * Print-ready label sheet. Uses the browser print dialog so it works with any
 * label printer or PDF driver without extra dependencies.
 */
export function LabelSheet({
  open, onClose, items, title,
}: {
  open: boolean
  onClose: () => void
  items: Item[]
  title: string
}) {
  const containers = useStore((s) => s.containers)
  const rooms = useStore((s) => s.rooms)
  const [perRow, setPerRow] = useState(3)
  const [showQr, setShowQr] = useState(true)

  if (!open) return null

  const locate = (containerId: string) => {
    const c = containers.find((k) => k.id === containerId)
    const r = rooms.find((k) => k.id === c?.roomId)
    return `${r?.code ?? '—'} / ${c?.code ?? '—'}`
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-auto print-sheet" style={{ background: '#ffffff', color: '#0f172a' }}>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Label sheet — {title}</p>
          <p className="text-[11px] text-slate-500">{items.length} labels</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[12px] text-slate-600">
            Columns
            <Select
              className="w-[64px]"
              value={String(perRow)}
              onChange={(v) => setPerRow(Number(v))}
              options={[2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
              ariaLabel="Columns per row"
            />
          </label>
          <label className="flex items-center gap-1 text-[12px] text-slate-600">
            <input type="checkbox" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} />
            Details
          </label>
          <button className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white" onClick={() => window.print()}>
            <Printer size={13} /> Print
          </button>
          <button className="rounded-lg border border-slate-300 p-1.5 text-slate-600" onClick={onClose}><X size={14} /></button>
        </div>
      </div>

      <div className="grid gap-3 p-4" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
        {items.map((it) => (
          <div key={it.id} className="break-inside-avoid rounded-lg border border-slate-300 p-2.5">
            <p className="truncate text-[13px] font-bold text-slate-900">{it.name}</p>
            <p className="font-mono text-[10px] text-slate-500">{it.sku} · {locate(it.containerId)}</p>
            <div className="my-1 flex justify-center">
              <Barcode value={it.barcode} height={38} width={1.3} color="#0f172a" />
            </div>
            {showQr && (
              <table className="w-full text-[10px] text-slate-700">
                <tbody>
                  <tr><td className="text-slate-400">Qty</td><td className="text-right font-semibold">{fmtNum(it.qty)} {it.uom}</td></tr>
                  {it.lot && <tr><td className="text-slate-400">Lot</td><td className="text-right font-mono">{it.lot}</td></tr>}
                  {it.slot && <tr><td className="text-slate-400">Bin</td><td className="text-right font-mono">{it.slot}</td></tr>}
                  {it.receivedAt && <tr><td className="text-slate-400">In</td><td className="text-right">{fmtDate(it.receivedAt)}</td></tr>}
                  {it.expiryAt && <tr><td className="text-slate-400">Exp</td><td className="text-right font-semibold">{fmtDate(it.expiryAt)}</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
