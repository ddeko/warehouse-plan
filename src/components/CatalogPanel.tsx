import { useMemo, useState } from 'react'
import { LayoutGrid, List, Search, X } from 'lucide-react'
import type { ContainerCategory } from '../types'
import { CONTAINER_CATEGORIES, CONTAINER_TYPES } from '../types'
import { useStore } from '../store'
import { TypeIcon } from './TypeIcon'
import { cx, fmtLen } from '../lib/utils'
import { t as tr } from '../lib/i18n'

/**
 * Floating furniture catalogue: category list on the left, isometric tiles on
 * the right. Clicking a tile drops that object into the active room.
 */
export function CatalogPanel({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const addContainer = useStore((s) => s.addContainer)
  const units = useStore((s) => s.settings.units)
  const [category, setCategory] = useState<ContainerCategory | 'all'>('all')
  const [q, setQ] = useState('')
  const [dense, setDense] = useState(false)

  const counts = useMemo(() => {
    const m = new Map<ContainerCategory, number>()
    for (const t of CONTAINER_TYPES) m.set(t.category, (m.get(t.category) ?? 0) + 1)
    return m
  }, [])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return CONTAINER_TYPES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false
      if (s && !`${t.label} ${t.hint} ${t.type}`.toLowerCase().includes(s)) return false
      return true
    })
  }, [category, q])

  return (
    <div className="float pop-in flex w-[386px] flex-col overflow-hidden" style={{ maxHeight: '100%' }}>
      <header className="flex items-center gap-2 border-b hairline px-3 py-2.5">
        <p className="flex-1 text-[13px] font-semibold">{tr("Furniture")}</p>
        <button className={cx('btn btn-ghost btn-sm', !dense && 'btn-active')} onClick={() => setDense(false)} title={tr("Grid")}><LayoutGrid size={14} /></button>
        <button className={cx('btn btn-ghost btn-sm', dense && 'btn-active')} onClick={() => setDense(true)} title={tr("List")}><List size={14} /></button>
        <button className="btn btn-ghost btn-sm" onClick={onClose} title={tr("Close")}><X size={14} /></button>
      </header>

      <div className="border-b hairline px-3 py-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 muted" />
          <input className="input pl-8" placeholder={tr("Search objects…")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="w-[136px] shrink-0 overflow-y-auto border-r hairline p-2">
          <p className="section-label mb-1.5 px-1.5">{tr("Categories")}</p>
          <button
            className={cx('mb-0.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px]',
              category === 'all' ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]' : 'hover:bg-[var(--panel-2)]')}
            onClick={() => setCategory('all')}
          >{tr("All")}<span className="text-[10.5px] muted">{CONTAINER_TYPES.length}</span>
          </button>
          {CONTAINER_CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={cx('mb-0.5 flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-left text-[12px] leading-tight',
                category === c.key ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]' : 'hover:bg-[var(--panel-2)]')}
              onClick={() => setCategory(c.key)}
            >
              <span className="min-w-0 flex-1">{tr(c.label)}</span>
              <span className="text-[10.5px] muted">{counts.get(c.key)}</span>
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {list.length === 0 && <p className="p-6 text-center text-[12px] muted">No objects match “{q}”.</p>}

          {dense ? (
            <ul className="space-y-0.5">
              {list.map((t) => (
                <li key={t.type}>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => addContainer(roomId, t.type)}
                  >
                    <TypeIcon type={t.type} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">{tr(t.label)}</span>
                      <span className="mono block truncate text-[10.5px] muted">
                        {fmtLen(t.size[0], units, false)}×{fmtLen(t.size[1], units, false)}×{fmtLen(t.size[2], units, false)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {list.map((t) => (
                <button key={t.type} className="tile min-w-0" onClick={() => addContainer(roomId, t.type)} title={t.hint}>
                  <TypeIcon type={t.type} size={52} />
                  {/* Fixed label block keeps every tile in the grid the same height. */}
                  <span className="flex h-7 w-full flex-col justify-start">
                    <span className="w-full truncate text-[11.5px] font-medium leading-tight">{tr(t.label)}</span>
                    <span className="mono w-full truncate text-[10px] muted">
                      {fmtLen(t.size[0], units, false)}×{fmtLen(t.size[1], units, false)}×{fmtLen(t.size[2], units, false)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t hairline px-3 py-2 text-[11px] muted">{tr("Click an object to drop it into the room — it lands in the nearest free spot.")}</footer>
    </div>
  )
}
