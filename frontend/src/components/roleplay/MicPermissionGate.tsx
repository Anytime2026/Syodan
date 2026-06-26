import { useMicrophonePermission } from '../../hooks/useMicrophonePermission'

type MicPermissionGateProps = {
  onGranted: () => void
}

export function MicPermissionGate({ onGranted }: MicPermissionGateProps) {
  const { error, requesting, request } = useMicrophonePermission()

  async function handleRequest() {
    const ok = await request()
    if (ok) onGranted()
  }

  return (
    <div className="mic-permission-gate" role="dialog" aria-modal="true">
      <div className="mic-permission-card">
        <h2>マイクの許可が必要です</h2>
        <p>
          ロールプレイでは音声入力を使います。会話を始める前にマイクへのアクセスを許可してください。
        </p>
        {error && <p className="setup-error">{error}</p>}
        <button
          type="button"
          className="control-btn ptt-btn mic-permission-btn"
          disabled={requesting}
          onClick={() => void handleRequest()}
        >
          {requesting ? '確認中…' : 'マイクを許可して開始'}
        </button>
      </div>
    </div>
  )
}
