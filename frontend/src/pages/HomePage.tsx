import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ACTIVE_PROGRAM_STATUSES, getProgram } from '../lib/api'
import {
  clearLocalData,
  loadRegistry,
  setCurrentProgramId,
} from '../lib/registry'
import type { Program } from '../lib/types'
import { INDUSTRY_META } from '../types'

type ActiveProgram = {
  registryId: string
  industry: keyof typeof INDUSTRY_META
  program: Program
}

export function HomePage() {
  const [activePrograms, setActivePrograms] = useState<ActiveProgram[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const registry = loadRegistry()
    if (registry.length === 0) {
      setLoading(false)
      return
    }

    Promise.all(
      registry.map(async (entry) => {
        try {
          const program = await getProgram(entry.id)
          return { registryId: entry.id, industry: entry.industry, program }
        } catch {
          return null
        }
      }),
    ).then((results) => {
      const active = results.filter(
        (r): r is ActiveProgram =>
          r !== null &&
          ACTIVE_PROGRAM_STATUSES.has(r.program.status) &&
          r.program.completed_sessions < r.program.total_sessions,
      )
      setActivePrograms(active)
      setLoading(false)
    })
  }, [])

  const formatDate = (isoString: string) => {
    const d = new Date(isoString)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const handleReset = () => {
    if (
      window.confirm(
        'ブラウザに保存したプログラム一覧と設定が消去されます。バックエンドのデータは残ります。リセットしてよろしいですか？',
      )
    ) {
      clearLocalData()
      setActivePrograms([])
      alert(
        'ローカルデータをクリアしました。新しい商談プログラムを作成してください。',
      )
    }
  }

  return (
    <div className="card" style={{ maxWidth: '500px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>
        営業ヒアリングロープレ
      </h2>
      <p
        className="small"
        style={{ textAlign: 'center', marginBottom: '24px' }}
      >
        AI顧客を相手にしたロールプレイトレーニング
      </p>

      <Link to="/settings" className="btn primary" style={{ padding: '16px' }}>
        ▶ 新規商談作成
      </Link>

      {loading && (
        <p className="small" style={{ marginTop: 16 }}>
          読み込み中…
        </p>
      )}

      {!loading && activePrograms.length > 0 && (
        <div style={{ marginTop: '25px', marginBottom: '15px' }}>
          <p
            className="small"
            style={{
              fontWeight: 'bold',
              margin: '0 0 10px 0',
              color: 'var(--color-ink-black)',
            }}
          >
            進行中のプログラム
          </p>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {activePrograms.map(({ registryId, industry, program }) => {
              const isCompleted =
                program.completed_sessions >= program.total_sessions
              return (
                <Link
                  key={registryId}
                  to={
                    isCompleted
                      ? `/overall-review?program_id=${program.id}`
                      : '/pre-session'
                  }
                  className="btn secondary"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '16px 20px',
                    margin: 0,
                    background: 'var(--color-oat-cream)',
                    color: 'var(--color-ink-black)',
                    border: '2px solid var(--color-sticker-black)',
                    borderRadius: '24px',
                  }}
                  onClick={() => setCurrentProgramId(registryId)}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                    {isCompleted ? (
                      <>
                        🏆 {INDUSTRY_META[industry]?.label} - 商談シリーズ完了
                        (総評を見る)
                      </>
                    ) : (
                      <>
                        ⏱ {INDUSTRY_META[industry]?.label} - 進行中 (
                        {program.completed_sessions + 1} /{' '}
                        {program.total_sessions}回目)
                      </>
                    )}
                  </div>
                  <div
                    style={{ fontSize: '11px', opacity: 0.8, marginTop: '5px' }}
                  >
                    作成日: {formatDate(program.created_at)}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <Link
        to="/evaluations"
        className="btn primary"
        style={{ marginTop: '12px' }}
      >
        評価履歴・総評一覧
      </Link>

      <div
        style={{
          borderTop: '1px solid #eee',
          marginTop: '30px',
          paddingTop: '15px',
          textAlign: 'center',
        }}
      >
        <button
          onClick={handleReset}
          style={{
            background: 'none',
            border: 'none',
            color: '#999',
            fontSize: '11px',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          ⚙️ ローカルデータをリセット
        </button>
      </div>
    </div>
  )
}
