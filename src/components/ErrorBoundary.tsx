import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t as tr } from '../lib/i18n'

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

    /*
     * A chunk that failed to download is not a data problem.
     *
     * The 3D scene is lazy-loaded, so a dropped connection, a redeploy that
     * replaced the hashed filenames, or a dev server going away mid-session all
     * surface here as a render error. Offering "clear data and restart" as the
     * loud red button for that would invite someone to wipe their only copy of
     * a warehouse over a network blip. Reloading is the actual fix, so it is
     * the only thing offered.
     */
    const isChunkError = /dynamically imported module|Loading chunk|Importing a module script failed|Failed to fetch/i
      .test(error.message)

    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="card w-full max-w-md p-5">
          <h1 className="text-sm font-semibold">
            {isChunkError ? tr('Could not finish loading') : tr('StoreSpace hit an error')}
          </h1>
          <p className="mt-1.5 text-[12.5px] muted leading-relaxed">
            {isChunkError
              ? tr('Part of the app failed to download — usually a dropped connection or an update landing mid-session. Your data is untouched. Reloading should fix it.')
              : tr('Something in the stored data made the app stop rendering. Save a copy before clearing — the backup can be edited by hand and imported again.')}
          </p>
          <pre className="mono mt-3 max-h-32 overflow-auto rounded-lg border hairline p-2 text-[11px] panel-2">
            {error.message}
          </pre>
          {isChunkError ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button className="btn btn-primary" onClick={() => location.reload()}>{tr('Reload')}</button>
              <button className="btn" onClick={this.saveBackup}>{tr('Download a copy of the data')}</button>
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button className="btn" onClick={this.saveBackup}>{tr('Download a copy of the data')}</button>
                <button className="btn btn-danger" onClick={this.clearAndReload}>{tr('Clear data and restart')}</button>
              </div>
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => location.reload()}>{tr('Just reload')}</button>
            </>
          )}
        </div>
      </div>
    )
  }
}
