import { useEffect, useState } from 'react'
import {
  Boxes, Database, LayoutDashboard, PackageSearch, ScrollText, Warehouse, BarChart3,
  Search, CheckCircle2, AlertTriangle, XCircle, Sun, Moon,
} from 'lucide-react'
import { useStore, type View } from './store'
import { Dashboard } from './views/Dashboard'
import { RoomsView } from './views/RoomsView'
import { InventoryView } from './views/InventoryView'
import { MovementsView } from './views/MovementsView'
import { ReportsView } from './views/ReportsView'
import { DataView } from './views/DataView'
import { CommandPalette } from './components/CommandPalette'
import { cx } from './lib/utils'

const NAV: { view: View; label: string; icon: typeof Boxes }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'rooms', label: 'Rooms & Layout', icon: Warehouse },
  { view: 'inventory', label: 'Inventory', icon: PackageSearch },
  { view: 'movements', label: 'Movements', icon: ScrollText },
  { view: 'reports', label: 'Reports', icon: BarChart3 },
  { view: 'data', label: 'Data & Settings', icon: Database },
]

function Toast() {
  const toast = useStore((s) => s.toast)
  const dismiss = useStore((s) => s.dismissToast)
  if (!toast) return null
  const Icon = toast.kind === 'ok' ? CheckCircle2 : toast.kind === 'warn' ? AlertTriangle : XCircle
  const color = toast.kind === 'ok' ? '#3fae8f' : toast.kind === 'warn' ? '#e0a33f' : '#e05252'
  return (
    <div className="pop-in no-print fixed bottom-5 left-1/2 z-[60] -translate-x-1/2">
      <button onClick={dismiss} className="float flex items-center gap-2 px-4 py-2.5 text-[12.5px]">
        <Icon size={15} style={{ color }} />
        {toast.msg}
      </button>
    </div>
  )
}

/** Icon rail item with a hover tooltip, as in a desktop planner. */
function RailButton({ label, active, onClick, children }: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <div className="group relative shrink-0">
      <button className="rail-btn" data-active={!!active} onClick={onClick} aria-label={label}>
        {children}
      </button>
      <span className="pointer-events-none absolute left-[46px] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[11.5px] opacity-0 shadow-md transition-opacity group-hover:opacity-100"
        style={{ background: 'var(--text)', color: 'var(--panel)' }}>
        {label}
      </span>
    </div>
  )
}

export default function App() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const theme = useStore((s) => s.settings.theme)
  const updateSettings = useStore((s) => s.updateSettings)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/*
        The rail is the one thing that must never be unreachable, so it scrolls
        rather than clipping. A landscape phone is only ~375 px tall and the
        rail wants ~384 px, which silently cut the search and theme buttons off
        the bottom with no way to reach them.
      */}
      <aside
        className="no-print nav-rail flex w-[52px] shrink-0 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden border-r hairline py-2 sm:w-[58px] sm:py-3"
        style={{ background: 'var(--panel)' }}
      >
        <div
          className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:mb-2"
          style={{ background: 'var(--accent)' }}
          title="StoreSpace"
        >
          <Boxes size={18} color="#fff" />
        </div>

        {NAV.map(({ view: v, label, icon: Icon }) => (
          <RailButton key={v} label={label} active={view === v} onClick={() => setView(v)}>
            <Icon size={18} />
          </RailButton>
        ))}

        <div className="mt-auto flex shrink-0 flex-col items-center gap-1 pt-1">
          <RailButton label="Search  (Ctrl K)" onClick={() => setPaletteOpen(true)}>
            <Search size={18} />
          </RailButton>
          <RailButton
            label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </RailButton>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">
        {view === 'dashboard' && <Dashboard />}
        {view === 'rooms' && <RoomsView />}
        {view === 'inventory' && <InventoryView />}
        {view === 'movements' && <MovementsView />}
        {view === 'reports' && <ReportsView />}
        {view === 'data' && <DataView />}
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toast />
    </div>
  )
}
