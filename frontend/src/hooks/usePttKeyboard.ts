import { useEffect, useRef } from 'react'

type UsePttKeyboardOptions = {
  enabled: boolean
  disabled: boolean
  onPttDown: () => void
  onPttUp: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function usePttKeyboard({
  enabled,
  disabled,
  onPttDown,
  onPttUp,
}: UsePttKeyboardOptions) {
  const keyboardActiveRef = useRef(false)
  const onPttDownRef = useRef(onPttDown)
  const onPttUpRef = useRef(onPttUp)

  onPttDownRef.current = onPttDown
  onPttUpRef.current = onPttUp

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (disabled || isEditableTarget(e.target)) return
      e.preventDefault()
      if (e.repeat || keyboardActiveRef.current) return
      keyboardActiveRef.current = true
      onPttDownRef.current()
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (!keyboardActiveRef.current) return
      e.preventDefault()
      keyboardActiveRef.current = false
      onPttUpRef.current()
    }

    const onBlur = () => {
      if (!keyboardActiveRef.current) return
      keyboardActiveRef.current = false
      onPttUpRef.current()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [enabled, disabled])

  useEffect(() => {
    if (!enabled || !disabled) return
    if (!keyboardActiveRef.current) return
    keyboardActiveRef.current = false
    onPttUpRef.current()
  }, [enabled, disabled])
}
