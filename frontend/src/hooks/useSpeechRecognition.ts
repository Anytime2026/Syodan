import { useState, useEffect, useCallback, useRef } from 'react'

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

interface UseSpeechRecognitionProps {
  onResult: (text: string) => void
}

export function useSpeechRecognition({ onResult }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const w = window as unknown as WindowWithSpeechRecognition
    const SpeechRecognitionConstructor =
      w.SpeechRecognition || w.webkitSpeechRecognition
    if (SpeechRecognitionConstructor) {
      try {
        const recognition = new SpeechRecognitionConstructor()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'ja-JP'

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript
          onResult(transcript)
          setIsListening(false)
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error', event.error)
          setIsListening(false)
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
      } catch (e) {
        console.error('Failed to initialize SpeechRecognition', e)
      }
    }
  }, [onResult])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true)
      recognitionRef.current.start()
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  const w =
    typeof window !== 'undefined'
      ? (window as unknown as WindowWithSpeechRecognition)
      : null
  return {
    isListening,
    startListening,
    stopListening,
    supported: !!(w && (w.SpeechRecognition || w.webkitSpeechRecognition)),
  }
}
