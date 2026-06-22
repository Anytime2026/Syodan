import { useEffect, useRef, useState } from 'react'

export function useSessionTimer(startedAt: string | null, limitMinutes: number) {
  const [remainingSec, setRemainingSec] = useState(limitMinutes * 60)

  useEffect(() => {
    if (!startedAt) {
      setRemainingSec(limitMinutes * 60)
      return
    }
    const start = new Date(startedAt).getTime()
    const total = limitMinutes * 60

    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      setRemainingSec(Math.max(0, total - elapsed))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [startedAt, limitMinutes])

  const minutes = Math.floor(remainingSec / 60)
  const seconds = remainingSec % 60
  const label = `${minutes}:${seconds.toString().padStart(2, '0')}`
  const warning = remainingSec <= 300 && remainingSec > 0

  return { remainingSec, label, warning, expired: remainingSec <= 0 }
}

export function usePingInterval(sendPing: () => void, intervalMs = 5000) {
  const sendRef = useRef(sendPing)
  sendRef.current = sendPing

  useEffect(() => {
    const id = window.setInterval(() => sendRef.current(), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
}
