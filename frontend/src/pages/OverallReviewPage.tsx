import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageActions, PageSection, PageShell } from '../components/PageShell'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import { getProgram } from '../lib/api'
import { findRegistryEntry, getCurrentProgramId } from '../lib/registry'
import type { Program } from '../lib/types'
import { INDUSTRY_META } from '../types'

export function OverallReviewPage() {
  const [searchParams] = useSearchParams()
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const showLoadingScreen = useDeferredLoading(loading)

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

  if (showLoadingScreen) return <LoadingScreen message="総評を読み込み中" />
  if (loading) return null
  if (error || !program)
    return (
      <PageShell
        title={error ?? 'データがありません'}
        illustration="/images/!-bear.svg"
      >
        <PageActions>
          <Link to="/" className="btn primary">
            ホームに戻る
          </Link>
        </PageActions>
      </PageShell>
    )

  const entry = findRegistryEntry(program.id)
  const meta = entry ? INDUSTRY_META[entry.industry] : null
  const trueChallenge = program.customer_profile?.true_challenge
  const overallReviews = program.overall_reviews ?? []

  const subtitle = meta
    ? `${meta.company} の ${meta.personName} ${meta.honorific} との商談シリーズ（全 ${program.total_sessions} 回）が完了しました`
    : `${program.field} の商談シリーズ（全 ${program.total_sessions} 回）が完了しました`

  return (
    <PageShell
      width="wide"
      title="商談シリーズ完了・総評"
      subtitle={subtitle}
      illustration="/images/LevelUp.svg"
    >
      <PageSection variant="blue">
        <p className="page-section__label">顧客の「真の課題」</p>
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
      </PageSection>

      <PageSection>
        <h3 className="page-section__heading">先輩によるシリーズ総評</h3>
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
      </PageSection>

      {program.customer_state?.session_summaries &&
        program.customer_state.session_summaries.length > 0 && (
          <PageSection variant="paper">
            <h3 className="page-section__heading">各回サマリ</h3>
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
          </PageSection>
        )}

      <PageActions>
        <Link to="/evaluations" className="btn secondary btn--shrink">
          評価履歴へ戻る
        </Link>
        <Link to="/" className="btn primary btn--shrink">
          トップに戻る
        </Link>
      </PageActions>
    </PageShell>
  )
}
