import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { INDUSTRY_META } from '../types'
import type { Program, HearingSession } from '../types'

export function PreSessionPage() {
  const navigate = useNavigate()
  const [program, setProgram] = useState<Program | null>(null)
  const [goal, setGoal] = useState('')
  const [timeLimit, setTimeLimit] = useState(5)

  useEffect(() => {
    const programId = localStorage.getItem('syodan_current_program_id')
    const saved = localStorage.getItem('syodan_programs')
    if (programId && saved) {
      try {
        const programs: Program[] = JSON.parse(saved)
        const current = programs.find(p => p.id === programId)
        if (current) setProgram(current)
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
      goal,
      timeLimit,
      title: `${program.industry} ヒアリング #${program.currentSessionCount + 1}`,
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
    <div className="card">
      <h2>ヒアリング事前設定</h2>
      <p className="small">第 {program.currentSessionCount + 1} 回商談の設定</p>

      <div style={{ background: '#f9f9f9', padding: 15, borderRadius: 10, marginBottom: 20 }}>
        <p className="small" style={{ margin: 0 }}>相手担当者</p>
        <p style={{ fontWeight: 'bold', margin: '5px 0' }}>{meta.personName} {meta.honorific}</p>
        <p className="small" style={{ margin: 0 }}>{meta.company} / {meta.role}</p>
      </div>

      <label>今回の目標</label>
      <textarea 
        placeholder="例：現在の業務フローを把握し、ボトルネックを聞き出す" 
        value={goal}
        onChange={e => setGoal(e.target.value)}
        rows={3}
      ></textarea>

      <label>制限時間 (分)</label>
      <input 
        type="number" 
        value={timeLimit} 
        min="1" max="30" 
        onChange={e => setTimeLimit(parseInt(e.target.value))}
      />

      <button className="btn cta" onClick={handleStartSession}>▶ ヒアリング開始</button>
      <button className="btn secondary" onClick={() => navigate('/')}>戻る</button>
    </div>
  )
}
