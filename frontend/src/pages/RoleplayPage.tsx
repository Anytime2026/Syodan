import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendMessage } from '../services/api'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { INDUSTRY_META } from '../types'
import type { ChatMessage, Program } from '../types'

export function RoleplayPage() {
  const navigate = useNavigate()
  const [program, setProgram] = useState<Program | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300) // Default 5 mins in seconds
  const chatEndRef = useRef<HTMLDivElement>(null)

  const { speak, stop: stopSpeaking } = useSpeechSynthesis()
  const { isListening, startListening, stopListening } = useSpeechRecognition({
    onResult: (text) => setInput(text)
  })
useEffect(() => {
  const programId = localStorage.getItem('syodan_current_program_id')
  const savedPrograms = localStorage.getItem('syodan_programs')

  if (programId && savedPrograms) {
    try {
      const programs: Program[] = JSON.parse(savedPrograms)
      const current = programs.find(p => p.id === programId)
      if (current) {
        setProgram(current)
        setTimeLeft(5 * 60) // Simple default for now
      }
    } catch (e) {
      console.error("Failed to parse programs", e)
    }
  }

  const savedMessages = localStorage.getItem('syodan_messages')
  if (savedMessages) {
    try {
      setMessages(JSON.parse(savedMessages))
    } catch (e) {
      console.error("Failed to parse messages", e)
    }
  } else if (programId && savedPrograms) {
    try {
      const programs: Program[] = JSON.parse(savedPrograms)
      const current = programs.find(p => p.id === programId)
      if (current) {
        const meta = INDUSTRY_META[current.industry]
        setMessages([{ role: 'assistant', content: meta.initialGreeting }])
      }
    } catch (e) {
      console.error("Failed to parse programs for initial greeting", e)
    }
  }
}, [])


  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    localStorage.setItem('syodan_messages', JSON.stringify(messages))
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSend = async (text = input) => {
    const targetText = text.trim()
    if (!targetText || !program || loading) return
    
    stopSpeaking()
    const userMsg: ChatMessage = { role: 'user', content: targetText }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await sendMessage(program.id, targetText, updatedMessages, program.industry)
      const aiMsg: ChatMessage = { role: 'assistant', content: response.message }
      setMessages(prev => [...prev, aiMsg])
      speak(response.message)
    } catch (error) {
      console.error("API Error:", error)
      setMessages(prev => [...prev, { role: 'assistant', content: "（エラーが発生しました。サーバーの状態を確認してください）" }])
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = () => {
    if (!program) return
    
    // Update program status
    let isAllFinished = false
    const saved = localStorage.getItem('syodan_programs')
    if (saved) {
      const programs: Program[] = JSON.parse(saved)
      const updated = programs.map(p => {
        if (p.id === program.id) {
          const newCount = p.currentSessionCount + 1
          if (newCount >= p.totalSessions) {
            isAllFinished = true
            return { ...p, currentSessionCount: newCount, status: 'completed' }
          }
          return { ...p, currentSessionCount: newCount }
        }
        return p
      })
      localStorage.setItem('syodan_programs', JSON.stringify(updated))
    }

    // Save session summary (mock)
    const sessionData = {
      id: localStorage.getItem('syodan_current_session_id'),
      programId: program.id,
      industry: program.industry,
      sessionNumber: program.currentSessionCount + 1,
      createdAt: new Date().toISOString(),
      transcript: messages.map(m => `${m.role}: ${m.content}`).join('\n')
    }
    localStorage.setItem(`syodan_session_result_${sessionData.id}`, JSON.stringify(sessionData))

    if (isAllFinished) {
      navigate('/overall-review')
    } else {
      navigate('/evaluations')
    }
  }

  if (!program) return <div>読み込み中...</div>

  const meta = INDUSTRY_META[program.industry]

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <div>
          <h2 style={{ margin: 0 }}>{meta.personName} {meta.honorific}</h2>
          <p className="small" style={{ margin: 0 }}>{meta.company}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="small" style={{ fontWeight: 'bold', color: timeLeft < 60 ? '#ff4b4b' : '#1C75BC' }}>
            残り時間: {formatTime(timeLeft)}
          </span>
          <p className="small" style={{ margin: 0 }}>第 {program.currentSessionCount + 1} 回</p>
        </div>
      </div>

      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'ai'}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="msg ai">......</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="input-group">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="PTT（長押し）または入力"
          disabled={loading}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button 
          className={`mic-btn ${isListening ? 'active' : ''}`} 
          onMouseDown={() => { stopSpeaking(); startListening(); }}
          onMouseUp={() => { stopListening(); }}
          onMouseLeave={() => { if (isListening) stopListening(); }}
          title="プッシュトゥトーク（長押しで録音）"
        >
          {isListening ? '🛑' : '🎤'}
        </button>
      </div>
      
      <button className="btn cta" onClick={() => handleSend()} disabled={loading}>
        {loading ? '送信中...' : '送信'}
      </button>

      <button className="btn secondary" onClick={handleFinish}>商談を終了する</button>
    </div>
  )
}
