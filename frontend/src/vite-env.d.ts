/// <reference types="vite/client" />

interface SpeechRecognitionResult {
  readonly transcript: string
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionAlternativeList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResultEntry {
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeList
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultEntry
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
    | null
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
    | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  start(): void
  stop(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}
