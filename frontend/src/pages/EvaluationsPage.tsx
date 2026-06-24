import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageActions, PageEmpty, PageShell } from '../components/PageShell'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import { EVALUABLE_SESSION_STATUSES, getProgram } from '../lib/api'
import { loadRegistry } from '../lib/registry'
import { INDUSTRY_META } from '../types'

type EvaluationListItem =
  | {
      type: 'session'
      id: string
      programId: string
      industry: keyof typeof INDUSTRY_META
      sessionNumber: number
      title: string | null
      createdAt: string
    }
  | {
      type: 'overall'
      id: string
      programId: string
      industry: keyof typeof INDUSTRY_META
      createdAt: string
      totalSessions: number
    }

export function EvaluationsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<EvaluationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const showLoadingScreen = useDeferredLoading(loading)

  useEffect(() => {
    const registry = loadRegistry()
    if (registry.length === 0) {
      setLoading(false)
      return
    }

    Promise.all(
      registry.map(async (entry) => {
        try {
          const program = await getProgram(entry.id)
          return { entry, program }
        } catch {
          return null
        }
      }),
    ).then((pairs) => {
      const results: EvaluationListItem[] = []

      for (const pair of pairs) {
        if (!pair) continue
        const { entry, program } = pair

        for (const session of program.sessions ?? []) {
          if (!EVALUABLE_SESSION_STATUSES.has(session.status)) continue
          results.push({
            type: 'session',
            id: session.id,
            programId: program.id,
            industry: entry.industry,
            sessionNumber: session.session_number,
            title: session.title,
            createdAt:
              session.ended_at ?? session.started_at ?? program.created_at,
          })
        }

        if (
          program.status === 'closed' ||
          program.status === 'overall_review_requested' ||
          program.status === 'all_sessions_done'
        ) {
          results.push({
            type: 'overall',
            id: program.id,
            programId: program.id,
            industry: entry.industry,
            createdAt: program.created_at,
            totalSessions: program.total_sessions,
          })
        }
      }

      results.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      setItems(results)
      setLoading(false)
    })
  }, [])

  const formatDate = (isoString: string) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <PageShell
      width="wide"
      title="商談評価履歴"
      subtitle="これまでの個別セッションおよびシリーズ総評一覧"
      illustration="/images/Search-bear-closeMouce.svg"
    >
      {showLoadingScreen && (
        <LoadingScreen variant="inline" showLogo={false} message="読み込み中" />
      )}

      {!loading && items.length === 0 && (
        <PageEmpty
          image="/images/Search-bear-closeMouce.svg"
          title="完了したセッションや商談はまだありません"
          description="商談を完了すると、ここに評価履歴が表示されます"
        />
      )}

      {!loading && items.length > 0 && (
        <div className="page-list">
          {items.map((res) => {
            const industryLabel =
              INDUSTRY_META[res.industry]?.label ?? '不明な業界'
            const isOverall = res.type === 'overall'
            const sessionText =
              res.type === 'session'
                ? (res.title ?? `第${res.sessionNumber}回商談`)
                : ''

            return (
              <Link
                key={`${res.type}-${res.id}`}
                to={
                  isOverall
                    ? `/overall-review?program_id=${res.programId}`
                    : `/evaluations/${res.id}`
                }
                className={`page-list__item ${isOverall ? 'page-list__item--oat' : 'page-list__item--paper'}`}
              >
                <div className="page-list__item-row">
                  <p className="page-list__item-title">
                    {isOverall
                      ? `${industryLabel} - 商談シリーズ完了 (総評)`
                      : `${industryLabel} - ${sessionText}`}
                  </p>
                  {isOverall && (
                    <span className="page-badge">シリーズ完了</span>
                  )}
                </div>

                <div className="page-list__item-row" style={{ marginTop: 8 }}>
                  <p className="page-list__item-meta">
                    {isOverall
                      ? `全${res.totalSessions}回のアプローチ評価`
                      : `実施日: ${formatDate(res.createdAt)}`}
                  </p>
                  <p
                    className="page-list__item-meta"
                    style={{ fontWeight: 700, opacity: 1 }}
                  >
                    {isOverall ? '全体総評を見る ＞' : '詳細評価 ＞'}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <PageActions>
        <button className="btn secondary" onClick={() => navigate('/')}>
          ホームに戻る
        </button>
      </PageActions>
    </PageShell>
  )
}
