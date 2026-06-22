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

  const handleReset = () => {
    if (window.confirm("過去のすべての商談履歴、評価データ、プログラム設定が消去されます。リセットしてよろしいですか？")) {
      localStorage.clear()
      setPrograms([])
      alert("すべてのデータをクリアしました。新しい商談プログラムを作成してください。")
    }
  }

  const activePrograms = programs.filter(p => p.status === 'active')

  return (
    <div className="card" style={{ maxWidth: '500px' }}>
      <h2 style={{ textAlign: 'center', color: '#E91E63', marginBottom: '8px' }}>営業ヒアリングロープレ</h2>
      <p className="small" style={{ textAlign: 'center', marginBottom: '24px' }}>AI顧客を相手にしたロールプレイトレーニング</p>

      <Link to="/settings" className="btn primary" style={{ padding: '16px' }}>▶ 新規プログラム作成</Link>

      {activePrograms.length > 0 && (
        <div style={{ marginTop: '25px', marginBottom: '15px' }}>
          <p className="small" style={{ fontWeight: 'bold', margin: '0 0 10px 0', color: '#E91E63' }}>進行中のプログラム</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activePrograms.map(p => (
              <Link
                key={p.id}
                to={`/pre-session`}
                className="btn secondary"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '12px 18px',
                  margin: 0,
                  background: '#FFF0F6',
                  color: '#E91E63',
                  border: '1px solid #FF80AB',
                  borderRadius: '12px'
                }}
                onClick={() => localStorage.setItem('syodan_current_program_id', p.id)}
              >
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                  ⏱ {INDUSTRY_META[p.industry]?.label} - 進行中 ({p.currentSessionCount + 1} / {p.totalSessions}回目)
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '5px' }}>
                  作成日: {formatDate(p.createdAt)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link to="/evaluations" className="btn primary" style={{ marginTop: '12px', background: '#FF5722' }}>📊 評価履歴・総評一覧</Link>

      <div style={{ borderTop: '1px solid #eee', marginTop: '30px', paddingTop: '15px', textAlign: 'center' }}>
        <button
          onClick={handleReset}
          style={{
            background: 'none',
            border: 'none',
            color: '#999',
            fontSize: '11px',
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          ⚙️ データをリセットして最初から試す
        </button>
      </div>
    </div>
  )
}
