import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageSection, PageShell } from '../components/PageShell'
import { Button } from '../components/ui/Button'
import { InputField, TextAreaField } from '../components/ui/Form'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import { getReviewPage, submitSessionEvaluation } from '../lib/api'
import type { ReviewPageData } from '../lib/types'

export function ReviewerEvaluationPage() {
  const { token } = useParams<{ token: string }>()
  const [page, setPage] = useState<ReviewPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const showLoadingScreen = useDeferredLoading(loading)
  const [evaluatorId, setEvaluatorId] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    getReviewPage(token)
      .then(setPage)
      .catch(() => setError('評価ページの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [token])

  const refreshPage = () => {
    if (!token) return
    getReviewPage(token)
      .then(setPage)
      .catch(() => setError('評価ページの取得に失敗しました'))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !evaluatorId.trim() || !content.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)
    try {
      await submitSessionEvaluation(token, {
        evaluator_id: evaluatorId.trim(),
        content: content.trim(),
      })
      setSubmitSuccess(true)
      setContent('')
      refreshPage()
    } catch {
      setSubmitError('評価の送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (showLoadingScreen)
    return <LoadingScreen message="評価ページを読み込み中" />
  if (loading) return null
  if (error || !page)
    return (
      <PageShell
        title={error ?? 'ページが見つかりません'}
        illustration="/images/!-bear.svg"
      />
    )

  return (
    <PageShell
      width="wide"
      title={`先輩評価入力（第 ${page.session_number} 回）`}
      subtitle={`${page.program_field} — 目標: ${page.goal}`}
      illustration="/images/bear.svg"
      brandLink={false}
    >
      <PageSection variant="blue">
        <p className="page-section__label">真の課題（先輩のみ表示）</p>
        <p className="review-block__body">
          {page.true_challenge || '（未設定）'}
        </p>
      </PageSection>

      {page.recording_url && (
        <PageSection variant="paper">
          <p className="page-section__label">録音</p>
          <audio controls src={page.recording_url} style={{ width: '100%' }} />
        </PageSection>
      )}

      <PageSection variant="paper">
        <p className="page-section__label">文字起こし</p>
        <div className="chat-log" style={{ maxHeight: 320 }}>
          <p className="review-block__body" style={{ whiteSpace: 'pre-wrap' }}>
            {page.formatted_transcript || '（文字起こしなし）'}
          </p>
        </div>
      </PageSection>

      {page.evaluations.length > 0 && (
        <PageSection variant="oat">
          <h3 className="page-section__heading">提出済みの評価</h3>
          {page.evaluations.map((ev) => (
            <div key={ev.id} className="review-block">
              <p className="review-block__author">{ev.evaluator_id}</p>
              <p className="review-block__body">{ev.content}</p>
            </div>
          ))}
        </PageSection>
      )}

      <PageSection variant="paper">
        <form onSubmit={handleSubmit} className="form-stack">
          <h3 className="page-section__heading">評価を入力</h3>
          <InputField
            label="あなたの名前"
            type="text"
            value={evaluatorId}
            onChange={(e) => setEvaluatorId(e.target.value)}
            placeholder="例: 田中先輩"
            maxLength={128}
            required
          />
          <TextAreaField
            label="評価内容"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="この回のロープレについてフィードバックを記入してください"
            required
            rows={6}
          />
          {submitError && (
            <div className="alert-banner alert-banner--error" role="alert">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="alert-banner alert-banner--info" role="status">
              評価を送信しました
            </div>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? '送信中…' : '評価を送信'}
          </Button>
        </form>
      </PageSection>
    </PageShell>
  )
}
