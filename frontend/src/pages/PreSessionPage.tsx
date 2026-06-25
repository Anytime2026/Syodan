import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageActions, PageSection, PageShell } from '../components/PageShell'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import {
  createSession,
  getProgram,
  startSession,
  uploadProgramMaterial,
} from '../lib/api'
import { findRegistryEntry, getCurrentProgramId } from '../lib/registry'
import type { Program } from '../lib/types'
import { INDUSTRY_META } from '../types'

const DEFAULT_GOAL = '現状の課題と予算感をヒアリングする'

function parseProgramField(field: string): {
  industry: string
  subField: string
} {
  const parts = field.split(' / ')
  if (parts.length >= 2) {
    return {
      industry: parts[0].trim(),
      subField: parts.slice(1).join(' / ').trim(),
    }
  }
  return { industry: field.trim(), subField: '一般' }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="small" style={{ margin: '6px 0 0', opacity: 0.9 }}>
      <span style={{ fontWeight: 'bold' }}>{label}: </span>
      {value}
    </p>
  )
}

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
  const [materialFile, setMaterialFile] = useState<File | null>(null)

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
      if (materialFile) {
        try {
          await uploadProgramMaterial(program.id, materialFile)
        } catch (uploadErr) {
          const message =
            uploadErr instanceof Error
              ? uploadErr.message
              : '資料のアップロードに失敗しました'
          // AWS ECS が古いイメージのとき upload-material が 404 になる
          if (message !== 'Not Found') {
            throw uploadErr
          }
        }
      }
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
  const customerState = program.customer_state
  const nextSessionNumber = program.completed_sessions + 1
  const parsedField = parseProgramField(program.field)
  const industryLabel = meta?.label ?? parsedField.industry
  const subFieldLabel = subIndustry || parsedField.subField

  const priorSummaries =
    nextSessionNumber > 1
      ? (customerState?.session_summaries ?? []).filter(
          (s) => s.session_number < nextSessionNumber,
        )
      : []
  const disclosedInfo =
    nextSessionNumber > 1 ? (customerState?.disclosed_info ?? []) : []

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
            <InfoRow label="業界" value={industryLabel} />
            <InfoRow label="分野" value={subFieldLabel} />
            <InfoRow label="規模" value={profile.company_size} />
            {profile.surface_need && (
              <InfoRow label="表層ニーズ" value={profile.surface_need} />
            )}
            {profile.personality_type && (
              <InfoRow label="性格" value={profile.personality_type} />
            )}
          </>
        ) : meta ? (
          <>
            <p
              style={{ fontWeight: 'bold', fontSize: '18px', margin: '5px 0' }}
            >
              {meta.personName} {meta.honorific}
            </p>
            <InfoRow label="会社" value={meta.company} />
            <InfoRow label="役職" value={meta.role} />
            <InfoRow label="業界" value={industryLabel} />
            <InfoRow label="分野" value={subFieldLabel} />
          </>
        ) : (
          <>
            <InfoRow label="業界" value={industryLabel} />
            <InfoRow label="分野" value={subFieldLabel} />
          </>
        )}
      </div>

      {nextSessionNumber > 1 &&
        (priorSummaries.length > 0 || disclosedInfo.length > 0) && (
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
                margin: '0 0 8px 0',
                color: 'var(--color-ink-black)',
                fontWeight: 'bold',
              }}
            >
              前回までの経緯
            </p>
            {priorSummaries.length > 0 && (
              <div style={{ marginBottom: disclosedInfo.length > 0 ? 12 : 0 }}>
                <p
                  className="small"
                  style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}
                >
                  各回サマリ
                </p>
                {priorSummaries.map((s) => (
                  <p
                    key={s.session_number}
                    className="small"
                    style={{ margin: '0 0 6px 0', opacity: 0.9 }}
                  >
                    第 {s.session_number} 回: {s.summary}
                  </p>
                ))}
              </div>
            )}
            {disclosedInfo.length > 0 && (
              <div>
                <p
                  className="small"
                  style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}
                >
                  開示済み情報
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '1.2em',
                    opacity: 0.9,
                  }}
                >
                  {disclosedInfo.map((item) => (
                    <li
                      key={item}
                      className="small"
                      style={{ marginBottom: 4 }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
            margin: '0 0 8px 0',
            color: 'var(--color-ink-black)',
            fontWeight: 'bold',
          }}
        >
          参考資料の添付 (任意)
        </p>
        <p
          className="small"
          style={{ marginBottom: 10, color: 'var(--color-ink-gray)' }}
        >
          商談でAI顧客に見せる製品概要や営業資料（PDF, TXT,
          MD）を添付できます。※最大10MB
        </p>
        {program.materials_filename && !materialFile && (
          <p className="small" style={{ marginBottom: 10, opacity: 0.9 }}>
            現在の資料: {program.materials_filename}
            <br />
            <span style={{ opacity: 0.8 }}>
              新しいファイルを選択すると上書きされます
            </span>
          </p>
        )}
        <input
          type="file"
          accept=".pdf,.txt,.md"
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            if (file) {
              if (file.size > 10 * 1024 * 1024) {
                setError('ファイルサイズは10MB以下にしてください。')
                setMaterialFile(null)
                e.target.value = ''
              } else {
                setError(null)
                setMaterialFile(file)
              }
            } else {
              setMaterialFile(null)
            }
          }}
          style={{
            fontSize: '13px',
            padding: '8px',
            background: '#fff',
            border: '2px solid var(--color-sticker-black)',
            borderRadius: '8px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>

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
