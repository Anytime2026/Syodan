import type {
  CreateProgramInput,
  Evaluation,
  EvaluationSubmitInput,
  HearingSession,
  OverallReview,
  OverallReviewPageData,
  Program,
  ReviewPageData,
  SessionListItem,
} from './types'

/** 開発時・Cloudflare Pages 本番は同一オリジン（Vite / Pages Functions プロキシ） */
export function getApiBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL
  if (import.meta.env.DEV || !base) return ''
  return base.replace(/\/$/, '')
}

export function getWsBase(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const api = import.meta.env.VITE_API_BASE_URL
  if (!api || import.meta.env.DEV) {
    const { protocol, host } = window.location
    return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`
  }

  if (api.startsWith('https://')) return `wss://${api.slice('https://'.length)}`
  if (api.startsWith('http://')) return `ws://${api.slice('http://'.length)}`
  return api
}

/** FastAPI のエラーレスポンスから表示用メッセージを抽出 */
export function parseApiErrorMessage(body: string, status?: number): string {
  if (!body) return status ? `HTTP ${status}` : 'リクエストに失敗しました'
  try {
    const parsed = JSON.parse(body) as { detail?: unknown }
    if (typeof parsed.detail === 'string') return parsed.detail
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((item) =>
          typeof item === 'object' && item && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : String(item),
        )
        .join(', ')
    }
  } catch {
    /* plain text */
  }
  return body
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(parseApiErrorMessage(body, res.status))
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
  return request<HearingSession>(`/api/sessions/${sessionId}/start`, {
    method: 'POST',
  })
}

export function endSession(sessionId: string): Promise<HearingSession> {
  return request<HearingSession>(`/api/sessions/${sessionId}/end`, {
    method: 'POST',
  })
}

export function abortSession(sessionId: string): Promise<HearingSession> {
  return request<HearingSession>(`/api/sessions/${sessionId}/abort`, {
    method: 'POST',
  })
}

export function getSession(sessionId: string): Promise<HearingSession> {
  return request<HearingSession>(`/api/sessions/${sessionId}`)
}

export function getWsUrl(sessionId: string): string {
  return `${getWsBase()}/ws/sessions/${sessionId}/hearing`
}

export function getReviewPage(token: string): Promise<ReviewPageData> {
  return request<ReviewPageData>(`/api/review/${token}`)
}

export function submitSessionEvaluation(
  token: string,
  body: EvaluationSubmitInput,
): Promise<Evaluation> {
  return request(`/api/review/${token}/evaluations`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getOverallReviewPage(
  token: string,
): Promise<OverallReviewPageData> {
  return request<OverallReviewPageData>(`/api/review/overall/${token}`)
}

export function submitOverallReview(
  token: string,
  body: EvaluationSubmitInput,
): Promise<OverallReview> {
  return request(`/api/review/overall/${token}/reviews`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
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

export async function uploadProgramMaterial(
  programId: string,
  file: File,
): Promise<Program> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(
    `${getApiBase()}/api/programs/${programId}/upload-material`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(parseApiErrorMessage(body, res.status))
  }

  return res.json() as Promise<Program>
}
