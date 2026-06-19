import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../components/roleplay/roleplay.css'
import { createProgram, createSession, startSession } from '../lib/api'

const FIELDS = ['金融', '流通', '製造', 'IT・通信', '医療']

export function RoleplaySetupPage() {
  const navigate = useNavigate()
  const [field, setField] = useState(FIELDS[0])
  const [totalSessions, setTotalSessions] = useState(3)
  const [goal, setGoal] = useState('現状の課題と予算感をヒアリングする')
  const [timeLimit, setTimeLimit] = useState(15)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const program = await createProgram(field, totalSessions)
      const session = await createSession(program.id, goal, timeLimit)
      await startSession(session.id)
      navigate(`/roleplay/${session.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : '開始に失敗しました'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="setup-page">
      <h1>ヒアリング事前設定</h1>
      <p>プログラムを作成し、今回の目標と制限時間を設定してからセッションを開始します。</p>
      <form className="setup-form" onSubmit={handleSubmit}>
        <label>
          分野
          <select value={field} onChange={(e) => setField(e.target.value)}>
            {FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          総ヒアリング回数
          <input
            type="number"
            min={1}
            max={10}
            value={totalSessions}
            onChange={(e) => setTotalSessions(Number(e.target.value))}
          />
        </label>
        <label>
          今回の目標
          <textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} required />
        </label>
        <label>
          制限時間（分）
          <input
            type="number"
            min={1}
            max={120}
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
          />
        </label>
        {error && <p className="setup-error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? '準備中…' : 'ヒアリングを開始'}
        </button>
      </form>
    </section>
  )
}
