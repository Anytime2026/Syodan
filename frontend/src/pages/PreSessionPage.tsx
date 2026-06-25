import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageActions, PageSection, PageShell } from '../components/PageShell'
import { Button } from '../components/ui/Button'
import { InfoRow, TextAreaField } from '../components/ui/Form'
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
      if (materialFile) {
        try {
          await uploadProgramMaterial(program.id, materialFile)
        } catch (uploadErr) {
          const message =
            uploadErr instanceof Error
              ? uploadErr.message
              : '資料のアップロードに失敗しました'
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
          <Button onClick={() => navigate('/')}>ホームに戻る</Button>
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
          <p className="profile-name" style={{ fontSize: 'var(--text-headline)' }}>
            設定された商談回数（全 {program.total_sessions} 回）をすべて実施済みです
          </p>
          <p className="small" style={{ margin: 0 }}>
            新しいセッションを開始することはできません。評価履歴や総評を確認してください。
          </p>
        </PageSection>

        <PageActions>
          <Button variant="gray" className="btn--shrink" onClick={() => navigate('/')}>
            ホームに戻る
          </Button>
          <Button
            className="btn--grow"
            onClick={() => navigate(`/overall-review?program_id=${program.id}`)}
          >
            シリーズ総評を見る
          </Button>
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
      <PageSection variant="paper">
        <p className="page-section__label">相手情報</p>
        {profile ? (
          <>
            <p className="profile-name">
              {profile.name ? `${profile.name} 様` : profile.role_title}
            </p>
            {profile.name && (
              <p className="profile-role">{profile.role_title}</p>
            )}
            <div className="info-list">
              <InfoRow label="業界" value={industryLabel} />
              <InfoRow label="分野" value={subFieldLabel} />
              <InfoRow label="規模" value={profile.company_size} />
              {profile.surface_need && (
                <InfoRow label="表層ニーズ" value={profile.surface_need} />
              )}
              {profile.personality_type && (
                <InfoRow label="性格" value={profile.personality_type} />
              )}
            </div>
          </>
        ) : meta ? (
          <>
            <p className="profile-name">
              {meta.personName} {meta.honorific}
            </p>
            <div className="info-list">
              <InfoRow label="会社" value={meta.company} />
              <InfoRow label="役職" value={meta.role} />
              <InfoRow label="業界" value={industryLabel} />
              <InfoRow label="分野" value={subFieldLabel} />
            </div>
          </>
        ) : (
          <div className="info-list">
            <InfoRow label="業界" value={industryLabel} />
            <InfoRow label="分野" value={subFieldLabel} />
          </div>
        )}
      </PageSection>

      {nextSessionNumber > 1 &&
        (priorSummaries.length > 0 || disclosedInfo.length > 0) && (
          <PageSection variant="oat">
            <p className="page-section__label">前回までの経緯</p>
            {priorSummaries.length > 0 && (
              <div style={{ marginBottom: disclosedInfo.length > 0 ? 12 : 0 }}>
                <p className="small" style={{ margin: '0 0 8px', fontWeight: 600 }}>
                  各回サマリ
                </p>
                {priorSummaries.map((s) => (
                  <p key={s.session_number} className="small" style={{ margin: '0 0 6px' }}>
                    第 {s.session_number} 回: {s.summary}
                  </p>
                ))}
              </div>
            )}
            {disclosedInfo.length > 0 && (
              <div>
                <p className="small" style={{ margin: '0 0 8px', fontWeight: 600 }}>
                  開示済み情報
                </p>
                <ul className="summary-list">
                  {disclosedInfo.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </PageSection>
        )}

      <TextAreaField
        label="今回の目標"
        rows={3}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder={DEFAULT_GOAL}
      />

      <PageSection variant="paper">
        <p className="page-section__label">参考資料の添付（任意）</p>
        <p className="small" style={{ margin: '0 0 12px' }}>
          商談でAI顧客に見せる製品概要や営業資料（PDF, TXT, MD）を添付できます。最大10MB。
        </p>
        {program.materials_filename && !materialFile && (
          <p className="small" style={{ marginBottom: 12 }}>
            現在の資料: {program.materials_filename}
            <br />
            新しいファイルを選択すると上書きされます
          </p>
        )}
        <div className="file-field">
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
          />
        </div>
      </PageSection>

      <div className="time-pill" role="status">
        <img
          className="time-pill__icon"
          src="/images/danbell.svg"
          alt=""
          draggable={false}
        />
        制限時間: {timeLimit} 分
      </div>

      {error && (
        <div className="alert-banner alert-banner--error" role="alert">
          {error}
        </div>
      )}

      <PageActions>
        <Button variant="gray" className="btn--shrink" onClick={() => navigate('/')}>
          戻る
        </Button>
        <Button
          className="btn--grow"
          onClick={handleStartSession}
          disabled={starting || !goal.trim()}
        >
          {starting ? '準備中…' : '商談開始'}
        </Button>
      </PageActions>
    </PageShell>
  )
}
