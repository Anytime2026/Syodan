import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageActions, PageSection, PageShell } from '../components/PageShell'
import { Button } from '../components/ui/Button'
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
          <Button to="/">ホームに戻る</Button>
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
          <p className="review-block__body">{trueChallenge}</p>
        ) : (
          <p className="small" style={{ margin: 0 }}>
            全回完了後、先輩総評が完了すると真の課題が開示されます。
          </p>
        )}
      </PageSection>

      <PageSection variant="paper">
        <h3 className="page-section__heading">先輩によるシリーズ総評</h3>
        {overallReviews.length > 0 ? (
          overallReviews.map((review) => (
            <div key={review.id} className="review-block">
              <p className="review-block__author">{review.evaluator_id}</p>
              <p className="review-block__body">
                {review.content || '（評価内容なし）'}
              </p>
            </div>
          ))
        ) : (
          <p className="small" style={{ margin: 0 }}>
            先輩総評はまだ届いていません。HULFT
            経由で反映されるまでお待ちください。
          </p>
        )}
      </PageSection>

      {program.customer_state?.session_summaries &&
        program.customer_state.session_summaries.length > 0 && (
          <PageSection variant="oat">
            <h3 className="page-section__heading">各回サマリ</h3>
            <ul className="summary-list">
              {program.customer_state.session_summaries.map((s) => (
                <li key={s.session_number}>
                  <strong>第 {s.session_number} 回:</strong> {s.summary}
                </li>
              ))}
            </ul>
          </PageSection>
        )}

      <PageActions>
        <Button variant="gray" className="btn--shrink" to="/evaluations">
          評価履歴へ戻る
        </Button>
        <Button className="btn--shrink" to="/">
          トップに戻る
        </Button>
      </PageActions>
    </PageShell>
  )
}
