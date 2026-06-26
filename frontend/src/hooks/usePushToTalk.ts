import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const TARGET_SAMPLE_RATE = 16000
const CHUNK_SAMPLES = 4096 // ~256ms at 16kHz

type UsePushToTalkOptions = {
  onChunk: (chunk: ArrayBuffer) => void | Promise<void>
  disabled?: boolean
  pressedRef?: RefObject<boolean>
}

function floatTo16BitPcm(input: Float32Array): ArrayBuffer {
  const pcm = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return pcm.buffer
}

function downsampleBuffer(
  buffer: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  if (inputRate === outputRate) return buffer
  const ratio = inputRate / outputRate
  const outLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const idx = i * ratio
    const i0 = Math.floor(idx)
    const i1 = Math.min(i0 + 1, buffer.length - 1)
    const frac = idx - i0
    result[i] = buffer[i0] * (1 - frac) + buffer[i1] * frac
  }
  return result
}

function isStreamUsable(stream: MediaStream | null): stream is MediaStream {
  return Boolean(
    stream?.active &&
      stream.getAudioTracks().some((track) => track.readyState === 'live'),
  )
}

export function usePushToTalk({
  onChunk,
  disabled,
  pressedRef,
}: UsePushToTalkOptions) {
  const [recording, setRecording] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const pendingRef = useRef<Float32Array[]>([])
  const sampleCountRef = useRef(0)
  const startingRef = useRef(false)

  const disconnectProcessor = useCallback(() => {
    processorRef.current?.disconnect()
    processorRef.current = null
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    pendingRef.current = []
    sampleCountRef.current = 0
    setRecording(false)
  }, [])

  const releaseStream = useCallback(() => {
    disconnectProcessor()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [disconnectProcessor])

  const flushChunk = useCallback(
    async (samples: Float32Array) => {
      const pcm = floatTo16BitPcm(samples)
      await onChunk(pcm)
    },
    [onChunk],
  )

  const start = useCallback(async (): Promise<boolean> => {
    if (disabled || recording || startingRef.current) return false
    startingRef.current = true

    try {
      let stream = streamRef.current
      if (!isStreamUsable(stream)) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          streamRef.current = stream
        } catch {
          startingRef.current = false
          return false
        }
      }

      if (pressedRef && !pressedRef.current) {
        startingRef.current = false
        return false
      }

      const context = new AudioContext()
      audioContextRef.current = context
      const inputRate = context.sampleRate

      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(CHUNK_SAMPLES, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        const downsampled = downsampleBuffer(input, inputRate, TARGET_SAMPLE_RATE)
        pendingRef.current.push(downsampled)
        sampleCountRef.current += downsampled.length

        if (sampleCountRef.current >= CHUNK_SAMPLES) {
          const merged = new Float32Array(sampleCountRef.current)
          let offset = 0
          for (const part of pendingRef.current) {
            merged.set(part, offset)
            offset += part.length
          }
          const chunk = merged.subarray(0, CHUNK_SAMPLES)
          const remainder = merged.subarray(CHUNK_SAMPLES)
          pendingRef.current = remainder.length > 0 ? [remainder] : []
          sampleCountRef.current = remainder.length
          void flushChunk(chunk)
        }
      }

      source.connect(processor)
      processor.connect(context.destination)

      if (pressedRef && !pressedRef.current) {
        disconnectProcessor()
        startingRef.current = false
        return false
      }

      setRecording(true)
      startingRef.current = false
      return true
    } catch {
      disconnectProcessor()
      startingRef.current = false
      return false
    }
  }, [disabled, recording, flushChunk, pressedRef, disconnectProcessor])

  const stop = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      const wasActive = recording || processorRef.current !== null
      if (!wasActive) {
        resolve(false)
        return
      }

      const processor = processorRef.current
      if (processor) {
        processor.onaudioprocess = null
      }

      if (sampleCountRef.current > 0 && pendingRef.current.length > 0) {
        const total = pendingRef.current.reduce((n, part) => n + part.length, 0)
        const merged = new Float32Array(total)
        let offset = 0
        for (const part of pendingRef.current) {
          merged.set(part, offset)
          offset += part.length
        }
        void flushChunk(merged).finally(() => {
          disconnectProcessor()
          resolve(wasActive)
        })
        return
      }

      disconnectProcessor()
      resolve(wasActive)
    })
  }, [recording, flushChunk, disconnectProcessor])

  useEffect(() => () => releaseStream(), [releaseStream])

  return { recording, start, stop }
}
