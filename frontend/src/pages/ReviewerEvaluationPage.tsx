import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getReviewPage, submitSessionEvaluation } from '../lib/api'
import type { ReviewPageData } from '../lib/types'

export function ReviewerEvaluationPage() {
  const { token } = useParams<{ token: string }>()
  const [page, setPage] = useState<ReviewPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  if (loading) return <div className="card">読み込み中…</div>
  if (error || !page)
    return <div className="card">{error ?? 'ページが見つかりません'}</div>

  return (
    <div
      className="card wide"
      style={{ maxWidth: '800px', margin: '24px auto' }}
    >
      <h2>先輩評価入力（第 {page.session_number} 回）</h2>
      <p className="small" style={{ marginBottom: 20 }}>
        {page.program_field} — 目標: {page.goal}
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
        <p
          style={{
            margin: 0,
            fontSize: '13.5px',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {page.true_challenge || '（未設定）'}
        </p>
      </div>

      {page.recording_url && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 'bold', marginBottom: 8 }}>録音</p>
          <audio controls src={page.recording_url} style={{ width: '100%' }} />
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <p style={{ fontWeight: 'bold', marginBottom: 8 }}>文字起こし</p>
        <div
          style={{
            background: 'var(--color-morning-fog)',
            padding: 15,
            borderRadius: '16px',
            border: '2px solid var(--color-sticker-black)',
            maxHeight: '320px',
            overflowY: 'auto',
            fontSize: '13.5px',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {page.formatted_transcript || '（文字起こしなし）'}
        </div>
      </div>

      {page.evaluations.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>提出済みの評価</h3>
          {page.evaluations.map((ev) => (
            <div
              key={ev.id}
              style={{
                background: 'var(--color-oat-cream)',
                padding: 14,
                borderRadius: '12px',
                border: '2px solid var(--color-sticker-black)',
                marginBottom: 10,
              }}
            >
              <p
                style={{
                  margin: '0 0 6px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                }}
              >
                {ev.evaluator_id}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '13.5px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {ev.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <h3 style={{ marginTop: 0 }}>評価を入力</h3>
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
          評価内容
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="この回のロープレについてフィードバックを記入してください"
          required
          rows={6}
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
          <p style={{ color: 'crimson', margin: '0 0 12px', fontSize: '13px' }}>
            {submitError}
          </p>
        )}
        {submitSuccess && (
          <p style={{ color: 'green', margin: '0 0 12px', fontSize: '13px' }}>
            評価を送信しました
          </p>
        )}
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? '送信中…' : '評価を送信'}
        </button>
      </form>
    </div>
  )
}
