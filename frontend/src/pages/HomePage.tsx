import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LoadingScreen } from '../components/LoadingScreen'
import { PageSection, PageShell } from '../components/PageShell'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
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
  const showLoadingScreen = useDeferredLoading(loading)

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
    <PageShell width="narrow" brandLink={false}>
      <div className="page-hero">
        <img
          className="page-hero__image"
          src="/images/main.svg"
          alt=""
          draggable={false}
        />
        <div className="page-hero__text">
          <p className="page-hero__tagline">
            AI顧客を相手にした営業ヒアリングのロールプレイトレーニング。実践的な商談スキルを、くまトレーナーと一緒に鍛えましょう。
          </p>
        </div>
      </div>

      <div className="page-features" aria-hidden="true">
        <div className="page-feature">
          <img
            className="page-feature__icon"
            src="/images/danbell.svg"
            alt=""
            draggable={false}
          />
          <p className="page-feature__label">反復トレーニング</p>
        </div>
        <div className="page-feature">
          <img
            className="page-feature__icon"
            src="/images/board.svg"
            alt=""
            draggable={false}
          />
          <p className="page-feature__label">リアルな商談体験</p>
        </div>
        <div className="page-feature">
          <img
            className="page-feature__icon"
            src="/images/kouseizu.svg"
            alt=""
            draggable={false}
          />
          <p className="page-feature__label">段階的に成長</p>
        </div>
      </div>

      <Link to="/settings" className="btn primary" style={{ padding: '16px' }}>
        ▶ 新規商談作成
      </Link>

      {showLoadingScreen && (
        <LoadingScreen variant="inline" showLogo={false} message="読み込み中" />
      )}

      {!loading && activePrograms.length > 0 && (
        <PageSection>
          <p className="page-section__label">進行中のプログラム</p>
          <div className="page-list">
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
                  className="page-list__item page-list__item--oat"
                  onClick={() => setCurrentProgramId(registryId)}
                >
                  <p className="page-list__item-title">
                    {isCompleted ? (
                      <>
                        {INDUSTRY_META[industry]?.label} - 商談シリーズ完了
                        (総評を見る)
                      </>
                    ) : (
                      <>
                        {INDUSTRY_META[industry]?.label} - 進行中 (
                        {program.completed_sessions + 1} /{' '}
                        {program.total_sessions}回目)
                      </>
                    )}
                  </p>
                  <p className="page-list__item-meta">
                    作成日: {formatDate(program.created_at)}
                  </p>
                </Link>
              )
            })}
          </div>
        </PageSection>
      )}

      <Link to="/evaluations" className="btn primary">
        評価履歴・総評一覧
      </Link>

      <footer className="page-footer">
        <button
          type="button"
          className="page-footer__link"
          onClick={handleReset}
        >
          ローカルデータをリセット
        </button>
      </footer>
    </PageShell>
  )
}
