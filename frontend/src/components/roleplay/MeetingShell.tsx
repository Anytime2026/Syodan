import './roleplay.css'

type MeetingShellProps = {
  children: React.ReactNode
  timerLabel: string
  timerWarning: boolean
  sessionInfo: string
}

export function MeetingShell({
  children,
  timerLabel,
  timerWarning,
  sessionInfo,
}: MeetingShellProps) {
  return (
    <div className="meeting-shell">
      <header className="meeting-header">
        <span className="meeting-title">ヒアリングセッション</span>
        <span className="meeting-info">{sessionInfo}</span>
        <span className={`meeting-timer ${timerWarning ? 'warning' : ''}`}>
          {timerLabel}
        </span>
      </header>
      <main className="meeting-main">{children}</main>
    </div>
  )
}
