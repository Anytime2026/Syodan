import { useCallback, useEffect, useRef, useState } from 'react'

type UsePushToTalkOptions = {
  onChunk: (chunk: Blob) => void | Promise<void>
  disabled?: boolean
}

export function usePushToTalk({ onChunk, disabled }: UsePushToTalkOptions) {
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    if (disabled || recording) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.start()
    setRecording(true)
  }, [disabled, recording])

  const stop = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve()
        return
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        chunksRef.current = []
        if (blob.size > 0) await onChunk(blob)
        stopTracks()
        recorderRef.current = null
        setRecording(false)
        resolve()
      }
      recorder.stop()
    })
  }, [onChunk, stopTracks])

  useEffect(() => () => stopTracks(), [stopTracks])

  return { recording, start, stop }
}
