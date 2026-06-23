import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getProgram } from '../lib/api'
import { findRegistryEntry, getCurrentProgramId } from '../lib/registry'
import type { Program } from '../lib/types'
import { INDUSTRY_META } from '../types'

export function OverallReviewPage() {
  const [searchParams] = useSearchParams()
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const programId = searchParams.get('program_id') ?? getCurrentProgramId()
    if (!programId) {
      setLoading(false)
      setError('プログラムが指定されていません')
      return
    }

    getProgram(programId)
      .then(setProgram)
      .catch(() => setError('プログラムの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [searchParams])

  if (loading) return <div className="card">読み込み中…</div>
  if (error || !program)
    return <div className="card">{error ?? 'データがありません'}</div>

  const entry = findRegistryEntry(program.id)
  const meta = entry ? INDUSTRY_META[entry.industry] : null
  const trueChallenge = program.customer_profile?.true_challenge
  const overallReviews = program.overall_reviews ?? []

  return (
    <div className="card wide" style={{ maxWidth: '800px' }}>
      <h2>商談シリーズ完了・総評</h2>
      <p className="small">
        {meta
          ? `${meta.company} の ${meta.personName} ${meta.honorific} との商談シリーズ（全 ${program.total_sessions} 回）`
          : `${program.field} の商談シリーズ（全 ${program.total_sessions} 回）`}
        が完了しました
      </p>

      <div
        style={{
          background: 'var(--color-kofi-blue)',
          padding: 20,
          borderRadius: '24px',
          margin: '20px 0',
          border: '2px solid var(--color-sticker-black)',
        }}
      >
        <p
          style={{
            fontWeight: 'bold',
            margin: '0 0 10px 0',
            color: 'var(--color-ink-black)',
            fontSize: '15px',
          }}
        >
          🔑 顧客の「真の課題」
        </p>
        {program.reveal_challenge && trueChallenge ? (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: '1.6',
              color: 'var(--color-ink-black)',
            }}
          >
            {trueChallenge}
          </p>
        ) : (
          <p
            className="small"
            style={{ margin: 0, color: 'var(--color-ink-black)' }}
          >
            全回完了後、先輩総評が完了すると真の課題が開示されます。
          </p>
        )}
      </div>

      <div
        style={{
          background: 'var(--color-oat-cream)',
          padding: 20,
          borderRadius: '24px',
          border: '2px solid var(--color-sticker-black)',
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            marginTop: 0,
            borderBottom: '2px solid var(--color-sticker-black)',
            paddingBottom: '8px',
            color: 'var(--color-ink-black)',
          }}
        >
          📝 先輩によるシリーズ総評
        </h3>
        {overallReviews.length > 0 ? (
          overallReviews.map((review) => (
            <div
              key={review.id}
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--color-ink-black)',
                whiteSpace: 'pre-wrap',
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: '1px solid var(--color-sticker-black)',
              }}
            >
              <p
                className="small"
                style={{
                  fontWeight: 'bold',
                  color: 'var(--color-ink-black)',
                  margin: '0 0 8px',
                }}
              >
                {review.evaluator_id}
              </p>
              {review.content || '（評価内容なし）'}
            </div>
          ))
        ) : (
          <p
            className="small"
            style={{ margin: 0, color: 'var(--color-ink-black)' }}
          >
            先輩総評はまだ届いていません。HULFT
            経由で反映されるまでお待ちください。
          </p>
        )}
      </div>

      {program.customer_state?.session_summaries &&
        program.customer_state.session_summaries.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3
              style={{
                borderBottom: '2px solid var(--color-sticker-black)',
                paddingBottom: 8,
                color: 'var(--color-ink-black)',
              }}
            >
              各回サマリ
            </h3>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {program.customer_state.session_summaries.map((s) => (
                <li
                  key={s.session_number}
                  style={{ marginBottom: 10, fontSize: 13.5, lineHeight: 1.5 }}
                >
                  <b>第 {s.session_number} 回:</b> {s.summary}
                </li>
              ))}
            </ul>
          </div>
        )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <Link
          to="/evaluations"
          className="btn secondary"
          style={{ flex: 1, margin: 0 }}
        >
          評価履歴へ戻る
        </Link>
        <Link to="/" className="btn primary" style={{ flex: 1, margin: 0 }}>
          🏠 トップに戻る
        </Link>
      </div>
    </div>
  )
}
