import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Last line of defence around the whole app.
 *
 * A throw during render unmounts the entire React tree, and because both the
 * data and the current view are persisted, a reload lands on the same view and
 * throws again — a blank page with no way back to the reset button. This turns
 * that dead end into a screen that still offers the two things that recover
 * it: download a backup, or clear the stored data.
 *
 * Deliberately a class: `componentDidCatch` has no hook equivalent.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('StoreSpace crashed:', error, info.componentStack)
  }

  /** Hand back whatever is in storage, so a crash is never a forced data loss. */
  private saveBackup = () => {
    try {
      const raw = localStorage.getItem('storespace.v1')
      if (!raw) return
      const state = JSON.parse(raw)?.state ?? {}
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `storespace-rescue-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      /* If even this fails there is nothing left to offer. */
    }
  }

  private clearAndReload = () => {
    try {
      localStorage.removeItem('storespace.v1')
    } finally {
      location.reload()
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="card w-full max-w-md p-5">
          <h1 className="text-sm font-semibold">StoreSpace hit an error</h1>
          <p className="mt-1.5 text-[12.5px] muted leading-relaxed">
            Something in the stored data made the app stop rendering. Save a copy before clearing —
            the backup can be edited by hand and imported again.
          </p>
          <pre className="mono mt-3 max-h-32 overflow-auto rounded-lg border hairline p-2 text-[11px] panel-2">
            {error.message}
          </pre>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button className="btn" onClick={this.saveBackup}>Download a copy of the data</button>
            <button className="btn btn-danger" onClick={this.clearAndReload}>Clear data and restart</button>
          </div>
          <button className="btn btn-ghost btn-sm mt-2" onClick={() => location.reload()}>
            Just reload
          </button>
        </div>
      </div>
    )
  }
}
