import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
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
            createdAt: session.ended_at ?? session.started_at ?? program.created_at,
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

      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
    <div className="card wide" style={{ maxWidth: '800px' }}>
      <h2>商談評価履歴</h2>
      <p className="small" style={{ marginBottom: '20px' }}>
        これまでの個別セッションおよびシリーズ総評一覧
      </p>

      {loading && <p className="small">読み込み中…</p>}

      {!loading && items.length === 0 && (
        <p className="small">完了したセッションや商談はまだありません</p>
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((res) => {
            const industryLabel = INDUSTRY_META[res.industry]?.label ?? '不明な業界'
            const isOverall = res.type === 'overall'
            const sessionText =
              res.type === 'session'
                ? res.title ?? `第${res.sessionNumber}回商談`
                : ''

            return (
              <Link
                key={`${res.type}-${res.id}`}
                to={
                  isOverall ? `/overall-review?program_id=${res.programId}` : `/evaluations/${res.id}`
                }
                className="msg ai"
                style={{
                  textDecoration: 'none',
                  display: 'block',
                  border: '2px solid var(--color-sticker-black)',
                  background: isOverall ? 'var(--color-oat-cream)' : 'var(--color-paper-white)',
                  width: '100%',
                  margin: 0,
                  padding: '16px',
                  borderRadius: '24px',
                  boxShadow: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p
                    style={{
                      fontWeight: 'bold',
                      margin: '0 0 5px 0',
                      color: 'var(--color-ink-black)',
                      fontSize: '15px',
                    }}
                  >
                    {isOverall
                      ? `🏆 ${industryLabel} - 商談シリーズ完了 (総評)`
                      : `${industryLabel} - ${sessionText}`}
                  </p>
                  {isOverall && (
                    <span
                      style={{
                        background: 'var(--color-kofi-blue)',
                        color: 'var(--color-ink-black)',
                        border: '2px solid var(--color-sticker-black)',
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontWeight: 'bold',
                      }}
                    >
                      シリーズ完了
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px',
                  }}
                >
                  <p className="small" style={{ margin: 0, opacity: 0.8 }}>
                    {isOverall
                      ? `全${res.totalSessions}回のアプローチ評価`
                      : `実施日: ${formatDate(res.createdAt)}`}
                  </p>
                  <p
                    className="small"
                    style={{
                      margin: 0,
                      fontWeight: 'bold',
                      color: 'var(--color-ink-black)',
                    }}
                  >
                    {isOverall ? '全体総評を見る ＞' : '詳細評価 ＞'}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <button className="btn secondary" onClick={() => navigate('/')} style={{ marginTop: '24px' }}>
        ホームに戻る
      </button>
    </div>
  )
}
