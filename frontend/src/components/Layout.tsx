import { NavLink, Outlet } from 'react-router-dom'
import './Layout.css'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link--active' : 'nav-link'

export function Layout() {
  return (
    <div className="layout">
      <header className="layout__header">
        <nav className="layout__nav">
          <NavLink to="/" className={navLinkClass} end>
            ホーム
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            設定
          </NavLink>
          <NavLink to="/roleplay/setup" className={navLinkClass}>
            ロープレ
          </NavLink>
          <NavLink to="/evaluations" className={navLinkClass}>
            評価一覧
          </NavLink>
        </nav>
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  )
}
