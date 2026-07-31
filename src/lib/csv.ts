/**
 * Spreadsheets treat a cell opening with `= + - @` (or a leading tab/CR) as a
 * formula, so an item named `=1+1` — or something considerably less playful
 * pointing at an external URL — executes the moment an export is opened in
 * Excel or Sheets. Prefixing an apostrophe is the standard defusal: the cell
 * displays as typed and is inert. Only applied where it is needed, so ordinary
 * text and negative numbers round-trip untouched.
 */
const defuse = (s: string): string => (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s)

const escape = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = defuse(String(v))
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV<T extends Record<string, unknown>>(rows: T[], columns?: (keyof T)[]): string {
  if (!rows.length) return ''
  const cols = (columns ?? (Object.keys(rows[0]) as (keyof T)[]))
  const head = cols.map((c) => escape(String(c))).join(',')
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n')
  return `${head}\n${body}`
}

/** Minimal RFC-4180 parser — enough for round-tripping our own exports. */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  if (!rows.length) return []

  const header = rows[0].map((h) => h.trim())
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}
