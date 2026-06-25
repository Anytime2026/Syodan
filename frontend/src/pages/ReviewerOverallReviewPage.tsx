import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageSection, PageShell } from '../components/PageShell'
import { Button } from '../components/ui/Button'
import { InputField, TextAreaField } from '../components/ui/Form'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import { getOverallReviewPage, submitOverallReview } from '../lib/api'
import type { OverallReviewPageData } from '../lib/types'

export function ReviewerOverallReviewPage() {
  const { token } = useParams<{ token: string }>()
  const [page, setPage] = useState<OverallReviewPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const showLoadingScreen = useDeferredLoading(loading)
  const [evaluatorId, setEvaluatorId] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(
    new Set(),
  )

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    getOverallReviewPage(token)
      .then(setPage)
      .catch(() => setError('総評ページの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [token])

  const refreshPage = () => {
    if (!token) return
    getOverallReviewPage(token)
      .then(setPage)
      .catch(() => setError('総評ページの取得に失敗しました'))
  }

  const toggleSession = (num: number) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !evaluatorId.trim() || !content.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)
    try {
      await submitOverallReview(token, {
        evaluator_id: evaluatorId.trim(),
        content: content.trim(),
      })
      setSubmitSuccess(true)
      setContent('')
      refreshPage()
    } catch {
      setSubmitError('総評の送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (showLoadingScreen)
    return <LoadingScreen message="総評ページを読み込み中" />
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
      title="先輩総評入力"
      subtitle={`${page.program_field} — 全 ${page.total_sessions} 回完了`}
      illustration="/images/LevelUp.svg"
      brandLink={false}
    >
      <PageSection variant="blue">
        <p className="page-section__label">真の課題（先輩のみ表示）</p>
        <p className="review-block__body">
          {page.true_challenge || '（未設定）'}
        </p>
      </PageSection>

      {page.session_summaries.length > 0 && (
        <PageSection variant="oat">
          <h3 className="page-section__heading">各回サマリ</h3>
          <ul className="summary-list">
            {page.session_summaries.map((s) => (
              <li key={s.session_number}>
                <strong>第 {s.session_number} 回:</strong> {s.summary}
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      <PageSection variant="paper">
        <h3 className="page-section__heading">各回の記録</h3>
        <div className="disclosure-list">
          {page.sessions.map((s) => {
            const expanded = expandedSessions.has(s.session_number)
            return (
              <div key={s.session_number} className="disclosure">
                <button
                  type="button"
                  className="disclosure__trigger"
                  onClick={() => toggleSession(s.session_number)}
                  aria-expanded={expanded}
                >
                  <span>
                    第 {s.session_number} 回: {s.title ?? s.goal}
                  </span>
                  <span className="disclosure__chevron">
                    {expanded ? '閉じる' : '開く'}
                  </span>
                </button>
                {expanded && (
                  <div className="disclosure__panel">
                    <p style={{ margin: '0 0 8px' }}>
                      <strong>目標:</strong> {s.goal}
                    </p>
                    {s.formatted_transcript ?? '（文字起こしなし）'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </PageSection>

      {page.overall_reviews.length > 0 && (
        <PageSection variant="oat">
          <h3 className="page-section__heading">提出済みの総評</h3>
          {page.overall_reviews.map((review) => (
            <div key={review.id} className="review-block">
              <p className="review-block__author">{review.evaluator_id}</p>
              <p className="review-block__body">{review.content}</p>
            </div>
          ))}
        </PageSection>
      )}

      <PageSection variant="paper">
        <form onSubmit={handleSubmit} className="form-stack">
          <h3 className="page-section__heading">総評を入力</h3>
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
            label="総評"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="シリーズ全体を通じたフィードバックを記入してください"
            required
            rows={8}
          />
          {submitError && (
            <div className="alert-banner alert-banner--error" role="alert">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="alert-banner alert-banner--info" role="status">
              総評を送信しました
            </div>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? '送信中…' : '総評を送信'}
          </Button>
        </form>
      </PageSection>
    </PageShell>
  )
}
