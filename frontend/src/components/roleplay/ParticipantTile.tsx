import { SpeakingIndicator } from './SpeakingIndicator'

type ParticipantTileProps = {
  name: string
  role: string
  speaking: boolean
  muted?: boolean
  avatarLabel: string
}

export function ParticipantTile({ name, role, speaking, muted, avatarLabel }: ParticipantTileProps) {
  return (
    <div className={`participant-tile ${speaking ? 'speaking' : ''}`}>
      <SpeakingIndicator active={speaking} />
      <div className="participant-avatar">{avatarLabel}</div>
      <div className="participant-meta">
        <span className="participant-name">{name}</span>
        <span className="participant-role">{role}</span>
        {muted && <span className="participant-badge">ミュート</span>}
      </div>
    </div>
  )
}
