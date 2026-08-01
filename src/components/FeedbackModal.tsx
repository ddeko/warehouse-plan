import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { useStore } from '../store'
import { Field, Modal, SelectField, TextField } from './ui'
import { FEEDBACK_KINDS, MAX_MESSAGE, feedbackConfigured, sendFeedback, type FeedbackKind } from '../lib/feedback'
import { t as tr, trf } from '../lib/i18n'

/** Sends a row to the feedback spreadsheet. Nothing is kept in the app. */
export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useStore((s) => s.notify)
  const operator = useStore((s) => s.settings.operator)

  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A fresh form each time it opens, so a sent note never lingers to be sent twice.
  useEffect(() => {
    if (open) {
      setKind('bug')
      setMessage('')
      setEmail('')
      setError(null)
      setBusy(false)
    }
  }, [open])

  const submit = async () => {
    const body = message.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    try {
      await sendFeedback({ kind, message: body, email })
      notify(tr('Thanks — your feedback was sent'))
      onClose()
    } catch (e) {
      // Kept in the dialog rather than a toast: the typing survives, so a
      // failed send can be retried without writing it all out again.
      setError(tr(e instanceof Error ? e.message : 'Could not reach the feedback service.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={tr("Send feedback")}
      subtitle={tr("Goes straight to the maintainers")}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>{tr("Cancel")}</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !message.trim() || !feedbackConfigured}>
            <Send size={13} /> {busy ? tr('Sending…') : tr('Send feedback')}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        {/* Only ever seen by whoever deployed without the variable set. */}
        {!feedbackConfigured && (
          <p className="rounded-lg border px-3 py-2 text-[12px] leading-relaxed"
            style={{ borderColor: 'color-mix(in srgb, #e0a33f 40%, var(--line))', color: '#e0a33f' }}>
            {tr('No feedback endpoint in this build. Deploy')} <code className="mono">apps-script/feedback.gs</code>{' '}
            {tr('and put its URL in')} <code className="mono">VITE_FEEDBACK_URL</code>{tr(', then rebuild.')}
          </p>
        )}

        <SelectField
          label={tr('What is this about?')}
          value={kind}
          onChange={setKind}
          options={FEEDBACK_KINDS.map((k) => ({ value: k.value, label: tr(k.label) }))}
        />

        <Field
          label={tr('Details')}
          hint={trf('{n} / {max} characters', { n: message.length, max: MAX_MESSAGE })}
        >
          <textarea
            className="textarea w-full"
            rows={6}
            autoFocus
            maxLength={MAX_MESSAGE}
            placeholder={tr("What happened, or what would you like to see? Steps that reproduce a bug are gold.")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit() }}
          />
        </Field>

        <TextField
          label={tr("Email (optional)")}
          value={email}
          onChange={setEmail}
          placeholder={operator ? `${operator.toLowerCase().replace(/\s+/g, '.')}@example.com` : 'you@example.com'}
          hint={tr("Only needed if you want a reply. Your data stays in your browser either way.")}
        />

        {error && (
          <p className="rounded-lg border px-3 py-2 text-[12px] leading-relaxed"
            style={{ borderColor: 'color-mix(in srgb, #e05252 40%, var(--line))', color: '#e05252' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
