import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage wrapper for the persisted store.
 *
 * Zustand's default `createJSONStorage` calls `JSON.parse` with no try/catch
 * and its hydrate chain swallows the rejection, so a corrupt or truncated blob
 * produced a silent empty app. That alone is survivable — the data is still on
 * disk — but the persist middleware writes after *every* `set`, so the first
 * click (or the mount effect that opens the tour) overwrote the only copy the
 * user had with an empty store.
 *
 * So reads never throw, and a failed read latches `blocked`, which makes
 * writes no-ops. Whatever was on disk stays there until the user decides.
 */

export const STORAGE_KEY = 'storespace.v1'

type Failure = 'unreadable' | 'quota'

let blocked = false
let failure: Failure | null = null
const listeners = new Set<(f: Failure) => void>()

function fail(kind: Failure) {
  failure = kind
  if (kind === 'unreadable') blocked = true
  listeners.forEach((l) => l(kind))
}

/** Subscribe to storage trouble; fires immediately if it already happened. */
export function onStorageFailure(fn: (f: Failure) => void) {
  listeners.add(fn)
  if (failure) fn(failure)
  return () => listeners.delete(fn)
}

export const storageFailure = () => failure

/** The bytes as they sit on disk, so a rescue export can offer them untouched. */
export function rawPersisted(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export const guardedStorage: StateStorage = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name)
      if (raw === null) return null
      // Parsed here purely to find out whether it *can* be parsed — zustand
      // parses it again itself. Cheap next to losing the file.
      JSON.parse(raw)
      return raw
    } catch {
      fail('unreadable')
      return null
    }
  },

  setItem: (name, value) => {
    if (blocked) return
    try {
      localStorage.setItem(name, value)
    } catch {
      // Out of quota, or storage disabled entirely (Safari private mode). The
      // in-memory state has already moved on, so the app keeps working; the
      // user needs to know it will not survive a reload.
      fail('quota')
    }
  },

  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* Nothing useful to do. */
    }
  },
}

/** Re-enable writes after the user has dealt with an unreadable blob. */
export function unblockStorage() {
  blocked = false
  failure = null
}
