import { useCallback, useEffect, useRef, useState } from 'react'

import { getWsUrl } from '../lib/api'
import type { TranscriptMessage, WsServerMessage } from '../lib/types'

type UseHearingWebSocketOptions = {
  sessionId: string
  enabled: boolean
  onSessionEnded?: (reason: string) => void
}

export function useHearingWebSocket({
  sessionId,
  enabled,
  onSessionEnded,
}: UseHearingWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [aiSpeaking, setAiSpeaking] = useState(false)
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([])
  const [partialTranscript, setPartialTranscript] = useState<string | null>(
    null,
  )
  const [lastError, setLastError] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const nextStartTimeRef = useRef(0)
  const activeSourcesRef = useRef(0)

  const ensurePlaybackContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
      nextStartTimeRef.current = audioContextRef.current.currentTime
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume()
    }
    return audioContextRef.current
  }, [])

  const scheduleAudio = useCallback(
    async (blob: Blob) => {
      const ctx = ensurePlaybackContext()
      const arrayBuffer = await blob.arrayBuffer()
      let audioBuffer: AudioBuffer
      try {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
      } catch {
        setAiSpeaking(false)
        return
      }

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)

      const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current)
      source.start(startAt)
      nextStartTimeRef.current = startAt + audioBuffer.duration

      activeSourcesRef.current += 1
      setAiSpeaking(true)

      source.onended = () => {
        activeSourcesRef.current -= 1
        if (activeSourcesRef.current <= 0) {
          activeSourcesRef.current = 0
          setAiSpeaking(false)
        }
      }
    },
    [ensurePlaybackContext],
  )

  useEffect(() => {
    if (!enabled || !sessionId) return

    const ws = new WebSocket(getWsUrl(sessionId))
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        if (event.data.byteLength > 0) {
          await scheduleAudio(new Blob([event.data], { type: 'audio/mpeg' }))
        }
        return
      }
      const msg = JSON.parse(event.data as string) as WsServerMessage
      if (msg.type === 'transcript_partial') {
        setPartialTranscript(msg.text)
      }
      if (msg.type === 'transcript') {
        if (msg.speaker === 'user') {
          setPartialTranscript(null)
          setProcessing(true)
        }
        setTranscripts((prev) => [
          ...prev,
          { speaker: msg.speaker, text: msg.text },
        ])
        if (msg.speaker === 'ai') setProcessing(false)
      }
      if (msg.type === 'turn_complete') setProcessing(false)
      if (msg.type === 'session_ended') onSessionEnded?.(msg.reason)
      if (msg.type === 'error') {
        setLastError(msg.message)
        setProcessing(false)
        setPartialTranscript(null)
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
      audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
      activeSourcesRef.current = 0
    }
  }, [enabled, sessionId, onSessionEnded, scheduleAudio])

  const sendJson = useCallback((data: object) => {
    wsRef.current?.send(JSON.stringify(data))
  }, [])

  const sendAudioChunk = useCallback((chunk: ArrayBuffer) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(chunk)
    }
  }, [])

  const pttStart = useCallback(() => {
    sendJson({
      type: 'ptt_start',
      media_format: 'pcm_s16le',
      sample_rate: 16000,
    })
  }, [sendJson])

  const pttEnd = useCallback(() => {
    sendJson({ type: 'ptt_end', media_format: 'pcm_s16le' })
    setProcessing(true)
    setPartialTranscript(null)
  }, [sendJson])
  const ping = useCallback(() => sendJson({ type: 'ping' }), [sendJson])

  return {
    connected,
    processing,
    aiSpeaking,
    transcripts,
    partialTranscript,
    lastError,
    pttStart,
    pttEnd,
    sendAudioChunk,
    ping,
  }
}
