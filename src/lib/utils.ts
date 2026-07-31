import type { Units } from '../types'

export const uid = (prefix = ''): string => {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return prefix ? `${prefix}_${raw}` : raw
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const round = (v: number, dp = 0) => {
  const f = 10 ** dp
  return Math.round(v * f) / f
}

/** Format a centimetre value in the user's chosen display unit. */
export function fmtLen(cm: number, units: Units, withUnit = true): string {
  if (units === 'm') return `${round(cm / 100, 2)}${withUnit ? ' m' : ''}`
  if (units === 'in') return `${round(cm / 2.54, 1)}${withUnit ? ' in' : ''}`
  return `${round(cm, 1)}${withUnit ? ' cm' : ''}`
}

/** Convert a value typed by the user (in display units) back to centimetres. */
export function toCm(value: number, units: Units): number {
  if (units === 'm') return value * 100
  if (units === 'in') return value * 2.54
  return value
}

export function fromCm(cm: number, units: Units): number {
  if (units === 'm') return round(cm / 100, 3)
  if (units === 'in') return round(cm / 2.54, 2)
  return round(cm, 1)
}

export const unitSuffix = (units: Units) => (units === 'in' ? 'in' : units)

/** Floor area in m² from centimetre dimensions. */
export const areaM2 = (wCm: number, lCm: number) => round((wCm * lCm) / 10000, 2)

/** Volume in m³ from centimetre dimensions. */
export const volM3 = (wCm: number, lCm: number, hCm: number) => round((wCm * lCm * hCm) / 1_000_000, 2)

export const fmtNum = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const fmtMoney = (n: number, currency = 'USD') => {
  try {
    return n.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 2 })
  } catch {
    return `${currency} ${fmtNum(n, 2)}`
  }
}

export const fmtDate = (v?: string | number) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toISOString().slice(0, 10)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Local wall-clock stamp. Date and time must come from the same clock, or a
 *  descending-by-timestamp list appears mis-sorted around midnight UTC. */
export const fmtDateTime = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function daysUntil(dateISO?: string): number | null {
  if (!dateISO) return null
  const d = new Date(dateISO)
  if (Number.isNaN(d.getTime())) return null
  /*
   * "Today" has to be the same today that `todayISO` stamps on a receipt.
   * This used to take the UTC date while `todayISO` took the local one, so
   * east of UTC every "days left" was off by one for part of the day — and an
   * item received today could read as expiring yesterday.
   */
  const ms = d.getTime() - new Date(todayISO()).getTime()
  return Math.round(ms / 86_400_000)
}

/** Deterministic-ish EAN-13 style numeric barcode with a valid check digit. */
export function generateBarcode(prefix = '200'): string {
  let body = prefix
  while (body.length < 12) body += Math.floor(Math.random() * 10)
  body = body.slice(0, 12)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3)
  const check = (10 - (sum % 10)) % 10
  return body + check
}

export function generateSku(category: string, seq: number): string {
  const base = (category || 'GEN').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')
  return `${base}-${String(seq).padStart(5, '0')}`
}

/** Next free sequential code such as RM-03 / SHF-07. */
export function nextCode(prefix: string, existing: string[]): string {
  let max = 0
  for (const c of existing) {
    const m = c?.match(new RegExp(`^${prefix}-(\\d+)$`))
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`
}

export function download(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Mix a hex colour toward white/black. amount > 0 lightens, < 0 darkens. */
export function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  const t = amount > 0 ? 255 : 0
  const p = Math.abs(amount)
  r = Math.round((t - r) * p + r)
  g = Math.round((t - g) * p + g)
  b = Math.round((t - b) * p + b)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
