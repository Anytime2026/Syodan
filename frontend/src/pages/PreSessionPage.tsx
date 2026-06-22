import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function PreSessionPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/roleplay/setup', { replace: true })
  }, [navigate])

  return (
    <div className="card wide" style={{ maxWidth: '800px' }}>
      <p>ヒアリング設定画面へ移動中…</p>
    </div>
  )
}
