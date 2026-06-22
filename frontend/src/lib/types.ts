export type Program = {
  id: string
  field: string
  total_sessions: number
  status: string
  created_at: string
  reveal_challenge: boolean
  completed_sessions: number
  customer_profile?: {
    industry: string
    company_size: string
    role_title: string
    surface_need: string
    personality_type: string
    initial_awareness: number
    true_challenge?: string | null
  }
}

export type HearingSession = {
  id: string
  program_id: string
  session_number: number
  goal: string
  time_limit_minutes: number
  title: string | null
  status: string
  started_at: string | null
  ended_at: string | null
}

export type TranscriptMessage = {
  speaker: 'user' | 'ai'
  text: string
}

export type WsServerMessage =
  | { type: 'transcript'; speaker: 'user' | 'ai'; text: string }
  | { type: 'turn_complete' }
  | { type: 'time_warning'; remaining_sec: number }
  | { type: 'session_ended'; reason: string }
  | { type: 'error'; message: string }
