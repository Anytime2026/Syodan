import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ControlBar } from '../components/roleplay/ControlBar'
import { LoadingScreen } from '../components/LoadingScreen'
import { MeetingShell } from '../components/roleplay/MeetingShell'
import { ParticipantTile } from '../components/roleplay/ParticipantTile'
import { TranscriptDrawer } from '../components/roleplay/TranscriptDrawer'
import '../components/roleplay/roleplay.css'
import { useHearingWebSocket } from '../hooks/useHearingWebSocket'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import { usePingInterval, useSessionTimer } from '../hooks/useSessionTimer'
import { usePushToTalk } from '../hooks/usePushToTalk'
import { endSession, getApiBase, getProgram, getSession } from '../lib/api'
import type { HearingSession, Program } from '../lib/types'

export function RoleplayMeetingPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<HearingSession | null>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [ended, setEnded] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(true)
  const [userSpeaking, setUserSpeaking] = useState(false)
  const sessionLoading = !session && Boolean(sessionId)
  const showLoadingScreen = useDeferredLoading(sessionLoading)

  const handleSessionEnded = useCallback(
    async (reason: string) => {
      void reason
      if (!sessionId || ended) return
      setEnded(true)
      try {
        const updated = await endSession(sessionId)
        setSession(updated)
        const prog = await getProgram(updated.program_id)
        setProgram(prog)
      } catch {
        /* already ended */
      }
      navigate(`/evaluations/${sessionId}`)
    },
    [sessionId, ended, navigate],
  )

  const ws = useHearingWebSocket({
    sessionId: sessionId ?? '',
    enabled: Boolean(sessionId) && !ended,
    onSessionEnded: handleSessionEnded,
  })

  usePingInterval(ws.ping)

  const { label, warning, expired } = useSessionTimer(
    session?.started_at ?? null,
    session?.time_limit_minutes ?? 15,
  )

  const { recording, start, stop } = usePushToTalk({
    onChunk: ws.sendAudioChunk,
    disabled: ws.processing || ws.aiSpeaking || ended,
  })

  useEffect(() => {
    if (!sessionId) return
    getSession(sessionId)
      .then((s) => {
        setSession(s)
        return getProgram(s.program_id)
      })
      .then(setProgram)
      .catch(() => navigate('/settings'))
  }, [sessionId, navigate])

  useEffect(() => {
    if (expired && !ended && sessionId) {
      handleSessionEnded('timeout')
    }
  }, [expired, ended, sessionId, handleSessionEnded])

  useEffect(() => {
    const onUnload = () => {
      if (!sessionId || ended) return
      const base = getApiBase()
      fetch(`${base}/api/sessions/${sessionId}/abort`, {
        method: 'POST',
        keepalive: true,
      })
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [sessionId, ended])

  async function handleEnd() {
    if (!sessionId) return
    setEnded(true)
    try {
      const updated = await endSession(sessionId)
      setSession(updated)
      const prog = await getProgram(updated.program_id)
      setProgram(prog)
    } catch {
      /* ignore */
    }
    navigate(`/evaluations/${sessionId}`)
  }

  async function handlePttDown() {
    setUserSpeaking(true)
    ws.pttStart()
    await start()
  }

  async function handlePttUp() {
    setUserSpeaking(false)
    await stop()
    ws.pttEnd()
  }

  const customerName = program?.customer_profile?.name
  const customerRole = program?.customer_profile?.role_title ?? '見込み顧客'

  if (showLoadingScreen) {
    return <LoadingScreen message="セッションを読み込み中" />
  }

  if (sessionLoading) {
    return null
  }

  if (!session) {
    return null
  }

  if (ended) {
    return (
      <LoadingScreen
        message="セッションを終了しています"
        hint="評価画面へ移動します。しばらくお待ちください…"
      />
    )
  }

  return (
    <MeetingShell
      timerLabel={label}
      timerWarning={warning}
      sessionInfo={`第${session.session_number}回 — ${session.goal}`}
    >
      <div className="participant-grid">
        <ParticipantTile
          name="あなた"
          role="営業担当"
          speaking={userSpeaking}
          avatarLabel="営"
        />
        <ParticipantTile
          name={customerName ? `${customerName} 様` : '顧客AI'}
          role={customerRole}
          speaking={ws.aiSpeaking}
          avatarLabel={customerName ? customerName.charAt(0) : '顧'}
        />
      </div>
      <TranscriptDrawer
        messages={ws.transcripts}
        partialText={ws.partialTranscript}
        open={transcriptOpen}
        onToggle={() => setTranscriptOpen((o) => !o)}
      />
      {ws.lastError && <p className="setup-error">{ws.lastError}</p>}
      <ControlBar
        recording={recording}
        processing={ws.processing}
        connected={ws.connected}
        onPttDown={handlePttDown}
        onPttUp={handlePttUp}
        onEnd={handleEnd}
      />
    </MeetingShell>
  )
}
