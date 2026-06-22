import type { CreateProgramInput, HearingSession, Program, SessionListItem } from './types'

/** 開発時は Vite プロキシ経由（同一オリジン）で CORS を回避 */
export function getApiBase(): string {
  if (import.meta.env.DEV) return ''
  return (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
}

export function getWsBase(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  if (import.meta.env.DEV) {
    const { protocol, host } = window.location
    return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`
  }

  const api = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
  if (api.startsWith('https://')) return `wss://${api.slice('https://'.length)}`
  if (api.startsWith('http://')) return `ws://${api.slice('http://'.length)}`
  return api
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function createProgram(input: CreateProgramInput): Promise<Program> {
  return request<Program>('/api/programs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getProgram(programId: string): Promise<Program> {
  return request<Program>(`/api/programs/${programId}`)
}

export function listSessions(programId: string): Promise<SessionListItem[]> {
  return request<SessionListItem[]>(`/api/programs/${programId}/sessions`)
}

export function createSession(
  programId: string,
  goal: string,
  timeLimitMinutes: number,
): Promise<HearingSession> {
  return request<HearingSession>(`/api/programs/${programId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ goal, time_limit_minutes: timeLimitMinutes }),
  })
}

export function startSession(sessionId: string): Promise<HearingSession> {
  return request<HearingSession>(`/api/sessions/${sessionId}/start`, { method: 'POST' })
}

export function endSession(sessionId: string): Promise<HearingSession> {
  return request<HearingSession>(`/api/sessions/${sessionId}/end`, { method: 'POST' })
}

export function abortSession(sessionId: string): Promise<HearingSession> {
  return request<HearingSession>(`/api/sessions/${sessionId}/abort`, { method: 'POST' })
}

export function getSession(sessionId: string): Promise<HearingSession> {
  return request<HearingSession>(`/api/sessions/${sessionId}`)
}

export function getWsUrl(sessionId: string): string {
  return `${getWsBase()}/ws/sessions/${sessionId}/hearing`
}

/** 評価一覧に表示するセッション status */
export const EVALUABLE_SESSION_STATUSES = new Set([
  'evaluation_requested',
  'evaluated',
  'completed',
])

/** 進行中とみなす program status */
export const ACTIVE_PROGRAM_STATUSES = new Set([
  'created',
  'in_progress',
  'all_sessions_done',
  'overall_review_requested',
])
