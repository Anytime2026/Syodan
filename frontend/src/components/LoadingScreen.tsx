import './LoadingScreen.css'

type LoadingScreenProps = {
  message?: string
  hint?: string
  variant?: 'fullscreen' | 'inline'
  showLogo?: boolean
  character?: 'default' | 'thinking'
}

export function LoadingScreen({
  message = '読み込み中',
  hint,
  variant = 'fullscreen',
  showLogo = variant === 'fullscreen',
  character = 'default',
}: LoadingScreenProps) {
  return (
    <div
      className={`loading-screen loading-screen--${variant}${
        character === 'thinking' ? ' loading-screen--thinking' : ''
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      {showLogo && (
        <img
          className="loading-screen__logo"
          src="/images/ServiceName.svg"
          alt="SalesGym"
          width={220}
          height={46}
          draggable={false}
        />
      )}

      <div className="loading-screen__stage" aria-hidden="true">
        {character === 'thinking' ? (
          <div className="loading-screen__thinking-wrap">
            <div className="loading-screen__questions">
              <img
                className="loading-screen__question loading-screen__question--1"
                src="/images/question.svg"
                alt=""
                width={28}
                height={47}
                draggable={false}
              />
              <img
                className="loading-screen__question loading-screen__question--2"
                src="/images/question.svg"
                alt=""
                width={28}
                height={47}
                draggable={false}
              />
              <img
                className="loading-screen__question loading-screen__question--3"
                src="/images/question.svg"
                alt=""
                width={28}
                height={47}
                draggable={false}
              />
            </div>
            <img
              className="loading-screen__thinking-bear"
              src="/images/thinking-bear-closeEyes.svg"
              alt=""
              width={120}
              height={137}
              draggable={false}
            />
          </div>
        ) : (
          <>
            <div className="loading-screen__bear">
              <img
                className="loading-screen__bear-frame loading-screen__bear-frame--open"
                src="/images/kuma-openMouce.svg"
                alt=""
                width={140}
                height={122}
                draggable={false}
              />
              <img
                className="loading-screen__bear-frame loading-screen__bear-frame--closed"
                src="/images/kuma-closeMouce.svg"
                alt=""
                width={140}
                height={122}
                draggable={false}
              />
            </div>
            <img
              className="loading-screen__levelup"
              src="/images/LevelUp.svg"
              alt=""
              width={52}
              height={75}
              draggable={false}
            />
          </>
        )}
      </div>

      <p className="loading-screen__message">
        <span className="loading-screen__message-text">{message}</span>
        <span className="loading-screen__dots" aria-hidden="true" />
      </p>
      {hint && <p className="loading-screen__hint">{hint}</p>}
    </div>
  )
}
