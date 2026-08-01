import { useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { useStore, containerStats } from '../store'
import { containerMeta } from '../types'
import { Bar, Empty, SectionTitle, Stat } from '../components/ui'
import { toCSV } from '../lib/csv'
import { areaM2, cx, download, fmtMoney, fmtNum, volM3 } from '../lib/utils'
import { usedFloorArea } from '../lib/geometry'
import { t as tr, trf } from '../lib/i18n'

type Report = 'abc' | 'capacity' | 'aging' | 'valuation' | 'zones'

const REPORTS: { key: Report; label: string; blurb: string }[] = [
  { key: 'abc', label: 'ABC analysis', blurb: 'Pareto classification: A = top 80% of stock value, B = next 15%, C = last 5%' },
  { key: 'capacity', label: 'Capacity & space', blurb: 'Floor and slot utilisation per room and object' },
  { key: 'aging', label: 'Stock aging', blurb: 'How long stock has been sitting, by receipt date' },
  { key: 'valuation', label: 'Valuation', blurb: 'Value and weight rolled up by category and status' },
  { key: 'zones', label: 'Zone density', blurb: 'Objects, slots and value grouped by zone' },
]

export function ReportsView() {
  const rooms = useStore((s) => s.rooms)
  const containers = useStore((s) => s.containers)
  const items = useStore((s) => s.items)
  const settings = useStore((s) => s.settings)
  const [report, setReport] = useState<Report>('abc')

  const lines = useMemo(
    () => items.map((i) => ({ i, value: (i.unitCost ?? 0) * i.qty, weight: (i.unitWeightKg ?? 0) * i.qty })),
    [items],
  )
  const totalValue = lines.reduce((n, l) => n + l.value, 0)

  const abc = useMemo(() => {
    const sorted = [...lines].sort((a, b) => b.value - a.value)
    let cum = 0
    return sorted.map((l) => {
      cum += l.value
      const share = totalValue ? cum / totalValue : 0
      return { ...l, cumShare: share, klass: share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C' }
    })
  }, [lines, totalValue])

  const aging = useMemo(() => {
    const buckets = [
      { label: '0–30 days', min: 0, max: 30 },
      { label: '31–90 days', min: 31, max: 90 },
      { label: '91–180 days', min: 91, max: 180 },
      { label: '181–365 days', min: 181, max: 365 },
      { label: 'Over 1 year', min: 366, max: Infinity },
      { label: 'No date', min: -1, max: -1 },
    ]
    const now = Date.now()
    return buckets.map((b) => {
      const rows = lines.filter(({ i }) => {
        if (!i.receivedAt) return b.min === -1
        if (b.min === -1) return false
        const parsed = new Date(i.receivedAt).getTime()
        if (Number.isNaN(parsed)) return b.min === -1
        /*
         * A received date in the future gives a negative age, which fell
         * through every bucket — the line vanished from the report and the
         * totals silently stopped reconciling with the inventory screen.
         * Future receipts are newest, so they belong in the first bucket.
         */
        const age = Math.max(0, Math.floor((now - parsed) / 86_400_000))
        return age >= b.min && age <= b.max
      })
      return {
        ...b,
        lines: rows.length,
        qty: rows.reduce((n, r) => n + r.i.qty, 0),
        value: rows.reduce((n, r) => n + r.value, 0),
      }
    })
  }, [lines])

  const valuation = useMemo(() => {
    const map = new Map<string, { lines: number; qty: number; value: number; weight: number }>()
    for (const l of lines) {
      const cur = map.get(l.i.category) ?? { lines: 0, qty: 0, value: 0, weight: 0 }
      cur.lines += 1; cur.qty += l.i.qty; cur.value += l.value; cur.weight += l.weight
      map.set(l.i.category, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value)
  }, [lines])

  const zones = useMemo(() => {
    const map = new Map<string, { objects: number; cap: number; slots: number; value: number; rooms: Set<string> }>()
    for (const c of containers) {
      const z = c.zone || '—'
      const cur = map.get(z) ?? { objects: 0, cap: 0, slots: 0, value: 0, rooms: new Set<string>() }
      const st = containerStats(items, c)
      cur.objects += 1
      cur.cap += c.capacity
      cur.slots += st.usedSlots
      cur.value += st.value
      cur.rooms.add(c.roomId)
      map.set(z, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value)
  }, [containers, items])

  const capacity = useMemo(
    () =>
      rooms.map((r) => {
        const list = containers.filter((c) => c.roomId === r.id)
        const stats = list.map((c) => ({ c, st: containerStats(items, c) }))
        return {
          room: r,
          objects: list.length,
          floorRatio: usedFloorArea(list) / (r.width * r.length),
          cap: list.reduce((n, c) => n + c.capacity, 0),
          slots: stats.reduce((n, s) => n + s.st.usedSlots, 0),
          value: stats.reduce((n, s) => n + s.st.value, 0),
          weight: stats.reduce((n, s) => n + s.st.weight, 0),
          rows: stats.sort((a, b) => b.st.fill - a.st.fill),
        }
      }),
    [rooms, containers, items],
  )

  const exportCurrent = () => {
    let rows: Record<string, unknown>[] = []
    if (report === 'abc') {
      rows = abc.map((l) => ({
        class: l.klass, sku: l.i.sku, name: l.i.name, category: l.i.category,
        qty: l.i.qty, uom: l.i.uom, value: l.value.toFixed(2),
        share: totalValue ? ((l.value / totalValue) * 100).toFixed(2) : '0',
        cumulative: (l.cumShare * 100).toFixed(2),
      }))
    } else if (report === 'aging') {
      rows = aging.map((b) => ({ bucket: tr(b.label), lines: b.lines, qty: b.qty, value: b.value.toFixed(2) }))
    } else if (report === 'valuation') {
      rows = valuation.map(([cat, v]) => ({ category: cat, lines: v.lines, qty: v.qty, value: v.value.toFixed(2), weight_kg: v.weight.toFixed(2) }))
    } else if (report === 'zones') {
      rows = zones.map(([z, v]) => ({ zone: z, objects: v.objects, rooms: v.rooms.size, slots_used: v.slots, slot_capacity: v.cap, value: v.value.toFixed(2) }))
    } else {
      rows = capacity.flatMap((r) =>
        r.rows.map(({ c, st }) => ({
          room: r.room.code, room_name: r.room.name, object: c.code, name: c.name, type: c.type,
          width_cm: c.w, depth_cm: c.d, height_cm: c.h, footprint_m2: ((c.w * c.d) / 10000).toFixed(2),
          volume_m3: volM3(c.w, c.d, c.h), slots_used: st.usedSlots, slot_capacity: c.capacity,
          fill_pct: Math.round(st.fill * 100), weight_kg: st.weight.toFixed(1), value: st.value.toFixed(2),
        })),
      )
    }
    download(`report-${report}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), 'text/csv')
  }

  if (!items.length && !containers.length) {
    return <Empty title={tr("Nothing to report yet")} hint={tr("Create rooms, add storage objects and record stock — reports build automatically.")} />
  }

  const active = REPORTS.find((r) => r.key === report)!

  return (
    <div className="flex h-full flex-col">
      <header className="border-b hairline px-5 py-3" style={{ background: 'var(--panel)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h1 className="text-[15px] font-semibold">{tr("Reports")}</h1>
            <p className="text-[11.5px] muted">{tr(active.blurb)}</p>
          </div>
          <div className="ml-auto flex gap-1.5">
            <button className="btn" onClick={exportCurrent}><Download size={13} />{tr("Export CSV")}</button>
            <button className="btn" onClick={() => window.print()}><Printer size={13} />{tr("Print")}</button>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {REPORTS.map((r) => (
            <button key={r.key} className={cx('btn btn-sm', report === r.key && 'btn-active')} onClick={() => setReport(r.key)}>
              {tr(r.label)}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        {report === 'abc' && (
          <>
            <div className="mb-3 rounded-xl border hairline p-3 text-[11.5px] leading-relaxed muted panel-2">
              <b className="text-[var(--text)]">{tr("What the class means.")}</b> Lines are ranked by total value
              (qty × unit cost) and split by cumulative share, the classic 80/15/5 Pareto rule.
              {' '}<b className="text-[var(--text)]">A</b> is the small set of lines carrying most of your money —
              count these often and never run them out.
              {' '}<b className="text-[var(--text)]">B</b> is the middle.
              {' '}<b className="text-[var(--text)]">C</b> is the long tail: many lines, little value — cheap to
              overstock, not worth tight control.
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {([
                { k: 'A' as const, desc: tr('Top 80% of value — tight control') },
                { k: 'B' as const, desc: tr('Next 15% — routine control') },
                { k: 'C' as const, desc: tr('Last 5% — minimal control') },
              ]).map(({ k, desc }) => {
                const rows = abc.filter((l) => l.klass === k)
                const v = rows.reduce((n, r) => n + r.value, 0)
                return (
                  <Stat
                    key={k}
                    label={`${tr('Class')} ${k} · ${desc}`}
                    value={trf('{n} lines', { n: rows.length })}
                    sub={trf('{money} · {pct}% of value', {
                      money: fmtMoney(v, settings.currency),
                      pct: totalValue ? Math.round((v / totalValue) * 100) : 0,
                    })}
                    tone={k === 'A' ? 'good' : k === 'B' ? 'info' : 'default'}
                  />
                )
              })}
            </div>
            <div className="card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>{tr("Class")}</th><th>{tr("SKU")}</th><th>{tr("Item")}</th><th>{tr("Category")}</th><th className="num">{tr("Qty")}</th><th className="num">{tr("Value")}</th><th className="num">{tr("Share")}</th><th className="w-40">{tr("Cumulative")}</th></tr>
                </thead>
                <tbody>
                  {abc.slice(0, 200).map((l) => (
                    <tr key={l.i.id}>
                      <td>
                        <span
                          className="chip"
                          style={{ color: l.klass === 'A' ? '#3fae8f' : l.klass === 'B' ? '#4d8fd6' : 'var(--muted)' }}
                          title={l.klass === 'A' ? tr('Top 80% of inventory value') : l.klass === 'B' ? tr('Next 15% of value') : tr('Last 5% of value')}
                        >
                          {l.klass}
                        </span>
                      </td>
                      <td className="mono">{l.i.sku}</td>
                      <td className="max-w-[240px] truncate">{l.i.name}</td>
                      <td className="muted">{l.i.category}</td>
                      <td className="num tabular-nums">{fmtNum(l.i.qty)}</td>
                      <td className="num tabular-nums">{fmtMoney(l.value, settings.currency)}</td>
                      <td className="num tabular-nums muted">{totalValue ? ((l.value / totalValue) * 100).toFixed(1) : '0'}%</td>
                      <td><Bar ratio={l.cumShare} height={4} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* The class cards and the CSV export both use the whole list,
                  so a silent cut here made the table look complete when it
                  was not. Say what is missing. */}
              {abc.length > 200 && (
                <p className="border-t hairline px-3 py-2 text-[11px] muted">
                  Showing the top 200 of {fmtNum(abc.length)} lines by value. Export the CSV for the full list.
                </p>
              )}
            </div>
          </>
        )}

        {report === 'capacity' && (
          <div className="space-y-4">
            {capacity.map((r) => (
              <section key={r.room.id} className="card overflow-x-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-semibold">{r.room.code} — {r.room.name}</p>
                    <p className="mono text-[11px] muted">
                      {r.room.width / 100}×{r.room.length / 100}×{r.room.height / 100} m ·
                      {' '}{fmtNum(areaM2(r.room.width, r.room.length), 1)} m² ·
                      {' '}{fmtNum(volM3(r.room.width, r.room.length, r.room.height), 1)} m³
                    </p>
                  </div>
                  <div className="flex gap-5 text-[11px]">
                    <div className="w-28">
                      <div className="mb-0.5 flex justify-between muted"><span>{tr("Floor")}</span><span>{Math.round(r.floorRatio * 100)}%</span></div>
                      <Bar ratio={r.floorRatio} height={4} />
                    </div>
                    <div className="w-28">
                      <div className="mb-0.5 flex justify-between muted"><span>{tr("Slots")}</span><span>{r.cap ? Math.round((r.slots / r.cap) * 100) : 0}%</span></div>
                      <Bar ratio={r.cap ? r.slots / r.cap : 0} height={4} />
                    </div>
                    <div className="text-right">
                      <p className="muted">{tr("Value")}</p>
                      <p className="font-semibold tabular-nums">{fmtMoney(r.value, settings.currency)}</p>
                    </div>
                  </div>
                </div>
                <table className="table">
                  <thead>
                    <tr><th>{tr("Object")}</th><th>{tr("Type")}</th><th>{tr("Size (cm)")}</th><th className="num">{tr("Footprint")}</th><th className="num">{tr("Slots")}</th><th className="w-32">{tr("Fill")}</th><th className="num">{tr("Weight")}</th><th className="num">{tr("Value")}</th></tr>
                  </thead>
                  <tbody>
                    {r.rows.map(({ c, st }) => (
                      <tr key={c.id}>
                        <td><span className="mono">{c.code}</span> <span className="muted">{c.name}</span></td>
                        <td className="muted">{tr(containerMeta(c.type).label)}</td>
                        <td className="mono muted">{c.w}×{c.d}×{c.h}</td>
                        <td className="num tabular-nums muted">{((c.w * c.d) / 10000).toFixed(2)} m²</td>
                        <td className="num tabular-nums">{st.usedSlots}/{c.capacity}</td>
                        <td><Bar ratio={st.fill} height={4} /></td>
                        <td className={cx('num tabular-nums', st.overweight && 'text-red-400')}>{fmtNum(st.weight, 1)} kg</td>
                        <td className="num tabular-nums muted">{fmtMoney(st.value, settings.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}

        {report === 'aging' && (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>{tr("Age bucket")}</th><th className="num">{tr("Lines")}</th><th className="num">{tr("Units")}</th><th className="num">{tr("Value")}</th><th className="w-52">{tr("Share of value")}</th></tr></thead>
              <tbody>
                {aging.map((b) => (
                  <tr key={b.label}>
                    <td className="font-medium">{tr(b.label)}</td>
                    <td className="num tabular-nums">{fmtNum(b.lines)}</td>
                    <td className="num tabular-nums">{fmtNum(b.qty)}</td>
                    <td className="num tabular-nums">{fmtMoney(b.value, settings.currency)}</td>
                    <td><Bar ratio={totalValue ? b.value / totalValue : 0} height={4} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {report === 'valuation' && (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>{tr("Category")}</th><th className="num">{tr("Lines")}</th><th className="num">{tr("Units")}</th><th className="num">{tr("Weight")}</th><th className="num">{tr("Value")}</th><th className="w-52">{tr("Share")}</th></tr></thead>
              <tbody>
                {valuation.map(([cat, v]) => (
                  <tr key={cat}>
                    <td className="font-medium">{cat}</td>
                    <td className="num tabular-nums">{fmtNum(v.lines)}</td>
                    <td className="num tabular-nums">{fmtNum(v.qty)}</td>
                    <td className="num tabular-nums muted">{fmtNum(v.weight, 1)} kg</td>
                    <td className="num tabular-nums">{fmtMoney(v.value, settings.currency)}</td>
                    <td><Bar ratio={totalValue ? v.value / totalValue : 0} height={4} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="font-semibold">{tr("Total")}</td>
                  <td className="num tabular-nums font-semibold">{fmtNum(items.length)}</td>
                  <td className="num tabular-nums font-semibold">{fmtNum(items.reduce((n, i) => n + i.qty, 0))}</td>
                  <td className="num tabular-nums font-semibold">{fmtNum(lines.reduce((n, l) => n + l.weight, 0), 1)} kg</td>
                  <td className="num tabular-nums font-semibold">{fmtMoney(totalValue, settings.currency)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {report === 'zones' && (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>{tr("Zone")}</th><th className="num">{tr("Rooms")}</th><th className="num">{tr("Objects")}</th><th className="num">{tr("Slots used")}</th><th className="w-40">{tr("Occupancy")}</th><th className="num">{tr("Value")}</th></tr></thead>
              <tbody>
                {zones.map(([z, v]) => (
                  <tr key={z}>
                    <td className="font-medium">{z}</td>
                    <td className="num tabular-nums">{v.rooms.size}</td>
                    <td className="num tabular-nums">{v.objects}</td>
                    <td className="num tabular-nums">{v.slots} / {v.cap}</td>
                    <td><Bar ratio={v.cap ? v.slots / v.cap : 0} height={4} /></td>
                    <td className="num tabular-nums">{fmtMoney(v.value, settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
