import { useRef } from 'react'

type ControlBarProps = {
  recording: boolean
  processing: boolean
  aiSpeaking: boolean
  connected: boolean
  onPttDown: () => void
  onPttUp: () => void
  onEnd: () => void
}

const isTouchDevice =
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches

function pttLabel(
  recording: boolean,
  processing: boolean,
  aiSpeaking: boolean,
): string {
  if (recording) return '話しています…'
  if (aiSpeaking) return 'AI話し中…'
  if (processing) return 'AI応答中…'
  return isTouchDevice ? '押し続けて話す' : '押して話す（Space）'
}

export function ControlBar({
  recording,
  processing,
  aiSpeaking,
  connected,
  onPttDown,
  onPttUp,
  onEnd,
}: ControlBarProps) {
  const disabled = !connected || processing || aiSpeaking
  const pttButtonRef = useRef<HTMLButtonElement>(null)

  const releaseCapture = (pointerId: number) => {
    const button = pttButtonRef.current
    if (button?.hasPointerCapture(pointerId)) {
      button.releasePointerCapture(pointerId)
    }
  }

  return (
    <footer className="control-bar" aria-label="会話操作">
      <div className="control-bar-secondary">
        <button type="button" className="control-btn end-btn" onClick={onEnd}>
          終了
        </button>
        <span
          className={`connection-status ${connected ? 'connected' : ''}`}
          aria-live="polite"
        >
          {connected ? '接続中' : '接続待ち'}
        </span>
      </div>
      <button
        ref={pttButtonRef}
        type="button"
        className={`control-btn ptt-btn ${recording ? 'active' : ''}`}
        disabled={disabled}
        aria-label={pttLabel(recording, processing, aiSpeaking)}
        onPointerDown={(e) => {
          if (disabled) return
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          onPttDown()
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          releaseCapture(e.pointerId)
          onPttUp()
        }}
        onPointerCancel={(e) => {
          releaseCapture(e.pointerId)
          onPttUp()
        }}
        onPointerLeave={(e) => {
          if (!recording) return
          if (e.currentTarget.hasPointerCapture(e.pointerId)) return
          onPttUp()
        }}
      >
        {pttLabel(recording, processing, aiSpeaking)}
      </button>
    </footer>
  )
}
