import { useCallback, useState } from 'react'

const MIC_GRANTED_KEY = 'syodan-mic-granted'

function micErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'マイクの使用が拒否されました。ブラウザの設定から許可してください。'
    }
    if (err.name === 'NotFoundError') {
      return 'マイクが見つかりません。デバイスを確認してください。'
    }
  }
  return 'マイクへのアクセスに失敗しました。'
}

export async function requestMicrophoneAccess(): Promise<{
  ok: boolean
  error?: string
}> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: 'このブラウザはマイク入力に対応していません。' }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    sessionStorage.setItem(MIC_GRANTED_KEY, '1')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: micErrorMessage(err) }
  }
}

export function isMicrophoneGranted(): boolean {
  return sessionStorage.getItem(MIC_GRANTED_KEY) === '1'
}

export function useMicrophonePermission() {
  const [granted, setGranted] = useState(isMicrophoneGranted)
  const [error, setError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)

  const request = useCallback(async () => {
    setRequesting(true)
    setError(null)
    const result = await requestMicrophoneAccess()
    if (result.ok) {
      setGranted(true)
    } else {
      setError(result.error ?? 'マイクの許可が必要です')
    }
    setRequesting(false)
    return result.ok
  }, [])

  return { granted, error, requesting, request }
}
