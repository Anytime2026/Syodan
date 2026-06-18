import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { INDUSTRY_META } from '../types'
import type { Program } from '../types'

export function OverallReviewPage() {
  const [program, setProgram] = useState<Program | null>(null)

  useEffect(() => {
    const programId = localStorage.getItem('syodan_current_program_id')
    const saved = localStorage.getItem('syodan_programs')
    if (programId && saved) {
      const programs: Program[] = JSON.parse(saved)
      const current = programs.find(p => p.id === programId)
      if (current) setProgram(current)
    }
  }, [])

  if (!program) return <div className="card">読み込み中...</div>

  const meta = INDUSTRY_META[program.industry]

  return (
    <div className="card">
      <h2>全回終了・総評</h2>
      <p className="small">{meta.company} との商談シリーズが完了しました</p>

      <div style={{ background: '#eaf4ff', padding: 15, borderRadius: 12, margin: '20px 0' }}>
        <p style={{ fontWeight: 'bold', margin: '0 0 10px 0', color: '#1C75BC' }}>🔑 ついに明かされる「真の課題」</p>
        <p style={{ margin: 0, fontSize: 14 }}>
          {/* Mocking the revelation based on the requirements example */}
          実は {meta.personName} {meta.honorific} は、<b>「社内にDXを推進できる人材が一人もおらず、自分自身もITへの苦手意識があるため、導入後の混乱を何よりも恐れていた」</b> という本音を抱えていました。
        </p>
      </div>

      <div style={{ borderTop: '1px solid #eee', paddingTop: 15 }}>
        <h3>総評（部長より）</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          「全5回の商談お疲れ様。中盤で相手のITスキルの低さに気づき、専門用語を避けた説明に切り替えたのは素晴らしい判断だった。最終的に真の課題である『導入後のサポート体制』への不安を払拭できたことが、この受注（模擬）に繋がったと言えるだろう。」
        </p>
      </div>

      <Link to="/" className="btn primary">トップに戻る</Link>
    </div>
  )
}
