import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, X } from 'lucide-react'
import { cx } from '../lib/utils'

/* ------------------------------------------------------------------ select */

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  /** Muted trailing text — counts, codes, units. */
  hint?: string
  /** Heading to file this option under. Replaces `<optgroup>`. */
  group?: string
  disabled?: boolean
}

/**
 * Dropdown built out of a button and a portalled listbox.
 *
 * Not a `<select>`. A native select's *closed* control can be styled, but the
 * option list that drops out of it is rendered by the operating system —
 * outside the document, immune to CSS, and in the OS font and highlight colour.
 * So the app had a themed control that opened a grey Windows popup, which is
 * the one part of the UI that could never match. The only fix is to own the
 * popup, which means owning the keyboard behaviour too:
 *
 *  - closed: Enter / Space / Arrow opens, landing on the current value
 *  - open:   arrows move, Home/End jump, Enter commits, Escape cancels
 *
 * Focus deliberately stays on the trigger while open and the active option is
 * advertised via `aria-activedescendant`, which is the listbox pattern screen
 * readers expect and avoids a focus round-trip on every arrow press.
 *
 * The menu is portalled to `<body>` because several of these live inside panels
 * with `overflow: hidden`, which would otherwise clip the popup.
 */
export function Select<T extends string>({
  value, onChange, options, placeholder = 'Select…', disabled, className, title, ariaLabel,
}: {
  value: T | ''
  onChange: (v: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  className?: string
  title?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null)

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  /** Interleave group headings into the option order, first-seen wins. */
  const rows = useMemo(() => {
    const out: ({ kind: 'group'; label: string } | { kind: 'opt'; opt: SelectOption<T>; index: number })[] = []
    let current: string | undefined
    options.forEach((opt, index) => {
      if (opt.group && opt.group !== current) {
        current = opt.group
        out.push({ kind: 'group', label: opt.group })
      }
      out.push({ kind: 'opt', opt, index })
    })
    return out
  }, [options])

  /* Anchored to the trigger in viewport coordinates. Opening downward is the
     default, but a control near the bottom of the window flips upward — pinning
     via `bottom` rather than `top` means the height never has to be measured. */
  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - 10
    const above = r.top - 10
    const down = below >= 180 || below >= above
    setBox({
      left: r.left,
      width: r.width,
      ...(down ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
      maxH: Math.max(140, (down ? below : above) - 4),
    })
  }, [])

  useLayoutEffect(() => { if (open) place() }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    // Capture, so scrolling any ancestor repositions rather than leaving the
    // menu floating away from its trigger.
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  // Keep the highlighted row on screen as the arrows walk past the fold.
  useEffect(() => {
    if (!open || active < 0) return
    menuRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return i
    }
    return from
  }

  const commit = (i: number) => {
    const opt = options[i]
    if (!opt || opt.disabled) return
    onChange(opt.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        setActive(selectedIndex >= 0 ? selectedIndex : step(-1, 1))
        setOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive((a) => step(a, 1)); break
      case 'ArrowUp': e.preventDefault(); setActive((a) => step(a, -1)); break
      case 'Home': e.preventDefault(); setActive(step(-1, 1)); break
      case 'End': e.preventDefault(); setActive(step(options.length, -1)); break
      case 'Enter': e.preventDefault(); commit(active); break
      case 'Escape': e.preventDefault(); setOpen(false); triggerRef.current?.focus(); break
      case 'Tab': setOpen(false); break
      default: break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={open && active >= 0 ? `opt-${active}` : undefined}
        disabled={disabled}
        title={title}
        className={cx('input select-trigger', className)}
        onClick={() => {
          if (disabled) return
          setActive(selectedIndex >= 0 ? selectedIndex : step(-1, 1))
          setOpen((o) => !o)
        }}
        onKeyDown={onKeyDown}
      >
        <span className={cx('select-value', !selected && 'muted')}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={13} className="shrink-0 muted" />
      </button>

      {open && box && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="select-menu"
          style={{ left: box.left, top: box.top, bottom: box.bottom, minWidth: box.width, maxHeight: box.maxH }}
        >
          {rows.map((row, i) =>
            row.kind === 'group' ? (
              <div key={`g${i}`} className="select-group">{row.label}</div>
            ) : (
              <button
                key={row.opt.value || `o${i}`}
                id={`opt-${row.index}`}
                type="button"
                role="option"
                aria-selected={row.opt.value === value}
                data-idx={row.index}
                data-active={row.index === active}
                data-selected={row.opt.value === value}
                data-disabled={row.opt.disabled}
                className="select-opt"
                // Pointer, not hover: `onMouseEnter` fights the keyboard when the
                // cursor happens to rest over the list.
                onPointerMove={() => setActive(row.index)}
                onClick={() => commit(row.index)}
              >
                <span className="select-value">{row.opt.label}</span>
                {row.opt.hint && <span className="shrink-0 text-[11px] muted">{row.opt.hint}</span>}
                {row.opt.value === value && <Check size={13} className="shrink-0" />}
              </button>
            ),
          )}
          {!options.length && <div className="px-2 py-2 text-[12px] muted">Nothing to choose from</div>}
        </div>,
        document.body,
      )}
    </>
  )
}

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
      <Select value={value} onChange={onChange} options={options} disabled={disabled} ariaLabel={label} />
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
