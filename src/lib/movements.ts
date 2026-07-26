import type { Container, Movement, Room } from '../types'

/**
 * Human-readable location for an audit-trail row.
 *
 * Movement kinds carry different location information, so a single
 * "from → to" template misreports most of them: a receipt has no origin, a
 * pick has no destination, and repositioning an object on the plan has neither
 * — it happens inside one room. Rendering "—" for the missing half reads as
 * data loss, so each shape gets its own form.
 */
export function describeLocation(
  m: Movement,
  containers: Map<string, Container>,
  rooms: Map<string, Room>,
): string {
  const code = (id?: string) => (id ? containers.get(id)?.code : undefined)
  const from = code(m.fromContainerId)
  const to = code(m.toContainerId)

  if (m.type === 'relocate') {
    const roomId = m.roomId ?? (m.toContainerId ? containers.get(m.toContainerId)?.roomId : undefined)
    const room = roomId ? rooms.get(roomId) : undefined
    return [to, room?.code].filter(Boolean).join(' in ') || '—'
  }

  // These happen at a place rather than between two, so an arrow would imply a
  // journey that never took place.
  if (m.type === 'adjust' || m.type === 'count') return to ?? from ?? '—'

  if (from && to) return `${from} → ${to}`
  if (to) return `→ ${to}`
  if (from) return `${from} →`
  return '—'
}
