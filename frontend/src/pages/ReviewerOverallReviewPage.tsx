import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getOverallReviewPage, submitOverallReview } from '../lib/api'
import type { OverallReviewPageData } from '../lib/types'

export function ReviewerOverallReviewPage() {
  const { token } = useParams<{ token: string }>()
  const [page, setPage] = useState<OverallReviewPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evaluatorId, setEvaluatorId] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set())

  const loadPage = () => {
    if (!token) return
    setLoading(true)
    getOverallReviewPage(token)
      .then(setPage)
      .catch(() => setError('総評ページの取得に失敗しました'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPage()
  }, [token])

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
      loadPage()
    } catch {
      setSubmitError('総評の送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="card">読み込み中…</div>
  if (error || !page)
    return <div className="card">{error ?? 'ページが見つかりません'}</div>

  return (
    <div className="card wide" style={{ maxWidth: '800px', margin: '24px auto' }}>
      <h2>先輩総評入力</h2>
      <p className="small" style={{ marginBottom: 20 }}>
        {page.program_field} — 全 {page.total_sessions} 回完了
      </p>

      <div
        style={{
          background: 'var(--color-kofi-blue)',
          padding: 16,
          borderRadius: '16px',
          border: '2px solid var(--color-sticker-black)',
          marginBottom: 20,
        }}
      >
        <p style={{ margin: '0 0 6px', fontWeight: 'bold', fontSize: '14px' }}>
          真の課題（先輩のみ表示）
        </p>
        <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {page.true_challenge || '（未設定）'}
        </p>
      </div>

      {page.session_summaries.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>各回サマリ</h3>
          {page.session_summaries.map((s) => (
            <div
              key={s.session_number}
              style={{
                background: 'var(--color-oat-cream)',
                padding: 12,
                borderRadius: '12px',
                border: '2px solid var(--color-sticker-black)',
                marginBottom: 8,
              }}
            >
              <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '13px' }}>
                第 {s.session_number} 回
              </p>
              <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5 }}>{s.summary}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>各回の記録</h3>
        {page.sessions.map((s) => (
          <div
            key={s.session_number}
            style={{
              border: '2px solid var(--color-sticker-black)',
              borderRadius: '12px',
              marginBottom: 8,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => toggleSession(s.session_number)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                background: 'var(--color-morning-fog)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13.5px',
              }}
            >
              第 {s.session_number} 回: {s.title ?? s.goal}{' '}
              {expandedSessions.has(s.session_number) ? '▲' : '▼'}
            </button>
            {expandedSessions.has(s.session_number) && (
              <div style={{ padding: 14, fontSize: '13.5px', whiteSpace: 'pre-wrap' }}>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>目標:</strong> {s.goal}
                </p>
                {s.formatted_transcript ?? '（文字起こしなし）'}
              </div>
            )}
          </div>
        ))}
      </div>

      {page.overall_reviews.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>提出済みの総評</h3>
          {page.overall_reviews.map((review) => (
            <div
              key={review.id}
              style={{
                background: 'var(--color-oat-cream)',
                padding: 14,
                borderRadius: '12px',
                border: '2px solid var(--color-sticker-black)',
                marginBottom: 10,
              }}
            >
              <p style={{ margin: '0 0 6px', fontWeight: 'bold', fontSize: '13px' }}>
                {review.evaluator_id}
              </p>
              <p style={{ margin: 0, fontSize: '13.5px', whiteSpace: 'pre-wrap' }}>
                {review.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <h3 style={{ marginTop: 0 }}>総評を入力</h3>
        <label className="small" style={{ display: 'block', marginBottom: 6 }}>
          あなたの名前
        </label>
        <input
          type="text"
          value={evaluatorId}
          onChange={(e) => setEvaluatorId(e.target.value)}
          placeholder="例: 田中先輩"
          maxLength={128}
          required
          style={{
            width: '100%',
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: '12px',
            border: '2px solid var(--color-sticker-black)',
          }}
        />
        <label className="small" style={{ display: 'block', marginBottom: 6 }}>
          総評
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="シリーズ全体を通じたフィードバックを記入してください"
          required
          rows={8}
          style={{
            width: '100%',
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: '12px',
            border: '2px solid var(--color-sticker-black)',
            resize: 'vertical',
          }}
        />
        {submitError && (
          <p style={{ color: 'crimson', margin: '0 0 12px', fontSize: '13px' }}>{submitError}</p>
        )}
        {submitSuccess && (
          <p style={{ color: 'green', margin: '0 0 12px', fontSize: '13px' }}>
            総評を送信しました
          </p>
        )}
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? '送信中…' : '総評を送信'}
        </button>
      </form>
    </div>
  )
}
