import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageActions, PageSection, PageShell } from '../components/PageShell'
import { Button } from '../components/ui/Button'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import { getProgram, getSession } from '../lib/api'
import { findRegistryEntry } from '../lib/registry'
import type { HearingSession, Program } from '../lib/types'
import { INDUSTRY_META } from '../types'

export function EvaluationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<HearingSession | null>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const showLoadingScreen = useDeferredLoading(loading)

  useEffect(() => {
    if (!id) return
    getSession(id)
      .then((s) => {
        setSession(s)
        return getProgram(s.program_id)
      })
      .then(setProgram)
      .catch(() => setError('評価データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [id])

  if (showLoadingScreen) return <LoadingScreen message="評価を読み込み中" />
  if (loading) return null
  if (error || !session || !program)
    return (
      <PageShell
        title={error ?? 'データがありません'}
        illustration="/images/!-bear.svg"
      >
        <PageActions>
          <Button variant="gray" to="/evaluations">
            一覧に戻る
          </Button>
        </PageActions>
      </PageShell>
    )

  const entry = findRegistryEntry(program.id)
  const industryLabel = entry
    ? INDUSTRY_META[entry.industry]?.label
    : program.field
  const sessionSummary = program.customer_state?.session_summaries?.find(
    (s) => s.session_number === session.session_number,
  )?.summary

  return (
    <PageShell
      width="wide"
      title="商談評価詳細"
      subtitle={`${industryLabel} — 第 ${session.session_number} 回商談`}
      illustration="/images/Thinking_Bear.svg"
    >
      <p className="small" style={{ margin: 0 }}>
        {session.ended_at
          ? `実施日: ${new Date(session.ended_at).toLocaleDateString()}`
          : session.title}
      </p>

      <PageSection variant="paper">
        <p className="page-section__label">会話履歴</p>
        <div className="chat-log">
          {session.transcript ? (
            session.transcript.split('\n').map((line, idx) => {
              const isUser = line.startsWith('営業:')
              const sender = isUser ? 'あなた' : 'AI顧客'
              const content = line.replace(/^(営業:|顧客:)\s*/, '').trim()
              if (!content) return null

              return (
                <div
                  key={idx}
                  className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--ai'}`}
                >
                  <span className="chat-bubble__sender">{sender}</span>
                  {content}
                </div>
              )
            })
          ) : (
            <p className="small" style={{ margin: 0, textAlign: 'center' }}>
              会話履歴がありません（処理中の場合はしばらくお待ちください）
            </p>
          )}
        </div>
      </PageSection>

      {sessionSummary && (
        <PageSection variant="oat">
          <h3 className="page-section__heading">セッション要約</h3>
          <p className="review-block__body">{sessionSummary}</p>
        </PageSection>
      )}

      <PageSection variant="paper">
        <h3 className="page-section__heading">先輩からの評価</h3>
        {session.evaluations && session.evaluations.length > 0 ? (
          session.evaluations.map((ev) => (
            <div key={ev.id} className="review-block">
              <p className="review-block__author">{ev.evaluator_id}</p>
              <p className="review-block__body">
                {ev.content || '（評価内容なし）'}
              </p>
            </div>
          ))
        ) : (
          <p className="small" style={{ margin: 0 }}>
            先輩評価はまだ届いていません。HULFT
            経由で反映されるまでお待ちください。
          </p>
        )}
      </PageSection>

      <PageActions>
        <Button variant="gray" className="btn--shrink" to="/evaluations">
          一覧に戻る
        </Button>
        <Button className="btn--shrink" to="/">
          ホームに戻る
        </Button>
      </PageActions>
    </PageShell>
  )
}
