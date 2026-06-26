import type { TranscriptMessage } from '../../lib/types'

type TranscriptDrawerProps = {
  messages: TranscriptMessage[]
  partialText?: string | null
  open: boolean
  onToggle: () => void
}

export function TranscriptDrawer({
  messages,
  partialText,
  open,
  onToggle,
}: TranscriptDrawerProps) {
  const hasContent = messages.length > 0 || Boolean(partialText)

  return (
    <aside
      className={`transcript-drawer ${open ? 'open' : 'collapsed'}`}
      aria-label="会話字幕"
    >
      <button
        type="button"
        className="transcript-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        {open ? '字幕を閉じる' : hasContent ? '字幕を表示' : '字幕'}
      </button>
      {open && (
        <ul className="transcript-list">
          {messages.length === 0 && !partialText && (
            <li className="transcript-empty">会話が始まるとここに表示されます</li>
          )}
          {messages.map((m, i) => (
            <li key={i} className={m.speaker}>
              <strong>{m.speaker === 'user' ? 'あなた' : '顧客AI'}:</strong>{' '}
              {m.text}
            </li>
          ))}
          {partialText && (
            <li className="user partial">
              <strong>あなた:</strong> {partialText}
            </li>
          )}
        </ul>
      )}
    </aside>
  )
}
