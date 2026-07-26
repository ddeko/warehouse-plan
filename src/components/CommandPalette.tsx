import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, MapPin, Package, Search, Warehouse } from 'lucide-react'
import { useStore } from '../store'
import { cx, fmtNum } from '../lib/utils'

type Hit =
  | { kind: 'room'; id: string; title: string; sub: string }
  | { kind: 'container'; id: string; roomId: string; title: string; sub: string }
  | { kind: 'item'; id: string; containerId: string; title: string; sub: string }

/** Ctrl+K search across rooms, objects, SKUs and barcodes. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rooms = useStore((s) => s.rooms)
  const containers = useStore((s) => s.containers)
  const items = useStore((s) => s.items)
  const setView = useStore((s) => s.setView)
  const setActiveRoom = useStore((s) => s.setActiveRoom)
  const selectContainer = useStore((s) => s.selectContainer)
  const setInspectorTab = useStore((s) => s.setInspectorTab)

  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const out: Hit[] = []
    for (const r of rooms) {
      if (`${r.code} ${r.name} ${r.zone ?? ''}`.toLowerCase().includes(s)) {
        out.push({ kind: 'room', id: r.id, title: `${r.code} — ${r.name}`, sub: `${r.width / 100} × ${r.length / 100} m` })
      }
    }
    for (const c of containers) {
      if (`${c.code} ${c.name} ${c.type} ${c.zone ?? ''}`.toLowerCase().includes(s)) {
        const room = rooms.find((r) => r.id === c.roomId)
        out.push({ kind: 'container', id: c.id, roomId: c.roomId, title: `${c.code} — ${c.name}`, sub: `${c.type} in ${room?.code ?? '?'}` })
      }
    }
    for (const it of items) {
      if (`${it.sku} ${it.barcode} ${it.name} ${it.lot ?? ''} ${it.category} ${it.supplier ?? ''}`.toLowerCase().includes(s)) {
        const c = containers.find((k) => k.id === it.containerId)
        const room = rooms.find((r) => r.id === c?.roomId)
        out.push({
          kind: 'item', id: it.id, containerId: it.containerId,
          title: `${it.name}`,
          sub: `${it.sku} · ${fmtNum(it.qty)} ${it.uom} · ${room?.code ?? '?'}/${c?.code ?? '?'}`,
        })
      }
    }
    return out.slice(0, 40)
  }, [q, rooms, containers, items])

  const go = (h: Hit) => {
    if (h.kind === 'room') {
      setActiveRoom(h.id)
      setView('rooms')
    } else if (h.kind === 'container') {
      setActiveRoom(h.roomId)
      selectContainer(h.id)
      setInspectorTab('object')
      setView('rooms')
    } else {
      const c = containers.find((k) => k.id === h.containerId)
      if (c) {
        setActiveRoom(c.roomId)
        selectContainer(c.id)
        setInspectorTab('items')
        setView('rooms')
      }
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh] fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="card relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 border-b hairline px-3 py-2.5">
          <Search size={15} className="muted" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[14px] outline-none"
            placeholder="Search rooms, objects, SKUs, barcodes…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
              if (e.key === 'Enter' && hits[cursor]) go(hits[cursor])
              if (e.key === 'Escape') onClose()
            }}
          />
          <kbd className="rounded border hairline px-1 text-[10px] muted">Esc</kbd>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!q && <p className="p-6 text-center text-[12px] muted">Type to search. Scan a barcode into this box to jump straight to the stock line.</p>}
          {q && hits.length === 0 && <p className="p-6 text-center text-[12px] muted">No matches for “{q}”.</p>}
          {hits.map((h, i) => {
            const Icon = h.kind === 'room' ? Warehouse : h.kind === 'container' ? Box : Package
            return (
              <button
                key={`${h.kind}-${h.id}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(h)}
                className={cx('flex w-full items-center gap-2.5 px-3 py-2 text-left', i === cursor && 'bg-[var(--panel-2)]')}
              >
                <Icon size={14} className="muted shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{h.title}</span>
                  <span className="mono block truncate text-[10.5px] muted">{h.sub}</span>
                </span>
                <MapPin size={12} className="muted shrink-0" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
