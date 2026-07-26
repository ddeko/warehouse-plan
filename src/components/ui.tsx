import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx } from '../lib/utils'

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] muted leading-snug">{hint}</p>}
    </div>
  )
}

export function NumberField({
  label, value, onChange, min, max, step = 1, suffix, hint, disabled, className,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  hint?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="relative">
        <input
          type="number"
          className="input pr-9"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isNaN(n)) onChange(n)
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] muted">{suffix}</span>
        )}
      </div>
    </Field>
  )
}

export function TextField({
  label, value, onChange, placeholder, hint, disabled, mono, className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  disabled?: boolean
  mono?: boolean
  className?: string
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input
        className={cx('input', mono && 'mono')}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function SelectField<T extends string>({
  label, value, onChange, options, hint, disabled, className,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  hint?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select className="select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (b: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-[var(--panel-2)]"
    >
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && <span className="block text-[11px] muted leading-snug">{hint}</span>}
      </span>
      <span
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
          checked ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line)] bg-[var(--bg)]',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all',
            checked ? 'left-[18px] bg-[#04121c]' : 'left-0.5 bg-[var(--muted)]',
          )}
        />
      </span>
    </button>
  )
}

export function Modal({
  open, onClose, title, subtitle, children, footer, width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('card relative flex max-h-[88vh] w-full flex-col shadow-2xl', width)}>
        <header className="flex items-start justify-between gap-4 border-b hairline px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {subtitle && <p className="text-[11px] muted">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t hairline px-4 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function Confirm({
  open, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-sm"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className={cx('btn', danger ? 'btn-danger' : 'btn-primary')}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed muted">{message}</p>
    </Modal>
  )
}

export function Stat({
  label, value, sub, tone = 'default', icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'info'
  icon?: ReactNode
}) {
  const toneColor = {
    default: 'var(--text)', good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', info: '#38bdf8',
  }[tone]
  return (
    <div className="card min-w-0 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="label mb-0 truncate">{label}</p>
        {icon && <span className="shrink-0 muted">{icon}</span>}
      </div>
      {/* Long currency totals used to spill out of the card. */}
      <p
        className="mt-1.5 truncate text-xl font-semibold leading-tight tabular-nums"
        style={{ color: toneColor }}
        title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
      >
        {value}
      </p>
      {sub && <p className="mt-1 truncate text-[11px] muted" title={typeof sub === 'string' ? sub : undefined}>{sub}</p>}
    </div>
  )
}

export function Bar({ ratio, color, height = 5 }: { ratio: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  const auto = ratio > 1 ? '#ef4444' : ratio > 0.85 ? '#f59e0b' : ratio > 0.5 ? '#38bdf8' : '#22c55e'
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: 'var(--line)' }}>
      <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: color ?? auto }} />
    </div>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-[12px] muted leading-relaxed">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wider muted">{children}</h3>
      {right}
    </div>
  )
}

/** Autofocus + select-all text input used by inline renames. */
export function InlineInput({ value, onCommit, onCancel }: { value: string; onCommit: (v: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.select() }, [])
  return (
    <input
      ref={ref}
      className="input"
      defaultValue={value}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onCancel()
      }}
    />
  )
}
