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
  return (
    <aside className={`transcript-drawer ${open ? 'open' : ''}`}>
      <button type="button" className="transcript-toggle" onClick={onToggle}>
        {open ? '字幕を閉じる' : '字幕を表示'}
      </button>
      {open && (
        <ul className="transcript-list">
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
