import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { INDUSTRY_META } from '../types'

export function EvaluationsPage() {
  const navigate = useNavigate()
  const [sessionResults, setSessionResults] = useState<any[]>([])

  useEffect(() => {
    const results = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('syodan_session_result_')) {
        results.push(JSON.parse(localStorage.getItem(key)!))
      }
    }
    // Sort by newest first
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setSessionResults(results)
  }, [])

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  return (
    <div className="card">
      <h2>評価履歴</h2>
      <p className="small">これまでのロープレ一覧</p>

      {sessionResults.length === 0 ? (
        <p className="small">完了したセッションはまだありません</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessionResults.map(res => {
            const industryLabel = res.industry ? INDUSTRY_META[res.industry as keyof typeof INDUSTRY_META]?.label : '不明な業界';
            const sessionText = res.sessionNumber ? `第${res.sessionNumber}回商談` : `セッション #${res.id?.split('_')[1]?.slice(-4)}`;
            
            return (
              <Link 
                key={res.id} 
                to={`/evaluations/${res.id}`} 
                className="msg ai" 
                style={{ textDecoration: 'none', display: 'block', border: '1px solid #eee', width: '100%', margin: 0 }}
              >
                <p style={{ fontWeight: 'bold', margin: '0 0 5px 0', color: '#1C75BC' }}>
                  {industryLabel} - {sessionText}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className="small" style={{ margin: 0, opacity: 0.8 }}>実施日: {formatDate(res.createdAt)}</p>
                  <p className="small" style={{ margin: 0 }}>詳細 ＞</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <button className="btn secondary" onClick={() => navigate('/')} style={{ marginTop: '20px' }}>ホームに戻る</button>
    </div>
  )
}
