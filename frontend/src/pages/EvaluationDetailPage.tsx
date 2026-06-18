import { Link, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'

export function EvaluationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem(`syodan_session_result_${id}`)
    if (saved) {
      setSession(JSON.parse(saved))
    }
  }, [id])

  if (!session) return <div className="card">読み込み中...</div>

  return (
    <div className="card">
      <h2>商談評価詳細</h2>
      
      <div style={{ marginBottom: 20 }}>
        <p className="small" style={{ fontWeight: 'bold' }}>文字起こしサマリ</p>
        <div style={{ 
          background: '#f5f5f5', 
          padding: 10, 
          borderRadius: 8, 
          fontSize: 12, 
          maxHeight: 150, 
          overflowY: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          {session.transcript}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #eee', paddingTop: 15 }}>
        <h3>先輩からの評価</h3>
        
        {/* Mocking multiple evaluations as per requirements */}
        <div className="msg ai" style={{ background: '#fff9f0', border: '1px solid #F9A638' }}>
          <p className="small" style={{ fontWeight: 'bold', margin: 0 }}>佐藤 先輩</p>
          <p style={{ margin: '5px 0' }}>ヒアリングの深さ: 4/5</p>
          <p className="small">「顧客の背景をうまく聞き出せています。次回は具体的な予算についても触れてみましょう。」</p>
        </div>

        <div className="msg ai" style={{ background: '#f0f9ff', border: '1px solid #1C75BC' }}>
          <p className="small" style={{ fontWeight: 'bold', margin: 0 }}>鈴木 課長</p>
          <p style={{ margin: '5px 0' }}>信頼構築: 3/5</p>
          <p className="small">「少し緊張が見られますが、誠実さは伝わっています。もう少し笑顔（声のトーン）を意識して。」</p>
        </div>
      </div>

      <Link to="/evaluations" className="btn secondary">一覧に戻る</Link>
      <Link to="/" className="btn primary">ホームに戻る</Link>
    </div>
  )
}
