import { useState } from 'react'
import { PageSection, PageShell } from '../components/PageShell'
import { Button } from '../components/ui/Button'
import { TextAreaField } from '../components/ui/Form'
import { submitFeedback } from '../lib/api'

export function FeedbackPage() {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)
    try {
      await submitFeedback(message.trim())
      setSubmitSuccess(true)
      setMessage('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell
      width="narrow"
      title="フィードバック"
      subtitle="ご意見・ご要望をお聞かせください"
    >
      <PageSection variant="paper">
        <form onSubmit={handleSubmit} className="form-stack">
          <TextAreaField
            label=""
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="使い心地や改善してほしい点など、自由にご記入ください"
            required
            rows={6}
            maxLength={4000}
          />
          {submitError && (
            <div className="alert-banner alert-banner--error" role="alert">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="alert-banner alert-banner--info" role="status">
              フィードバックを送信しました
            </div>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? '送信中…' : '送信'}
          </Button>
        </form>
      </PageSection>
    </PageShell>
  )
}
