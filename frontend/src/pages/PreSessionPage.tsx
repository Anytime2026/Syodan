import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageActions, PageSection, PageShell } from '../components/PageShell'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import { createSession, getProgram, startSession } from '../lib/api'
import { findRegistryEntry, getCurrentProgramId } from '../lib/registry'
import type { Program } from '../lib/types'
import { INDUSTRY_META } from '../types'

const DEFAULT_GOAL = '現状の課題と予算感をヒアリングする'

export function PreSessionPage() {
  const navigate = useNavigate()
  const [program, setProgram] = useState<Program | null>(null)
  const [registryIndustry, setRegistryIndustry] = useState<
    keyof typeof INDUSTRY_META | null
  >(null)
  const [subIndustry, setSubIndustry] = useState('')
  const [timeLimit, setTimeLimit] = useState(5)
  const [goal, setGoal] = useState(DEFAULT_GOAL)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showLoadingScreen = useDeferredLoading(loading)
  const showStartingScreen = useDeferredLoading(starting)

  useEffect(() => {
    const programId = getCurrentProgramId()
    if (!programId) {
      setLoading(false)
      return
    }

    const entry = findRegistryEntry(programId)
    if (entry) {
      setRegistryIndustry(entry.industry)
      setSubIndustry(entry.sub_industry)
      setTimeLimit(entry.time_limit_minutes)
    }

    getProgram(programId)
      .then(setProgram)
      .catch(() => setError('プログラムの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  const handleStartSession = async () => {
    if (!program || !goal.trim()) return

    setStarting(true)
    setError(null)
    try {
      const session = await createSession(program.id, goal.trim(), timeLimit)
      await startSession(session.id)
      navigate(`/roleplay/${session.id}`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'セッション開始に失敗しました'
      setError(message)
    } finally {
      setStarting(false)
    }
  }

  if (showLoadingScreen) return <LoadingScreen message="準備中" />
  if (loading) return null
  if (showStartingScreen) {
    return <LoadingScreen message="セッションを開始しています" />
  }
  if (!program)
    return (
      <PageShell
        title="プログラムが見つかりません"
        illustration="/images/!-bear.svg"
      >
        <PageActions>
          <button className="btn primary" onClick={() => navigate('/')}>
            ホームに戻る
          </button>
        </PageActions>
      </PageShell>
    )

  if (program.completed_sessions >= program.total_sessions) {
    return (
      <PageShell
        width="wide"
        title="ヒアリング準備"
        subtitle="全ヒアリングセッションが終了しています"
        illustration="/images/LevelUp.svg"
      >
        <PageSection variant="blue">
          <p
            style={{ fontWeight: 'bold', fontSize: '1.05rem', margin: '5px 0' }}
          >
            設定された商談回数（全 {program.total_sessions}{' '}
            回）をすべて実施済みです。
          </p>
          <p className="small" style={{ margin: '10px 0 0', opacity: 0.9 }}>
            新しいセッションを開始することはできません。評価履歴や総評を確認してください。
          </p>
        </PageSection>

        <PageActions>
          <button
            className="btn secondary btn--shrink"
            onClick={() => navigate('/')}
          >
            ホームに戻る
          </button>
          <button
            className="btn primary btn--grow"
            onClick={() => navigate(`/overall-review?program_id=${program.id}`)}
          >
            シリーズ総評を見る
          </button>
        </PageActions>
      </PageShell>
    )
  }

  const meta = registryIndustry ? INDUSTRY_META[registryIndustry] : null
  const profile = program.customer_profile
  const nextSessionNumber = program.completed_sessions + 1

  return (
    <PageShell
      width="wide"
      title="ヒアリング準備"
      subtitle={`第 ${nextSessionNumber} 回商談を開始します`}
      illustration="/images/brackBoard.svg"
    >
      <PageSection>
        <p className="page-section__label">相手情報</p>
        {profile ? (
          <>
            <p
              style={{ fontWeight: 'bold', fontSize: '18px', margin: '5px 0' }}
            >
              {profile.name ? `${profile.name} 様` : profile.role_title}
            </p>
            {profile.name && (
              <p
                className="small"
                style={{ margin: '0 0 4px 0', opacity: 0.9 }}
              >
                {profile.role_title}
              </p>
            )}
            <p className="small" style={{ margin: 0, opacity: 0.9 }}>
              {profile.industry} / {profile.company_size} (分野:{' '}
              {subIndustry || program.field})
            </p>
            {profile.personality_type && (
              <p className="small" style={{ margin: '8px 0 0', opacity: 0.85 }}>
                性格: {profile.personality_type}
              </p>
            )}
          </>
        ) : meta ? (
          <>
            <p
              style={{ fontWeight: 'bold', fontSize: '18px', margin: '5px 0' }}
            >
              {meta.personName} {meta.honorific}
            </p>
            <p className="small" style={{ margin: 0, opacity: 0.9 }}>
              {meta.company} / {meta.role} (分野: {subIndustry || '一般'})
            </p>
          </>
        ) : (
          <p className="small" style={{ margin: '5px 0 0' }}>
            {program.field}
          </p>
        )}
      </PageSection>

      <label>今回の目標</label>
      <textarea
        rows={3}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder={DEFAULT_GOAL}
        style={{ marginBottom: 16 }}
      />

      <PageSection variant="blue">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/images/Search-glass.svg"
            alt=""
            width={28}
            height={28}
            draggable={false}
          />
          <div
            style={{
              fontSize: '14px',
              color: 'var(--color-ink-black)',
              fontWeight: 'bold',
            }}
          >
            制限時間: {timeLimit} 分
          </div>
        </div>
      </PageSection>

      {error && (
        <p className="small" style={{ color: '#c62828', marginBottom: 12 }}>
          {error}
        </p>
      )}

      <PageActions>
        <button
          className="btn secondary btn--shrink"
          onClick={() => navigate('/')}
        >
          戻る
        </button>
        <button
          className="btn cta btn--grow"
          onClick={handleStartSession}
          disabled={starting || !goal.trim()}
        >
          {starting ? '準備中…' : '▶ 商談開始'}
        </button>
      </PageActions>
    </PageShell>
  )
}
