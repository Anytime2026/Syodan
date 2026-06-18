import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INDUSTRY_META } from '../types'
import type { Industry, Program } from '../types'

export function SettingsPage() {
  const navigate = useNavigate()
  const [industry, setIndustry] = useState<Industry>('manufacturing')
  const [totalSessions, setTotalSessions] = useState(3)

  const handleCreate = () => {
    const newProgram: Program = {
      id: `prog_${Date.now()}`,
      industry,
      totalSessions,
      currentSessionCount: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    }

    const saved = localStorage.getItem('syodan_programs')
    const programs = saved ? JSON.parse(saved) : []
    localStorage.setItem('syodan_programs', JSON.stringify([...programs, newProgram]))
    localStorage.setItem('syodan_current_program_id', newProgram.id)
    
    // Proceed to Pre-session Setup
    navigate('/pre-session')
  }

  return (
    <div className="card">
      <h2>新規プログラム作成</h2>
      <p className="small">AI顧客との商談シリーズを開始します</p>

      <label>業界・分野</label>
      <select value={industry} onChange={e => setIndustry(e.target.value as Industry)}>
        {Object.entries(INDUSTRY_META).map(([key, meta]) => (
          <option key={key} value={key}>{meta.label}</option>
        ))}
      </select>

      <label>総ヒアリング回数</label>
      <select 
        value={totalSessions} 
        onChange={e => setTotalSessions(parseInt(e.target.value))}
      >
        {[1, 2, 3, 4, 5].map(num => (
          <option key={num} value={num}>{num} 回</option>
        ))}
      </select>

      <p className="small" style={{ marginTop: 10 }}>
        ※回を追うごとに顧客の「真の課題」に近づく練習ができます。
      </p>

      <button className="btn cta" onClick={handleCreate}>▶ プログラム作成</button>
      <button className="btn secondary" onClick={() => navigate('/')}>戻る</button>
    </div>
  )
}
