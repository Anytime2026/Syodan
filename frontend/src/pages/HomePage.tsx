import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section>
      <h1>商談ロープレAI</h1>
      <p>顧客AIとの商談練習を始めましょう。</p>
      <ul>
        <li>
          <Link to="/settings">ペルソナ・ユーザー設定</Link>
        </li>
        <li>
          <Link to="/roleplay/setup">ロープレを開始</Link>
        </li>
        <li>
          <Link to="/evaluations">過去の評価を見る</Link>
        </li>
      </ul>
    </section>
  )
}
