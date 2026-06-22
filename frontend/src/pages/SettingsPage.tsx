import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INDUSTRY_META } from '../types'
import type { Industry, Program } from '../types'

const SUB_INDUSTRY_PRESETS: Record<Industry, string[]> = {
  manufacturing: ['車・自動車部品', '金属加工', '電子部品・半導体', '食品・化学', 'その他（直接入力）'],
  finance: ['信用金庫・地銀', 'メガバンク', '証券・投資', '保険', 'その他（直接入力）'],
  retail: ['アパレル', 'スーパー・食料品', '家電量販店', 'ドラッグストア', 'その他（直接入力）'],
  distribution: ['陸上運送・トラック', '倉庫・管理', '海運・空運', 'その他（直接入力）'],
  real_estate: ['賃貸仲介', '売買仲介', 'デベロッパー', '不動産管理', 'その他（直接入力）']
}

export function SettingsPage() {
  const navigate = useNavigate()
  const [industry, setIndustry] = useState<Industry>('manufacturing')
  const [totalSessions, setTotalSessions] = useState(3)
  const [timeLimit, setTimeLimit] = useState(5) // Default 5 mins

  // Sub-industry states
  const [subIndustrySelect, setSubIndustrySelect] = useState(SUB_INDUSTRY_PRESETS.manufacturing[0])
  const [subIndustryCustom, setSubIndustryCustom] = useState('')
  const [isCustomSubIndustry, setIsCustomSubIndustry] = useState(false)
  
  // Custom customer settings
  const [customerItLevel, setCustomerItLevel] = useState('平均的（一般的なPC操作やビジネスツールは問題なく使える）')
  const [personalityType, setPersonalityType] = useState('')

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

  const handleCreate = () => {
    const finalSubIndustry = isCustomSubIndustry ? subIndustryCustom.trim() : subIndustrySelect

    const newProgram: Program = {
      id: `prog_${Date.now()}`,
      industry,
      totalSessions,
      currentSessionCount: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      personality_type: personalityType.trim() || undefined,
      customerItLevel: customerItLevel.trim() || undefined,
      timeLimit,
      sub_industry: finalSubIndustry || '未定'
    }

    const saved = localStorage.getItem('syodan_programs')
    const programs = saved ? JSON.parse(saved) : []
    localStorage.setItem('syodan_programs', JSON.stringify([...programs, newProgram]))
    localStorage.setItem('syodan_current_program_id', newProgram.id)
    
    // Proceed to Pre-session Setup
    navigate('/pre-session')
  }

  return (
    <div className="card wide">
      <h2>新規プログラム作成</h2>
      <p className="small" style={{ marginBottom: 20 }}>AI顧客との商談シリーズを開始します。PCサイズに合わせて広々と設定できます。</p>

      <div className="settings-grid">
        {/* 左カラム：基本設定 */}
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
          <h3 style={{ marginTop: 0, borderBottom: '2px solid #E91E63', paddingBottom: '8px' }}>1. 基本商談設定</h3>
          
          <label>業界</label>
          <select value={industry} onChange={e => handleIndustryChange(e.target.value as Industry)}>
            {Object.entries(INDUSTRY_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>

          <label>分野 (セクター)</label>
          <select 
            value={subIndustrySelect} 
            onChange={e => handleSubIndustrySelectChange(e.target.value)}
          >
            {SUB_INDUSTRY_PRESETS[industry].map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
          </select>

          {isCustomSubIndustry && (
            <div style={{ marginTop: '-8px', marginBottom: '16px' }}>
              <label className="small">直接入力する分野名</label>
              <input 
                type="text"
                placeholder="例: 精密医療機器、バイオテクノロジーなど" 
                value={subIndustryCustom}
                onChange={e => setSubIndustryCustom(e.target.value)}
                style={{ margin: 0, fontSize: '13px' }}
              />
            </div>
          )}

          <label>総ヒアリング回数</label>
          <select 
            value={totalSessions} 
            onChange={e => setTotalSessions(parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map(num => (
              <option key={num} value={num}>{num} 回</option>
            ))}
          </select>

          <label>1回あたりの制限時間 (分)</label>
          <input 
            type="number" 
            value={timeLimit} 
            min="1" max="30" 
            onChange={e => setTimeLimit(parseInt(e.target.value))}
            style={{ fontSize: '14px', margin: '8px 0 0 0' }}
          />
          
          <p className="small" style={{ marginTop: 15, lineHeight: '1.4' }}>
            ※回を追うごとに顧客の「真の課題」に近づく練習ができます。制限時間は1〜30分の間で指定可能です。
          </p>
        </div>

        {/* 右カラム：人物設定 */}
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
          <h3 style={{ marginTop: 0, borderBottom: '2px solid #E91E63', paddingBottom: '8px' }}>2. AI顧客の人物設定 (任意)</h3>
          
          <label style={{ marginTop: '5px' }}>IT知識レベル</label>
          <select 
            value={customerItLevel} 
            onChange={e => setCustomerItLevel(e.target.value)}
            style={{ margin: '5px 0 15px', fontSize: '13px' }}
          >
            <option value="ITが苦手（専門用語やシステム用語は通じない）">ITが苦手（専門用語やシステム用語は通じない）</option>
            <option value="平均的（一般的なPC操作やビジネスツールは問題なく使える）">平均的（一般的なPC操作やビジネスツールは問題なく使える）</option>
            <option value="ITに強い（システム用語やインフラの話もある程度理解できる）">ITに強い（システム用語やインフラの話もある程度理解できる）</option>
          </select>

          <label style={{ marginTop: '5px' }}>性格タイプ</label>
          <textarea 
            placeholder="例: 細かい数値にこだわる、結論ファースト、せっかちで要点を急ぐ" 
            value={personalityType}
            onChange={e => setPersonalityType(e.target.value)}
            rows={4}
            style={{ margin: '5px 0 10px', fontSize: '13px' }}
          ></textarea>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '15px' }}>
        <button className="btn secondary" onClick={() => navigate('/')} style={{ flex: 1, margin: 0 }}>戻る</button>
        <button className="btn cta" onClick={handleCreate} style={{ flex: 2, margin: 0 }}>▶ プログラム作成</button>
      </div>
    </div>
  )
}
