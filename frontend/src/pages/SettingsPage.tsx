import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageActions, PageSection, PageShell } from '../components/PageShell'
import { Button } from '../components/ui/Button'
import {
  InputField,
  SelectField,
  TextAreaField,
} from '../components/ui/Form'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import { createProgram } from '../lib/api'
import { addRegistryEntry, setCurrentProgramId } from '../lib/registry'
import { INDUSTRY_META } from '../types'
import type { Industry } from '../types'

const SUB_INDUSTRY_PRESETS: Record<Industry, string[]> = {
  manufacturing: [
    '車・自動車部品',
    '金属加工',
    '電子部品・半導体',
    '食品・化学',
    'その他（直接入力）',
  ],
  finance: [
    '信用金庫・地銀',
    'メガバンク',
    '証券・投資',
    '保険',
    'その他（直接入力）',
  ],
  retail: [
    'アパレル',
    'スーパー・食料品',
    '家電量販店',
    'ドラッグストア',
    'その他（直接入力）',
  ],
  distribution: [
    '陸上運送・トラック',
    '倉庫・管理',
    '海運・空運',
    'その他（直接入力）',
  ],
  real_estate: [
    '賃貸仲介',
    '売買仲介',
    'デベロッパー',
    '不動産管理',
    'その他（直接入力）',
  ],
}

export function SettingsPage() {
  const navigate = useNavigate()
  const [industry, setIndustry] = useState<Industry>('manufacturing')
  const [totalSessions, setTotalSessions] = useState(3)
  const [timeLimit, setTimeLimit] = useState(5)

  const [subIndustrySelect, setSubIndustrySelect] = useState(
    SUB_INDUSTRY_PRESETS.manufacturing[0],
  )
  const [subIndustryCustom, setSubIndustryCustom] = useState('')
  const [isCustomSubIndustry, setIsCustomSubIndustry] = useState(false)

  const [customerItLevel, setCustomerItLevel] = useState(
    '平均的（一般的なPC操作やビジネスツールは問題なく使える）',
  )
  const [personalityType, setPersonalityType] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showLoadingScreen = useDeferredLoading(loading)

  const handleIndustryChange = (newIndustry: Industry) => {
    setIndustry(newIndustry)
    const presets = SUB_INDUSTRY_PRESETS[newIndustry]
    setSubIndustrySelect(presets[0])
    setIsCustomSubIndustry(presets[0] === 'その他（直接入力）')
    setSubIndustryCustom('')
  }

  const handleSubIndustrySelectChange = (val: string) => {
    setSubIndustrySelect(val)
    setIsCustomSubIndustry(val === 'その他（直接入力）')
  }

  const handleCreate = async () => {
    const finalSubIndustry = isCustomSubIndustry
      ? subIndustryCustom.trim()
      : subIndustrySelect
    const industryLabel = INDUSTRY_META[industry].label
    const field = `${industryLabel} / ${finalSubIndustry || '一般'}`

    setLoading(true)
    setError(null)
    try {
      const program = await createProgram({
        field,
        total_sessions: totalSessions,
        sub_field: finalSubIndustry || undefined,
        personality_type: personalityType.trim() || undefined,
        it_knowledge_level: customerItLevel.trim() || undefined,
      })

      addRegistryEntry({
        id: program.id,
        industry,
        sub_industry: finalSubIndustry || '一般',
        time_limit_minutes: timeLimit,
      })
      setCurrentProgramId(program.id)
      navigate('/pre-session')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '商談作成に失敗しました'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (showLoadingScreen) {
    return (
      <LoadingScreen
        character="thinking"
        message="AI顧客のペルソナを作成しています"
        hint="業界・分野・性格設定に合わせてロープレ相手を準備しています。数十秒かかることがあります。"
      />
    )
  }

  return (
    <PageShell
      width="wide"
      title="新規商談作成"
      subtitle="AI顧客との商談シリーズを開始します。業界や顧客設定を選んでください。"
      illustration="/images/PC.svg"
    >
      <div className="settings-grid">
        <PageSection variant="paper">
          <h3 className="page-section__heading">基本商談設定</h3>

          <SelectField
            label="業界"
            value={industry}
            onChange={(e) => handleIndustryChange(e.target.value as Industry)}
          >
            {Object.entries(INDUSTRY_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="分野（セクター）"
            value={subIndustrySelect}
            onChange={(e) => handleSubIndustrySelectChange(e.target.value)}
          >
            {SUB_INDUSTRY_PRESETS[industry].map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </SelectField>

          {isCustomSubIndustry && (
            <InputField
              label="直接入力する分野名"
              type="text"
              placeholder="例: 精密医療機器、バイオテクノロジーなど"
              value={subIndustryCustom}
              onChange={(e) => setSubIndustryCustom(e.target.value)}
            />
          )}

          <SelectField
            label="総ヒアリング回数"
            value={totalSessions}
            onChange={(e) => setTotalSessions(parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((num) => (
              <option key={num} value={num}>
                {num} 回
              </option>
            ))}
          </SelectField>

          <InputField
            label="1回あたりの制限時間（分）"
            type="number"
            value={timeLimit}
            min={1}
            max={30}
            onChange={(e) => setTimeLimit(parseInt(e.target.value))}
            hint="1〜30分の間で指定できます。回を追うごとに顧客の「真の課題」に近づく練習ができます。"
          />
        </PageSection>

        <PageSection variant="paper">
          <h3 className="page-section__heading">AI顧客の人物設定（任意）</h3>

          <SelectField
            label="IT知識レベル"
            value={customerItLevel}
            onChange={(e) => setCustomerItLevel(e.target.value)}
          >
            <option value="ITが苦手（専門用語やシステム用語は通じない）">
              ITが苦手（専門用語やシステム用語は通じない）
            </option>
            <option value="平均的（一般的なPC操作やビジネスツールは問題なく使える）">
              平均的（一般的なPC操作やビジネスツールは問題なく使える）
            </option>
            <option value="ITに強い（システム用語やインフラの話もある程度理解できる）">
              ITに強い（システム用語やインフラの話もある程度理解できる）
            </option>
          </SelectField>

          <TextAreaField
            label="性格タイプ"
            placeholder="例: 細かい数値にこだわる、結論ファースト、せっかちで要点を急ぐ"
            value={personalityType}
            onChange={(e) => setPersonalityType(e.target.value)}
            rows={4}
          />
        </PageSection>
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
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? '作成中…' : '商談作成'}
        </Button>
      </PageActions>
    </PageShell>
  )
}
