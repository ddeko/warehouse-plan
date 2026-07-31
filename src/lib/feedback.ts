/**
 * Feedback delivery.
 *
 * There is no backend here — the app is a static bundle on a CDN — so the
 * sheet is written by a Google Apps Script web app that owns the credentials.
 * The URL of that deployment is the only thing the client needs, and it is
 * write-only: posting to it appends a row and returns nothing readable about
 * the sheet's contents.
 *
 * See `apps-script/feedback.gs` for the endpoint and how to deploy it.
 */

const ENDPOINT = import.meta.env.VITE_FEEDBACK_URL as string | undefined

/**
 * False when no endpoint was baked into this build.
 *
 * The button stays visible either way. Hiding it was the first cut, and it
 * turned a missing environment variable into a feature that simply was not
 * there — nothing to notice, nothing to debug. A form that says why it cannot
 * send is the louder failure, and the only person who ever sees that message
 * is whoever forgot to set the variable.
 */
export const feedbackConfigured = Boolean(ENDPOINT)

export type FeedbackKind = 'bug' | 'idea' | 'question' | 'other'

export const FEEDBACK_KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'idea', label: 'Idea or request' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Something else' },
]

/** Hard cap mirrored server-side; a runaway paste should fail here, not there. */
export const MAX_MESSAGE = 4000

/**
 * A dead endpoint, an offline laptop and a blocked request all surface as the
 * same bare `TypeError: Failed to fetch`, which is no help to whoever is
 * staring at the dialog. Trade it for something they can act on.
 */
async function postOrThrow(url: string, init: RequestInit) {
  try {
    return await fetch(url, init)
  } catch {
    throw new Error('Could not reach the feedback service. Check your connection and try again.')
  }
}

export async function sendFeedback(draft: { kind: FeedbackKind; message: string; email: string }) {
  if (!ENDPOINT) throw new Error('Feedback is not configured for this build.')

  const res = await postOrThrow(ENDPOINT, {
    method: 'POST',
    /*
     * text/plain keeps this a CORS "simple request". An application/json body
     * triggers a preflight, and Apps Script web apps do not answer OPTIONS —
     * the browser would block the post before it was ever sent. The script
     * parses the body as JSON regardless of what this header claims.
     */
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      kind: draft.kind,
      message: draft.message.slice(0, MAX_MESSAGE),
      email: draft.email.trim(),
      // Context worth more than it costs: which deployment, and what they were
      // looking at. Nothing here identifies a person beyond the email they
      // chose to type.
      page: `${location.host}${location.pathname}`,
      userAgent: navigator.userAgent,
    }),
  })

  if (!res.ok) throw new Error(`The sheet turned the row away (HTTP ${res.status}).`)

  // A deployment that is misconfigured rather than unreachable still answers
  // 200, so the verdict is in the body.
  const body = await res.json().catch(() => null)
  if (body && body.ok === false) throw new Error(String(body.error ?? 'The sheet rejected the row.'))
}
