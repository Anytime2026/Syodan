import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ControlBar } from '../components/roleplay/ControlBar'
import { LoadingScreen } from '../components/LoadingScreen'
import { MeetingShell } from '../components/roleplay/MeetingShell'
import { MicPermissionGate } from '../components/roleplay/MicPermissionGate'
import { ParticipantTile } from '../components/roleplay/ParticipantTile'
import { TranscriptDrawer } from '../components/roleplay/TranscriptDrawer'
import '../components/roleplay/roleplay.css'
import { useHearingWebSocket } from '../hooks/useHearingWebSocket'
import { useDeferredLoading } from '../hooks/useDeferredLoading'
import { isMicrophoneGranted } from '../hooks/useMicrophonePermission'
import { usePingInterval, useSessionTimer } from '../hooks/useSessionTimer'
import { usePttKeyboard } from '../hooks/usePttKeyboard'
import { usePushToTalk } from '../hooks/usePushToTalk'
import {
  abortSession,
  endSession,
  getApiBase,
  getProgram,
  getSession,
} from '../lib/api'
import type { HearingSession, Program } from '../lib/types'

export function RoleplayMeetingPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<HearingSession | null>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [ended, setEnded] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(
    () =>
      typeof window !== 'undefined' &&
      !window.matchMedia('(max-width: 576px)').matches,
  )
  const [userSpeaking, setUserSpeaking] = useState(false)
  const [micReady, setMicReady] = useState(isMicrophoneGranted)
  const pttPressedRef = useRef(false)
  const pttActiveRef = useRef(false)
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
        try {
          await abortSession(sessionId)
        } catch {
          /* already ended or aborted */
        }
      }
      navigate(`/evaluations/${sessionId}`)
    },
    [sessionId, ended, navigate],
  )

  const ws = useHearingWebSocket({
    sessionId: sessionId ?? '',
    enabled: Boolean(sessionId) && !ended && micReady,
    onSessionEnded: handleSessionEnded,
  })

  usePingInterval(ws.ping)

  const { label, warning } = useSessionTimer(
    session?.started_at ?? null,
    session?.time_limit_minutes ?? 15,
  )

  const { recording, start, stop } = usePushToTalk({
    onChunk: ws.sendAudioChunk,
    disabled: ws.processing || ws.aiSpeaking || ended,
    pressedRef: pttPressedRef,
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

  useEffect(() => {
    return () => {
      if (!sessionId || ended) return
      void abortSession(sessionId)
    }
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
      try {
        await abortSession(sessionId)
      } catch {
        /* ignore */
      }
    }
    navigate(`/evaluations/${sessionId}`)
  }

  const handlePttDown = useCallback(async () => {
    pttPressedRef.current = true
    void ws.primeAudioPlayback()
    const ok = await start()
    if (!ok || !pttPressedRef.current) {
      setUserSpeaking(false)
      if (ok) await stop()
      return
    }
    ws.pttStart()
    pttActiveRef.current = true
    setUserSpeaking(true)
  }, [ws, start, stop])

  const handlePttUp = useCallback(async () => {
    pttPressedRef.current = false
    setUserSpeaking(false)
    const wasActive = await stop()
    if (pttActiveRef.current || wasActive) {
      ws.pttEnd()
      pttActiveRef.current = false
    }
  }, [ws, stop])

  const pttDisabled = !ws.connected || ws.processing || ws.aiSpeaking

  usePttKeyboard({
    enabled: Boolean(session) && !ended && micReady,
    disabled: pttDisabled,
    onPttDown: handlePttDown,
    onPttUp: handlePttUp,
  })

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

  if (!micReady) {
    return <MicPermissionGate onGranted={() => setMicReady(true)} />
  }

  return (
    <MeetingShell
      timerLabel={label}
      timerWarning={warning}
      sessionInfo={`第${session.session_number}回 — ${session.goal}`}
    >
      <div className="meeting-stage">
        <div className="meeting-content-area">
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
          {ws.lastError && (
            <p className="meeting-error setup-error">{ws.lastError}</p>
          )}
        </div>
        <ControlBar
          recording={recording}
          processing={ws.processing}
          aiSpeaking={ws.aiSpeaking}
          connected={ws.connected}
          onPttDown={handlePttDown}
          onPttUp={handlePttUp}
          onEnd={handleEnd}
        />
      </div>
    </MeetingShell>
  )
}
