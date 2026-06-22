type ControlBarProps = {
  recording: boolean
  processing: boolean
  connected: boolean
  onPttDown: () => void
  onPttUp: () => void
  onEnd: () => void
}

export function ControlBar({
  recording,
  processing,
  connected,
  onPttDown,
  onPttUp,
  onEnd,
}: ControlBarProps) {
  const disabled = !connected || processing

  return (
    <footer className="control-bar">
      <button type="button" className="control-btn end-btn" onClick={onEnd}>
        終了
      </button>
      <button
        type="button"
        className={`control-btn ptt-btn ${recording ? 'active' : ''}`}
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault()
          onPttDown()
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          onPttUp()
        }}
        onPointerLeave={() => {
          if (recording) onPttUp()
        }}
      >
        {recording ? '話しています…' : processing ? 'AI応答中…' : '押して話す'}
      </button>
      <span className="connection-status">{connected ? '接続中' : '接続待ち'}</span>
    </footer>
  )
}
