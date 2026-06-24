import { useEffect, useState } from 'react'

const DEFAULT_DELAY_MS = 400

/** 一定時間以上かかる場合だけ true（短い読み込みではローディング UI を出さない） */
export function useDeferredLoading(
  isLoading: boolean,
  delayMs = DEFAULT_DELAY_MS,
): boolean {
  const [showLoading, setShowLoading] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      setShowLoading(true)
    }, delayMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isLoading, delayMs])

  return showLoading
}
