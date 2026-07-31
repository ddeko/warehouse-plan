import { useMemo, useRef, useState } from 'react'
import { Database, Download, FileUp, GraduationCap, RotateCcw, Sparkles, Upload, HardDrive } from 'lucide-react'
import type { AppData, Units } from '../types'
import { useStore, DEFAULT_SETTINGS } from '../store'
import { Confirm, NumberField, Select, SelectField, SectionTitle, TextField, Toggle } from '../components/ui'
import { parseCSV, toCSV } from '../lib/csv'
import { CURRENCIES, currencySymbol } from '../lib/currencies'
import { download, fmtNum, generateBarcode, uid } from '../lib/utils'

export function DataView() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)
  const loadSample = useStore((s) => s.loadSample)
  const resetAll = useStore((s) => s.resetAll)
  const notify = useStore((s) => s.notify)
  const rooms = useStore((s) => s.rooms)
  const containers = useStore((s) => s.containers)
  const items = useStore((s) => s.items)
  const movements = useStore((s) => s.movements)
  const setTourOpen = useStore((s) => s.setTourOpen)

  const jsonInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')

  const bytes = new Blob([JSON.stringify(exportData())]).size

  /*
   * A code saved before this was a dropdown — or restored from an older
   * backup — will not be in the list, and an unmatched value renders as the
   * placeholder, which reads as "nothing set" while the reports carry on using
   * it. Carry the stray code as its own option so the control stays honest.
   */
  const currencyOptions = useMemo(() => {
    const known = CURRENCIES.map((c) => {
      const symbol = currencySymbol(c.code)
      return { value: c.code, label: `${c.code} — ${c.name}`, hint: symbol, group: c.region }
    })
    if (settings.currency && !CURRENCIES.some((c) => c.code === settings.currency)) {
      known.unshift({ value: settings.currency, label: settings.currency, hint: '', group: 'Current' })
    }
    return known
  }, [settings.currency])

  const doExportJson = () => {
    download(
      `storespace-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(exportData(), null, 2),
    )
    notify('Backup downloaded')
  }

  const doImportJson = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Partial<AppData>
      if (!data.rooms && !data.items) throw new Error('Not a StoreSpace backup')
      importData(data, importMode)
    } catch (e) {
      notify(`Import failed: ${(e as Error).message}`, 'err')
    }
  }

  /** CSV item import: matches containers by code, creates the missing fields. */
  const doImportCsv = async (file: File) => {
    try {
      const rows = parseCSV(await file.text())
      if (!rows.length) throw new Error('empty file')
      const byCode = new Map(containers.map((c) => [c.code.toLowerCase(), c]))
      const add = useStore.getState().addItem
      /** `Number('')` is 0 and `Number('abc')` is NaN — both used to be stored. */
      const optionalNum = (v: string | undefined) => {
        if (!v || !v.trim()) return undefined
        const n = Number(v)
        return Number.isFinite(n) ? n : undefined
      }
      let ok = 0
      let skipped = 0
      let rehomed = 0
      for (const r of rows) {
        const code = (r.container || r.container_code || r.location || '').toLowerCase()
        const matched = byCode.get(code)
        // Falling back to the first object keeps a partly-wrong file usable,
        // but doing it silently meant a mistyped column piled the entire
        // import onto one shelf under a cheerful success message.
        const target = matched ?? containers[0]
        if (!target) { skipped++; continue }
        if (!matched) rehomed++
        add(target.id, {
          sku: r.sku || `IMP-${uid().slice(0, 6).toUpperCase()}`,
          barcode: r.barcode || generateBarcode(),
          name: r.name || r.item || 'Imported item',
          category: r.category || 'General',
          qty: Math.max(0, optionalNum(r.qty ?? r.quantity) ?? 0),
          uom: (r.uom || 'pcs') as never,
          slots: Math.max(0, optionalNum(r.slots) ?? 1),
          unitCost: optionalNum(r.unit_cost),
          unitWeightKg: optionalNum(r.unit_weight_kg),
          minQty: optionalNum(r.min_qty),
          lot: r.lot || undefined,
          serial: r.serial || undefined,
          supplier: r.supplier || undefined,
          slot: r.sub_location || undefined,
          receivedAt: r.received || undefined,
          expiryAt: r.expiry || undefined,
          notes: r.notes || undefined,
          tags: r.tags ? r.tags.split('|').filter(Boolean) : [],
        })
        ok++
      }
      const notes = [
        skipped && `skipped ${skipped}`,
        rehomed && `${rehomed} had no matching object code and went to ${containers[0]?.code}`,
      ].filter(Boolean)
      notify(
        `Imported ${ok} lines${notes.length ? ` — ${notes.join(', ')}` : ''}`,
        rehomed ? 'warn' : 'ok',
      )
    } catch (e) {
      notify(`CSV import failed: ${(e as Error).message}`, 'err')
    }
  }

  const downloadTemplate = () => {
    const sample = [{
      container: containers[0]?.code ?? 'SHF-01', sku: 'HRD-00001', barcode: '2001234567890',
      name: 'Hex Bolt 10x60', category: 'Hardware', qty: 250, uom: 'pcs', slots: 1,
      unit_cost: '0.45', unit_weight_kg: '0.08', min_qty: 50, lot: 'L1042', serial: '',
      supplier: 'Atlas Components', sub_location: 'L2-B3', received: '2026-07-01', expiry: '',
      tags: 'fast-mover', notes: '',
    }]
    download('storespace-item-template.csv', toCSV(sample), 'text/csv')
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b hairline px-5 py-3.5" style={{ background: 'var(--panel)' }}>
        <h1 className="text-[15px] font-semibold">Data &amp; settings</h1>
        <p className="text-[11.5px] muted">Preferences, backups and bulk import/export</p>
      </header>

      {/* Forms read badly at full monitor width, so cap the column measure. */}
      <div className="mx-auto grid max-w-[1280px] gap-4 p-5 lg:grid-cols-2">
        {/* ------------------------------------------------------- settings */}
        <section className="card p-4">
          <SectionTitle>Display &amp; behaviour</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Measurement units"
              value={settings.units}
              onChange={(v: Units) => updateSettings({ units: v })}
              options={[
                { value: 'cm', label: 'Centimetres (cm)' },
                { value: 'm', label: 'Metres (m)' },
                { value: 'in', label: 'Inches (in)' },
              ]}
              hint="Sizes are stored in cm and converted for display"
            />
            <SelectField
              label="Theme"
              value={settings.theme}
              onChange={(v: 'dark' | 'light') => updateSettings({ theme: v })}
              options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
            />
            <TextField label="Operator name" value={settings.operator} onChange={(v) => updateSettings({ operator: v })} hint="Stamped on every movement" />
            <SelectField
              label="Currency"
              value={settings.currency}
              onChange={(v) => updateSettings({ currency: v })}
              options={currencyOptions}
              hint="Used for stock value across the dashboard and reports"
            />
            <NumberField label="Expiry warning" suffix="days" min={0} value={settings.expiryWarnDays} onChange={(v) => updateSettings({ expiryWarnDays: Math.max(0, Math.round(v)) })} />
            <NumberField label="Wall clearance" suffix="cm" min={0} step={5} value={settings.wallClearance} onChange={(v) => updateSettings({ wallClearance: Math.max(0, v) })} hint="Keeps objects away from room edges" />
          </div>

          <div className="mt-3 space-y-0.5 border-t hairline pt-3">
            <Toggle label="Snap to grid" hint="Objects align to the room's grid spacing while dragging" checked={settings.snapEnabled} onChange={(b) => updateSettings({ snapEnabled: b })} />
            <Toggle label="Collision detection" hint="Blocks objects from overlapping each other" checked={settings.collisionEnabled} onChange={(b) => updateSettings({ collisionEnabled: b })} />
            <Toggle label="Show grid" checked={settings.showGrid} onChange={(b) => updateSettings({ showGrid: b })} />
            <Toggle label="Show walls" checked={settings.showWalls} onChange={(b) => updateSettings({ showWalls: b })} />
            <Toggle label="Show object labels" checked={settings.showLabels} onChange={(b) => updateSettings({ showLabels: b })} />
            <Toggle label="Show fill badges" hint="Only containers holding stock get a badge" checked={settings.showFillBadges} onChange={(b) => updateSettings({ showFillBadges: b })} />
          </div>

          <button className="btn mt-3" onClick={() => updateSettings(DEFAULT_SETTINGS)}>
            <RotateCcw size={13} /> Reset settings to defaults
          </button>
        </section>

        {/* --------------------------------------------------------- backup */}
        <div className="space-y-4">
          <section className="card p-4">
            <SectionTitle>Storage</SectionTitle>
            <div className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
              {[
                ['Rooms', rooms.length],
                ['Objects', containers.length],
                ['Stock lines', items.length],
                ['Movements', movements.length],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-lg border hairline p-2 panel-2">
                  <p className="muted text-[10.5px]">{label}</p>
                  <p className="text-[16px] font-semibold tabular-nums">{fmtNum(n as number)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] muted">
              <HardDrive size={12} /> Roughly {fmtNum(bytes / 1024, 1)} KB held in this browser's local storage.
            </p>
          </section>

          <section className="card p-4">
            <SectionTitle>Backup &amp; restore</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              <button className="btn btn-primary" onClick={doExportJson}><Download size={13} /> Export JSON backup</button>
              <button className="btn" onClick={() => jsonInput.current?.click()}><Upload size={13} /> Import JSON</button>
              <Select
                className="w-[190px]"
                value={importMode}
                onChange={(v) => setImportMode(v as 'replace' | 'merge')}
                options={[
                  { value: 'replace', label: 'Replace everything' },
                  { value: 'merge', label: 'Merge into current' },
                ]}
                ariaLabel="Import mode"
              />
            </div>
            <input
              ref={jsonInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) doImportJson(f); e.target.value = '' }}
            />

            <div className="mt-4 border-t hairline pt-3">
              <SectionTitle>Bulk item import (CSV)</SectionTitle>
              <p className="mb-2 text-[11px] muted leading-relaxed">
                Match rows to objects with a <code className="mono">container</code> column holding the object code
                (e.g. <code className="mono">SHF-01</code>). Unknown codes fall back to the first object.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button className="btn" onClick={() => csvInput.current?.click()} disabled={!containers.length}><FileUp size={13} /> Import items CSV</button>
                <button className="btn" onClick={downloadTemplate}><Download size={13} /> Download template</button>
              </div>
              <input
                ref={csvInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) doImportCsv(f); e.target.value = '' }}
              />
            </div>
          </section>

          <section className="card p-4">
            <SectionTitle>Demo &amp; reset</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              <button className="btn" onClick={loadSample}><Sparkles size={13} /> Load sample warehouse</button>
              {/* The tour runs itself once on a first visit, so this is the only
                  way back to it afterwards. */}
              <button className="btn" onClick={() => setTourOpen(true)}><GraduationCap size={13} /> Replay guided tour</button>
              <button className="btn btn-danger" onClick={() => setConfirmReset(true)}><Database size={13} /> Delete all data</button>
            </div>
            <p className="mt-2 text-[11px] muted">Loading the sample replaces the current rooms, objects, items and history.</p>
          </section>
        </div>
      </div>

      <Confirm
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetAll}
        title="Delete all data?"
        message="Every room, object, stock line and movement is removed from this browser. Export a backup first if you need one."
        confirmLabel="Delete everything"
      />
    </div>
  )
}
