import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { INDUSTRY_META } from '../types'
import type { Program, HearingSession } from '../types'

export function PreSessionPage() {
  const navigate = useNavigate()
  const [program, setProgram] = useState<Program | null>(null)
  const [timeLimit, setTimeLimit] = useState(5)

  useEffect(() => {
    const programId = localStorage.getItem('syodan_current_program_id')
    const saved = localStorage.getItem('syodan_programs')
    if (programId && saved) {
      try {
        const programs: Program[] = JSON.parse(saved)
        const current = programs.find(p => p.id === programId)
        if (current) {
          setProgram(current)
          setTimeLimit(current.timeLimit || 5)
        }
      } catch (e) {
        console.error("Failed to parse programs", e)
      }
    }
  }, [])

  const handleStartSession = () => {
    if (!program) return

    const newSession: HearingSession = {
      id: `sess_${Date.now()}`,
      program_id: program.id,
      session_number: program.currentSessionCount + 1,
      goal: '',
      timeLimit,
      title: `${INDUSTRY_META[program.industry]?.label} (${program.sub_industry || '一般'}) ヒアリング #${program.currentSessionCount + 1}`,
      status: 'active',
      createdAt: new Date().toISOString()
    }

    localStorage.setItem('syodan_current_session_id', newSession.id)
    localStorage.setItem('syodan_messages', JSON.stringify([])) // Clear chat history for new session
    
    navigate('/roleplay')
  }

  if (!program) return <div>プログラムが見つかりません</div>

  const meta = INDUSTRY_META[program.industry]

  return (
    <div className="card wide" style={{ maxWidth: '800px' }}>
      <h2>ヒアリング準備</h2>
      <p className="small">第 {program.currentSessionCount + 1} 回商談を開始します</p>

      <div style={{ background: '#f9f9f9', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid #eee' }}>
        <p className="small" style={{ margin: 0, color: '#E91E63', fontWeight: 'bold' }}>相手情報</p>
        <p style={{ fontWeight: 'bold', fontSize: '18px', margin: '5px 0' }}>{meta.personName} {meta.honorific}</p>
        <p className="small" style={{ margin: 0, opacity: 0.9 }}>
          {meta.company} / {meta.role} (業界: {meta.label} / 分野: {program.sub_industry || '一般'})
        </p>
      </div>

      <div style={{ background: '#FFF0F6', padding: '15px 20px', borderRadius: 12, marginBottom: 20, border: '1px solid #FF80AB', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>⏱️</span>
        <div style={{ fontSize: '14px', color: '#E91E63', fontWeight: 'bold' }}>
          制限時間: {timeLimit} 分 （商談作成時に設定された時間）
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
        <button className="btn secondary" onClick={() => navigate('/')} style={{ flex: 1, margin: 0 }}>戻る</button>
        <button className="btn cta" onClick={handleStartSession} style={{ flex: 2, margin: 0 }}>▶ 商談開始</button>
      </div>
    </div>
  )
}
