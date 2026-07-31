import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, MessageSquarePlus, Sparkles } from 'lucide-react'
import { useStore, type View } from '../store'

/**
 * First-run walkthrough: a speech bubble that hops from feature to feature.
 *
 * Every step is anchored to the navigation rail rather than to controls inside
 * the views. The rail is the only chrome guaranteed to exist — a fresh browser
 * has no rooms, so the layout toolbar, the object catalog and half the tables
 * are not on screen at all, and a tour that pointed at them would spend its
 * steps highlighting nothing. Stepping through the rail still switches the view
 * behind the bubble, so each screen is visible while it is being described.
 */

/**
 * Shown once per browser, ever.
 *
 * The flag is written the moment the tour opens rather than when it ends: a
 * reload halfway through — or a tab closed on step 3 — otherwise counted as
 * "not seen yet" and the whole thing started over, which is exactly the kind of
 * greeting that gets an app closed. Nothing is lost by being early, because
 * Data & settings can replay it on demand.
 *
 * localStorage rather than sessionStorage, and next to the app's own
 * `storespace.v1` data, so it survives for as long as the rooms do.
 */
const SEEN_KEY = 'storespace.tour.v1'

/**
 * Second line of defence. If localStorage is unavailable (Safari private mode,
 * a hardened profile) the write is swallowed, and without this the tour would
 * greet the same person on every reload. Remembering it in the module at least
 * holds for the session.
 */
let seenThisSession = false

export function tourSeen(): boolean {
  if (seenThisSession) return true
  try {
    return localStorage.getItem(SEEN_KEY) === 'done'
  } catch {
    return false
  }
}

export function markTourSeen() {
  seenThisSession = true
  try {
    localStorage.setItem(SEEN_KEY, 'done')
  } catch {
    /* nothing to do — the session flag above still holds */
  }
}

interface Step {
  /** `data-tour` value of the element to point at. Omitted = centred card. */
  target?: string
  /** View to switch to as the step opens, so the bubble describes what is behind it. */
  view?: View
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    title: 'Welcome to StoreSpace',
    body:
      'A storage planner and stock ledger in one: model your rooms to real dimensions, ' +
      'place the furniture inside them, then track every item that goes in or out. ' +
      'Here is the whole app in a minute.',
  },
  {
    target: 'nav-dashboard',
    view: 'dashboard',
    title: 'Dashboard',
    body:
      'The morning glance: room utilisation, stock status, value by category and the ' +
      'latest movements. Low stock and expiring lots are listed here — click any of ' +
      'them to jump straight to the shelf holding it.',
  },
  {
    target: 'nav-rooms',
    view: 'rooms',
    title: 'Rooms & layout',
    body:
      'The heart of it. Draw rooms to size, then drag shelves, racks, fridges and ' +
      'pallets around the floor in 3D or on the flat plan. Snapping and collision ' +
      'keep the plan buildable, auto-arrange packs everything into tidy rows, and the ' +
      'properties panel on the right edits whatever is selected.',
  },
  {
    target: 'nav-inventory',
    view: 'inventory',
    title: 'Inventory',
    body:
      'Every stock line in one table — SKU, barcode, lot, quantity, cost, expiry. ' +
      'Filter and sort it, edit in place, move stock between containers, or print ' +
      'barcode labels. The locate button pins any line on the floor plan.',
  },
  {
    target: 'nav-movements',
    view: 'movements',
    title: 'Movements',
    body:
      'The audit trail. Receipts, picks, transfers, adjustments, counts and ' +
      'relocations are all recorded with a timestamp and the operator name. Post one ' +
      'by hand when stock moves outside the app.',
  },
  {
    target: 'nav-reports',
    view: 'reports',
    title: 'Reports',
    body:
      'Five ready-made views over the same data: ABC analysis, capacity and space, ' +
      'stock aging, valuation and zone density. Each one exports to CSV or prints.',
  },
  {
    target: 'nav-data',
    view: 'data',
    title: 'Data & settings',
    body:
      'Units, theme, operator name, snapping and clearance live here — along with JSON ' +
      'backups, bulk item import from CSV, and the sample warehouse. Everything is ' +
      "stored in this browser, so a backup is the only copy that leaves it.",
  },
  {
    target: 'nav-search',
    title: 'Search anything',
    body:
      'Ctrl K from any screen finds rooms, objects, SKUs and barcodes, then flies you ' +
      'to the match and flashes it in the layout. A barcode scanner typing into that ' +
      'box works too.',
  },
  {
    target: 'nav-theme',
    title: 'Light or dark',
    body: 'One click swaps the theme. It sticks with the rest of your settings.',
  },
  {
    target: 'nav-feedback',
    title: 'One last thing',
    body:
      'That is the tour. This button sends a note straight to the maintainers — a bug, ' +
      'an idea, or something that made no sense just now. It would help a lot if you ' +
      'told us how this went.',
  },
]

type Side = 'right' | 'left' | 'bottom' | 'top'
interface Spot {
  /** null on the opening card, which is centred and gets no spotlight or tail. */
  rect: DOMRect | null
  top: number
  left: number
  side: Side
  /** Distance of the arrow tip along the bubble edge, in px from its top/left. */
  arrow: number
}

const GAP = 12
const PAD = 10
/** Breathing room between the spotlight ring and the highlighted control. */
const RING = 6

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Pick a side with room for the bubble and pin it against the target.
 *
 * Right first: the rail lives on the left edge, so that is where the space is.
 * A phone in portrait has no room beside a 320 px bubble, and falls through to
 * below the control.
 */
function place(rect: DOMRect, bw: number, bh: number): Omit<Spot, 'rect'> {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  const room: Record<Side, number> = {
    right: vw - rect.right - GAP - PAD,
    left: rect.left - GAP - PAD,
    bottom: vh - rect.bottom - GAP - PAD,
    top: rect.top - GAP - PAD,
  }
  const order: Side[] = ['right', 'bottom', 'left', 'top']
  const side =
    order.find((s) => room[s] >= (s === 'right' || s === 'left' ? bw : bh)) ?? 'bottom'

  if (side === 'right' || side === 'left') {
    const top = clamp(cy - bh / 2, PAD, Math.max(PAD, vh - bh - PAD))
    return {
      side,
      top,
      left: side === 'right' ? rect.right + GAP : rect.left - GAP - bw,
      arrow: clamp(cy - top, 18, Math.max(18, bh - 18)),
    }
  }

  const left = clamp(cx - bw / 2, PAD, Math.max(PAD, vw - bw - PAD))
  return {
    side,
    left,
    top: side === 'bottom' ? rect.bottom + GAP : rect.top - GAP - bh,
    arrow: clamp(cx - left, 18, Math.max(18, bw - 18)),
  }
}

export function Tour({ open, onClose, onFeedback }: {
  open: boolean
  onClose: () => void
  onFeedback: () => void
}) {
  const setView = useStore((s) => s.setView)
  const [i, setI] = useState(0)
  const [spot, setSpot] = useState<Spot | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  /** Where they were before the tour started walking the views around. */
  const entryView = useRef<View | null>(null)

  const step = STEPS[i]
  const last = i === STEPS.length - 1

  /*
   * Reset before paint, not after.
   *
   * `<Tour>` is always mounted, so `i` survives from the previous run, and a
   * plain effect resets it only once the browser has already drawn a frame.
   * Replaying the tour therefore flashed the *last* step — spotlight on the
   * feedback button, "One last thing" — before snapping back to step 1.
   */
  useLayoutEffect(() => {
    if (!open) return
    setI(0)
    entryView.current = useStore.getState().view
    markTourSeen()
  }, [open])

  // Show the screen being talked about behind the bubble.
  useEffect(() => {
    if (open && step?.view) setView(step.view)
  }, [open, step?.view, setView])

  const measure = useCallback(() => {
    if (!open || !step) return
    const bubble = bubbleRef.current
    if (!bubble) return
    const b = bubble.getBoundingClientRect()

    const el = step.target
      ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      : null
    const rect = el?.getBoundingClientRect()

    // No anchor: the opening card, or a step whose control is not in the DOM.
    // Centred in px rather than with `translate(-50%, -50%)`, because `pop-in`
    // ends on `transform: none` and would drop the bubble a full half-width off
    // to the right — off-screen entirely on a phone.
    if (!rect || (!rect.width && !rect.height)) {
      setSpot({
        rect: null,
        side: 'bottom',
        arrow: 0,
        top: Math.max(PAD, (window.innerHeight - b.height) / 2),
        left: Math.max(PAD, (window.innerWidth - b.width) / 2),
      })
      return
    }
    setSpot({ rect, ...place(rect, b.width, b.height) })
  }, [open, step])

  /*
   * Scrolling the anchor into view belongs to the step change, not to
   * `measure`. `measure` is also the capture-phase scroll handler, so doing it
   * there meant any scroll anywhere in the app yanked the rail back into
   * position under the user's fingers.
   */
  useLayoutEffect(() => {
    if (!open || !step?.target) return
    document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, step?.target])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    // The view switch above commits a render after this effect; re-measure once
    // the browser has settled so a reflowed rail cannot leave the bubble adrift.
    const raf = requestAnimationFrame(measure)

    /*
     * Placement depends on the bubble's own size, and on a cold load that size
     * is a lie: the stylesheet arrives after the first paint, so the bubble is
     * briefly an unstyled full-width block. Centring against that put the
     * opening card in the top-left corner. Watching the bubble re-places it the
     * moment it takes its real shape — which also covers a late web font and
     * text that rewraps.
     */
    const ro = new ResizeObserver(measure)
    if (bubbleRef.current) ro.observe(bubbleRef.current)

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  const finish = useCallback((withFeedback: boolean) => {
    // Ending on Data & settings — wherever the last step happened to leave the
    // app — would look like the tour had navigated somewhere and abandoned them.
    if (entryView.current) setView(entryView.current)
    onClose()
    if (withFeedback) onFeedback()
  }, [onClose, onFeedback, setView])

  const next = useCallback(() => {
    if (last) finish(true)
    else setI((n) => Math.min(n + 1, STEPS.length - 1))
  }, [last, finish])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // The command palette is above the tour and closes on Escape from its
      // own input, so without this one press dismissed both.
      if (e.defaultPrevented) return
      if (e.key === 'Escape') { e.preventDefault(); finish(false) }
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setI((n) => Math.max(0, n - 1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, next, finish])

  if (!open || !step) return null

  const anchored = Boolean(spot?.rect)

  return (
    <div className="no-print fixed inset-0 z-[70] fade-in" role="dialog" aria-label="Guided tour">
      {/*
        Blocks clicks on the app: the tour drives the view itself, and a stray
        click behind the bubble would move the ground under it.

        Built from four panels around the spotlight rather than one full-screen
        sheet, so the highlighted control itself stays clickable. Ringing a
        button in bright accent and then eating the click read as a broken
        button — and a keyboard user could already tab to it and press Enter,
        so the blanket block was never a real guarantee. `aria-modal` is gone
        for the same reason: there is no focus trap, and claiming one misleads
        a screen reader.
      */}
      {anchored && spot?.rect ? (
        <>
          <div className="absolute" style={{ top: 0, left: 0, right: 0, height: Math.max(0, spot.rect.top - RING) }} />
          <div className="absolute" style={{ top: spot.rect.bottom + RING, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute" style={{ top: spot.rect.top - RING, left: 0, width: Math.max(0, spot.rect.left - RING), height: spot.rect.height + RING * 2 }} />
          <div className="absolute" style={{ top: spot.rect.top - RING, left: spot.rect.right + RING, right: 0, height: spot.rect.height + RING * 2 }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.5)' }} />
      )}

      {/* The dimming for an anchored step is this box's own shadow, which cuts a
          hole around the control instead of masking it. */}
      {spot?.rect && (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-200"
          style={{
            top: spot.rect.top - RING,
            left: spot.rect.left - RING,
            width: spot.rect.width + RING * 2,
            height: spot.rect.height + RING * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,.5)',
            outline: '2px solid var(--accent)',
            outlineOffset: '-1px',
          }}
        />
      )}

      <div
        ref={bubbleRef}
        className="float pop-in absolute p-3.5"
        style={{
          top: spot?.top ?? 0,
          left: spot?.left ?? 0,
          width: 'min(320px, calc(100vw - 20px))',
          // Hidden only for the first paint of a step, while the bubble is being
          // measured for placement.
          visibility: spot ? 'visible' : 'hidden',
        }}
      >
        {/* Speech-bubble tail: a rotated square with two of its borders showing. */}
        {spot?.rect && (
          <span
            aria-hidden
            className="absolute h-2.5 w-2.5 rotate-45"
            style={{
              background: 'var(--panel)',
              borderTop: spot.side === 'bottom' ? '1px solid var(--line)' : 'none',
              borderLeft: spot.side === 'right' ? '1px solid var(--line)' : 'none',
              borderRight: spot.side === 'left' ? '1px solid var(--line)' : 'none',
              borderBottom: spot.side === 'top' ? '1px solid var(--line)' : 'none',
              ...(spot.side === 'right' ? { left: -6, top: spot.arrow - 5 } : {}),
              ...(spot.side === 'left' ? { right: -6, top: spot.arrow - 5 } : {}),
              ...(spot.side === 'bottom' ? { top: -6, left: spot.arrow - 5 } : {}),
              ...(spot.side === 'top' ? { bottom: -6, left: spot.arrow - 5 } : {}),
            }}
          />
        )}

        <div className="mb-1.5 flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--accent-soft)' }}>
            {last ? <MessageSquarePlus size={13} style={{ color: 'var(--accent)' }} />
              : <Sparkles size={13} style={{ color: 'var(--accent)' }} />}
          </span>
          <h2 className="text-[13.5px] font-semibold">{step.title}</h2>
          <span className="ml-auto shrink-0 text-[10.5px] tabular-nums muted">{i + 1} / {STEPS.length}</span>
        </div>

        <p className="text-[12px] leading-relaxed muted">{step.body}</p>

        {/*
          Wraps, because the last step's "Send feedback" is twice the width of
          "Next" and the ten step dots leave it nothing to sit in — on one line
          it hung 40 px out past the bubble's right edge. The buttons stay in
          their own group so they drop to a second line together rather than
          splitting across the fold.
        */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {STEPS.map((s, n) => (
              <button
                key={s.title}
                aria-label={`Step ${n + 1}: ${s.title}`}
                aria-current={n === i}
                onClick={() => setI(n)}
                className="rounded-full transition-all"
                style={{
                  width: n === i ? 14 : 5,
                  height: 5,
                  background: n <= i ? 'var(--accent)' : 'var(--line-2)',
                }}
              />
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn btn-ghost btn-sm" onClick={() => finish(false)}>
              {last ? 'No thanks' : 'Skip'}
            </button>
            {i > 0 && (
              <button className="btn btn-sm btn-icon" onClick={() => setI(i - 1)} aria-label="Previous">
                <ChevronLeft size={14} />
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={next} autoFocus>
              {last ? <><MessageSquarePlus size={13} /> Send feedback</> : <>Next <ChevronRight size={13} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
