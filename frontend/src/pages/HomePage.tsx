import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { INDUSTRY_META } from '../types'
import type { Program } from '../types'

export function HomePage() {
  const [programs, setPrograms] = useState<Program[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('syodan_programs')
    if (saved) {
      try {
        setPrograms(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse programs", e)
        localStorage.removeItem('syodan_programs')
      }
    }
  }, [])

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  return (
    <div className="card">
      <h2>営業ヒアリングロープレ</h2>
      <p className="small">トレーニングを選択してください</p>

      <Link to="/settings" className="btn primary">▶ 新規プログラム作成</Link>
      
      {programs.length > 0 && (
        <>
          <p className="small" style={{ marginTop: 20 }}>進行中のプログラム</p>
          {programs.filter(p => p.status === 'active').map(p => (
            <Link 
              key={p.id} 
              to={`/pre-session`} 
              className="btn secondary"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 15px' }}
              onClick={() => localStorage.setItem('syodan_current_program_id', p.id)}
            >
              <div style={{ fontWeight: 'bold' }}>
                ⏱ {INDUSTRY_META[p.industry]?.label} - 第 {p.currentSessionCount + 1} 回商談
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                作成日: {formatDate(p.createdAt)}
              </div>
            </Link>
          ))}
        </>
      )}
      
      <Link to="/evaluations" className="btn primary">📊 評価履歴</Link>
    </div>
  )
}
