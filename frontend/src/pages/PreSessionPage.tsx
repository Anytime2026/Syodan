import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  if (loading) return <div className="card">読み込み中…</div>
  if (!program) return <div className="card">プログラムが見つかりません</div>

  if (program.completed_sessions >= program.total_sessions) {
    return (
      <div className="card wide" style={{ maxWidth: '800px' }}>
        <h2>ヒアリング準備</h2>
        <p className="small">全ヒアリングセッションが終了しています</p>

        <div
          style={{
            background: 'var(--color-oat-cream)',
            padding: 20,
            borderRadius: '24px',
            marginBottom: 20,
            border: '2px solid var(--color-sticker-black)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontWeight: 'bold', fontSize: '18px', margin: '5px 0' }}>
            設定された商談回数（全 {program.total_sessions}{' '}
            回）をすべて実施済みです。
          </p>
          <p className="small" style={{ margin: '10px 0 0', opacity: 0.9 }}>
            新しいセッションを開始することはできません。評価履歴や総評を確認してください。
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
          <button
            className="btn secondary"
            onClick={() => navigate('/')}
            style={{ flex: 1, margin: 0 }}
          >
            ホームに戻る
          </button>
          <button
            className="btn primary"
            onClick={() => navigate(`/overall-review?program_id=${program.id}`)}
            style={{ flex: 2, margin: 0 }}
          >
            シリーズ総評を見る
          </button>
        </div>
      </div>
    )
  }

  const meta = registryIndustry ? INDUSTRY_META[registryIndustry] : null
  const profile = program.customer_profile
  const nextSessionNumber = program.completed_sessions + 1

  return (
    <div className="card wide" style={{ maxWidth: '800px' }}>
      <h2>ヒアリング準備</h2>
      <p className="small">第 {nextSessionNumber} 回商談を開始します</p>

      <div
        style={{
          background: 'var(--color-oat-cream)',
          padding: 20,
          borderRadius: '24px',
          marginBottom: 20,
          border: '2px solid var(--color-sticker-black)',
        }}
      >
        <p
          className="small"
          style={{
            margin: '0 0 4px 0',
            color: 'var(--color-ink-black)',
            fontWeight: 'bold',
          }}
        >
          相手情報
        </p>
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
      </div>

      <label>今回の目標</label>
      <textarea
        rows={3}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder={DEFAULT_GOAL}
        style={{ marginBottom: 16 }}
      />

      <div
        style={{
          background: 'var(--color-kofi-blue)',
          padding: '15px 20px',
          borderRadius: '9999px',
          marginBottom: 20,
          border: '2px solid var(--color-sticker-black)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span style={{ fontSize: '20px' }}>⏱️</span>
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

      {error && (
        <p className="small" style={{ color: '#c62828', marginBottom: 12 }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
        <button
          className="btn secondary"
          onClick={() => navigate('/')}
          style={{ flex: 1, margin: 0 }}
        >
          戻る
        </button>
        <button
          className="btn cta"
          onClick={handleStartSession}
          disabled={starting || !goal.trim()}
          style={{ flex: 2, margin: 0 }}
        >
          {starting ? '準備中…' : '▶ 商談開始'}
        </button>
      </div>
    </div>
  )
}
