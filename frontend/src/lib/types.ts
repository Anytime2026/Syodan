export type CustomerProfile = {
  industry: string
  company_size: string
  role_title: string
  surface_need: string
  personality_type: string
  initial_awareness: number
  true_challenge?: string | null
}

export type CustomerState = {
  awareness_level: number
  rapport_level: number
  disclosed_info: string[]
  session_summaries: Array<{ session_number: number; summary: string }>
}

export type SessionListItem = {
  id: string
  session_number: number
  title: string | null
  status: string
  started_at: string | null
  ended_at: string | null
}

export type Evaluation = {
  id: string
  evaluator_id: string
  content: string
  created_at: string
}

export type OverallReview = {
  id: string
  evaluator_id: string
  content: string
  created_at: string
}

export type Program = {
  id: string
  field: string
  total_sessions: number
  status: string
  created_at: string
  reveal_challenge: boolean
  completed_sessions: number
  customer_profile?: CustomerProfile | null
  customer_state?: CustomerState | null
  sessions?: SessionListItem[]
  overall_reviews?: OverallReview[]
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
  transcript?: string | null
  evaluations?: Evaluation[]
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

export type CreateProgramInput = {
  field: string
  total_sessions: number
  personality_type?: string
  sub_field?: string
  it_knowledge_level?: string
}
