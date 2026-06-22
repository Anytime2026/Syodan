type SpeakingIndicatorProps = {
  active: boolean
}

export function SpeakingIndicator({ active }: SpeakingIndicatorProps) {
  if (!active) return null
  return (
    <div className="speaking-indicator" aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}
