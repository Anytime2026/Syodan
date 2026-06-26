import { useCallback, useEffect, useRef, useState } from 'react'

import { getWsUrl } from '../lib/api'
import type { TranscriptMessage, WsServerMessage } from '../lib/types'

type UseHearingWebSocketOptions = {
  sessionId: string
  enabled: boolean
  onSessionEnded?: (reason: string) => void
}

const FALLBACK_BUFFER_MS = 500

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
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const useHtmlAudioRef = useRef(false)

  const clearAiSpeaking = useCallback(() => {
    activeSourcesRef.current = 0
    setAiSpeaking(false)
  }, [])

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }, [])

  const scheduleFallbackClear = useCallback(() => {
    clearFallbackTimer()
    const ctx = audioContextRef.current
    const remainingMs = ctx
      ? Math.max(0, (nextStartTimeRef.current - ctx.currentTime) * 1000) +
        FALLBACK_BUFFER_MS
      : FALLBACK_BUFFER_MS
    fallbackTimerRef.current = setTimeout(() => {
      clearAiSpeaking()
      fallbackTimerRef.current = null
    }, remainingMs)
  }, [clearAiSpeaking, clearFallbackTimer])

  const ensurePlaybackContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
      nextStartTimeRef.current = audioContextRef.current.currentTime
    }
    return audioContextRef.current
  }, [])

  const primeAudioPlayback = useCallback(async () => {
    const ctx = ensurePlaybackContext()
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        useHtmlAudioRef.current = true
      }
    }
  }, [ensurePlaybackContext])

  const playWithHtmlAudio = useCallback(
    (blob: Blob) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      activeSourcesRef.current += 1
      setAiSpeaking(true)

      const onDone = () => {
        URL.revokeObjectURL(url)
        activeSourcesRef.current -= 1
        if (activeSourcesRef.current <= 0) {
          activeSourcesRef.current = 0
          setAiSpeaking(false)
        }
      }

      audio.addEventListener('ended', onDone, { once: true })
      audio.addEventListener(
        'error',
        () => {
          onDone()
        },
        { once: true },
      )

      void audio.play().catch(() => {
        useHtmlAudioRef.current = true
        onDone()
      })
    },
    [],
  )

  const scheduleWebAudio = useCallback(
    async (blob: Blob, ctx: AudioContext) => {
      const arrayBuffer = await blob.arrayBuffer()
      let audioBuffer: AudioBuffer
      try {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
      } catch {
        playWithHtmlAudio(blob)
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
    [playWithHtmlAudio],
  )

  const scheduleAudio = useCallback(
    async (blob: Blob) => {
      const ctx = ensurePlaybackContext()

      if (useHtmlAudioRef.current) {
        playWithHtmlAudio(blob)
        return
      }

      if (ctx.state === 'suspended') {
        try {
          await ctx.resume()
        } catch {
          useHtmlAudioRef.current = true
          playWithHtmlAudio(blob)
          return
        }
      }

      if (ctx.state === 'suspended') {
        useHtmlAudioRef.current = true
        playWithHtmlAudio(blob)
        return
      }

      await scheduleWebAudio(blob, ctx)
    },
    [ensurePlaybackContext, playWithHtmlAudio, scheduleWebAudio],
  )

  useEffect(() => {
    if (!enabled || !sessionId) return

    const ws = new WebSocket(getWsUrl(sessionId))
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      clearFallbackTimer()
      clearAiSpeaking()
    }
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
      if (msg.type === 'turn_complete') {
        setProcessing(false)
        scheduleFallbackClear()
      }
      if (msg.type === 'session_ended') onSessionEnded?.(msg.reason)
      if (msg.type === 'error') {
        setLastError(msg.message)
        setProcessing(false)
        setPartialTranscript(null)
        clearFallbackTimer()
        clearAiSpeaking()
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
      clearFallbackTimer()
      audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
      activeSourcesRef.current = 0
      useHtmlAudioRef.current = false
    }
  }, [
    enabled,
    sessionId,
    onSessionEnded,
    scheduleAudio,
    scheduleFallbackClear,
    clearAiSpeaking,
    clearFallbackTimer,
  ])

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
    primeAudioPlayback,
  }
}
