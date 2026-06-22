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
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Zoom Layout options
  const [videoActive, setVideoActive] = useState(true)
  const [micMuted, setMicMuted] = useState(false)
  const [chatVisible, setChatVisible] = useState(true)
  const [subtitleText, setSubtitleText] = useState('')

  // Media references
  const videoRef = useRef<HTMLVideoElement>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)

  const { speak, stop: stopSpeaking, speaking: aiSpeaking } = useSpeechSynthesis()
  const { isListening, startListening, stopListening } = useSpeechRecognition({
    onResult: (text) => {
      setInput(text)
      setSubtitleText(`あなた: "${text}"`)
      handleSend(text)
    }
  })

  // Timer & Auto-close subtitles
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 1. Initial Program & Greetings Loader
  useEffect(() => {
    const programId = localStorage.getItem('syodan_current_program_id')
    const savedPrograms = localStorage.getItem('syodan_programs')

    if (programId && savedPrograms) {
      try {
        const programs: Program[] = JSON.parse(savedPrograms)
        const current = programs.find(p => p.id === programId)
        if (current) {
          setProgram(current)
          // Use program's specific time limit if set, else 5 mins
          setTimeLeft((current.timeLimit || 5) * 60)
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
          setSubtitleText(`${meta.personName}: "${meta.initialGreeting}"`)
        }
      } catch (e) {
        console.error("Failed to parse programs for initial greeting", e)
      }
    }
  }, [])

  // 2. Camera controller
  useEffect(() => {
    let activeStream: MediaStream | null = null

    async function startCamera() {
      if (videoActive) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          activeStream = stream
          setLocalStream(stream)
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        } catch (e) {
          console.error("Camera access failed:", e)
          setVideoActive(false)
        }
      } else {
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop())
          setLocalStream(null)
        }
      }
    }

    startCamera()

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [videoActive])

  // Save and Auto-scroll
  useEffect(() => {
    localStorage.setItem('syodan_messages', JSON.stringify(messages))
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 旧ローカル専用画面 — Bedrock/Polly 連携は /roleplay/setup から開始
  useEffect(() => {
    navigate('/roleplay/setup', { replace: true })
  }, [navigate])

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

    // System prompt injection for Customer Persona settings using new keys
    const historyToSend = [...updatedMessages]
    if (program && (program.personality_type || program.customerItLevel)) {
      const systemInjection = `【システム指示：あなたは以下の設定（顧客プロファイル）を持つ顧客キャラクターとしてロールプレイを行います。
industry: ${INDUSTRY_META[program.industry].label} (分野: ${program.sub_industry || '一般'})
personality_type: ${program.personality_type || '標準的'}
IT知識レベル: ${program.customerItLevel || '平均的'}

※この設定プロファイルを前提条件として振る舞い、最初の挨拶（${INDUSTRY_META[program.industry].initialGreeting}）から指定の「性格タイプ」の性格や「IT知識レベル」の知識度合いに基づいて、自然に会話を継続しているフリをしてください。この設定キーや条件自体には対話中直接言及しないでください。】`;

      // Inject system prompt to the beginning of the history
      historyToSend.unshift({ role: 'user', content: systemInjection })
    }

    try {
      const response = await sendMessage(program.id, targetText, historyToSend, program.industry)
      const aiMsg: ChatMessage = { role: 'assistant', content: response.message }
      setMessages(prev => [...prev, aiMsg])
      setSubtitleText(`${meta.personName}: "${response.message}"`)
      speak(response.message)
    } catch (error) {
      console.error("API Error:", error)
      setMessages(prev => [...prev, { role: 'assistant', content: "（エラーが発生しました。サーバーの状態を確認してください）" }])
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = async () => {
    if (!program) return
    setIsAnalyzing(true)
    stopSpeaking()

    const sessionId = localStorage.getItem('syodan_current_session_id') || `sess_${Date.now()}`

    // 1. 各回AI評価（デフォルトフォールバックを事前に定義）
    let aiEval = {
      score: '3/5',
      comment: '商談お疲れ様でした。ヒアリングは完了しましたが、具体的なヒアリング項目（予算、時期など）をさらに深めましょう。',
      questions: [
        '今回の顧客の反応から、どのタイミングで具体的な費用感の話を切り出すべきでしたか？',
        '相手のIT知識レベルに合わせた、より分かりやすいシステムの説明方法はありましたか？',
        '現場の不安（導入後のサポート）を解消するために、次にどのような資料を用意すると良いでしょうか？'
      ]
    }

    try {
      // APIでの評価生成
      const evalPrompt = `これまでの商談の対話履歴を分析し、以下のJSON形式で評価結果を出力してください。
他の余計な前置き、解説文、マークダウンタグ（\`\`\`jsonなど）は一切含めず、純粋なJSONオブジェクトのみを返してください。

{
  "score": "5点満点中の点数（例：4/5）",
  "comment": "AIによるこの回の具体的な評価コメント。良かった点、改善点を詳細に述べてください。",
  "questions": [
    "先輩への質問案1",
    "先輩への質問案2",
    "先輩への質問案3"
  ]
}

【対話履歴】
${messages.map(m => `${m.role === 'user' ? '自分' : '相手'}: ${m.content}`).join('\n')}`;

      const evalRes = await sendMessage(program.id, evalPrompt, [], program.industry)

      try {
        let cleanJson = evalRes.message.replace(/```json/g, '').replace(/```/g, '').trim()
        const startIdx = cleanJson.indexOf('{')
        const endIdx = cleanJson.lastIndexOf('}')
        if (startIdx !== -1 && endIdx !== -1) {
          cleanJson = cleanJson.substring(startIdx, endIdx + 1)
        }
        const parsed = JSON.parse(cleanJson)
        if (parsed.score && parsed.comment && parsed.questions) {
          aiEval = parsed
        }
      } catch (e) {
        console.error("Failed to parse individual AI evaluation JSON, fallback to raw text", e)
        aiEval.comment = evalRes.message
      }
    } catch (err) {
      console.warn("AI Evaluation API failed (backend might be offline). Using default offline evaluation.", err)
    }

    // Save individual session results (APIが落ちていても必ず保存！)
    const sessionData = {
      id: sessionId,
      programId: program.id,
      industry: program.industry,
      sessionNumber: program.currentSessionCount + 1,
      createdAt: new Date().toISOString(),
      transcript: messages.map(m => `${m.role === 'user' ? '自分' : '相手'}: ${m.content}`).join('\n'),
      aiEvaluation: aiEval
    }
    localStorage.setItem(`syodan_session_result_${sessionId}`, JSON.stringify(sessionData))

    // Check if all sessions are finished
    const nextSessionCount = program.currentSessionCount + 1
    const isAllFinished = nextSessionCount >= program.totalSessions

    // Update program status
    const saved = localStorage.getItem('syodan_programs')
    if (saved) {
      try {
        const programs: Program[] = JSON.parse(saved)
        const updated = programs.map(p => {
          if (p.id === program.id) {
            return {
              ...p,
              currentSessionCount: nextSessionCount,
              status: (isAllFinished ? 'completed' : 'active') as any
            }
          }
          return p
        })
        localStorage.setItem('syodan_programs', JSON.stringify(updated))
      } catch (e) {
        console.error("Failed to update program status in localStorage", e)
      }
    }

    if (isAllFinished) {
      // 2. シリーズ全体のAI総評の構築（デフォルトフォールバックを事前に定義）
      let overallReview = {
        trueProblemRevealed: `${INDUSTRY_META[program.industry].personName}氏は、「社内に導入プロジェクトを主導できるIT人材がおらず、失敗したときの責任を自分が負うことになること」を最も恐れていました。`,
        overallComment: '全回を通じて順調に商談が進行しました。相手の警戒心を徐々に解きほぐし、最終的に本音にたどり着くプロセスがうまく踏めていました。',
        overallQuestions: [
          '商談シリーズ全体の進め方として、初回ヒアリングから最終提案へのストーリー構成は適切でしたでしょうか？',
          'ITスキルが乏しく導入に不安を抱く相手に対し、他社での成功事例（特に類似の初心者導入例）をどの段階で提示すると効果的だったでしょうか？',
          '次回、正式な見積もりとスケジュールを提示するにあたり、決裁ルート（役員会議）を円滑に通過させるために社内で準備しておくべきポイントはありますか？'
        ],
        createdAt: new Date().toISOString()
      }

      try {
        // Gather transcripts of all sessions in this program
        let allTranscripts = ''
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith('syodan_session_result_')) {
            const data = JSON.parse(localStorage.getItem(key)!)
            if (data.programId === program.id) {
              allTranscripts += `--- 第${data.sessionNumber}回商談 ---\n${data.transcript}\n\n`
            }
          }
        }
        allTranscripts += `--- 第${nextSessionCount}回商談 (今回) ---\n${sessionData.transcript}\n\n`

        const overallEvalPrompt = `これまでに実施した全${program.totalSessions}回の商談シリーズ全体の履歴を分析し、以下のJSON形式で総評を出力してください。
他の余計な前置き、解説文、マークダウンタグ（\`\`\`jsonなど）は一切含めず、純粋なJSONオブジェクトのみを返してください。

{
  "trueProblemRevealed": "顧客が本当に抱えていた「真の課題」（例: 現場にIT担当者がおらず現場の反発を恐れていた、など）を推測し、要約してください。",
  "overallComment": "この商談シリーズ全体を通じた、営業担当者のアプローチに対するAI의 総評コメント。良かった点と今後の改善アドバイス。",
  "overallQuestions": [
    "全体を振り返って先輩に聞くべきアドバイス質問案1",
    "全体を振り返って先輩に聞くべきアドバイス質問案2",
    "全体を振り返って先輩に聞くべきアドバイス質問案3"
  ]
}

【商談シリーズ情報】
業界: ${INDUSTRY_META[program.industry].label}
顧客名: ${INDUSTRY_META[program.industry].personName}

【全回対話履歴】
${allTranscripts}`;

        const overallRes = await sendMessage(program.id, overallEvalPrompt, [], program.industry)

        try {
          let cleanJson = overallRes.message.replace(/```json/g, '').replace(/```/g, '').trim()
          const startIdx = cleanJson.indexOf('{')
          const endIdx = cleanJson.lastIndexOf('}')
          if (startIdx !== -1 && endIdx !== -1) {
            cleanJson = cleanJson.substring(startIdx, endIdx + 1)
          }
          const parsed = JSON.parse(cleanJson)
          if (parsed.trueProblemRevealed && parsed.overallComment && parsed.overallQuestions) {
            overallReview = { ...parsed, createdAt: new Date().toISOString() }
          }
        } catch (e) {
          console.error("Failed to parse overall review JSON, fallback to raw text", e)
          overallReview.overallComment = overallRes.message
        }
      } catch (err) {
        console.warn("AI Overall Review API failed (backend might be offline). Using default offline overall review.", err)
      }

      localStorage.setItem(`syodan_program_review_${program.id}`, JSON.stringify(overallReview))
      setIsAnalyzing(false)
      navigate(`/overall-review?program_id=${program.id}`)
    } else {
      setIsAnalyzing(false)
      navigate(`/evaluations/${sessionId}`)
    }
  }

  if (!program) return <div className="card">読み込み中...</div>

  const meta = INDUSTRY_META[program.industry]

  // Show loading analysis view
  if (isAnalyzing) {
    return (
      <div className="card wide" style={{ textAlign: 'center', padding: '50px 30px', maxWidth: '650px' }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: '#E91E63',
          color: '#fff',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '36px',
          margin: '0 auto 24px',
          boxShadow: '0 4px 15px rgba(233,30,99,0.3)',
          animation: 'pulse 1.5s infinite'
        }}>🤖</div>
        <h2 style={{ color: '#E91E63', marginBottom: '12px' }}>AI評価 & 質問シートを生成中...</h2>
        <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.6' }}>
          これまでの商談（ヒアリング）のやり取りをAIが分析しています。<br />
          客観的評価と、先輩への質問シートを自動作成中ですので、そのままでお待ちください。
        </p>
        <div style={{ marginTop: '24px', fontSize: '12px', color: '#888' }}>
          ※AI分析完了までに10秒前後かかる場合があります。
        </div>
      </div>
    )
  }

  // Check which participant is actively speaking
  const aiIsSpeaking = aiSpeaking || loading
  const userIsSpeaking = isListening

  return (
    <div className="zoom-container">
      {/* メインエリア：ビデオグリッド＋コントロールバー */}
      <div className="zoom-main-area">
        {/* ビデオグリッド */}
        <div className="zoom-video-grid">
          {/* AI顧客のビデオタイル */}
          <div className={`zoom-video-tile ${aiIsSpeaking ? 'speaking' : ''}`}>
            {aiIsSpeaking && (
              <div className="zoom-speaking-indicator">
                <span>音声出力中</span>
                <div className="waveform-dot"></div>
                <div className="waveform-dot"></div>
                <div className="waveform-dot"></div>
              </div>
            )}
            <div className="zoom-avatar-placeholder">
              {meta.icon}
            </div>
            <div className="zoom-participant-name">
              {meta.personName} {meta.honorific} ({meta.company})
            </div>
          </div>

          {/* 自分のビデオタイル */}
          <div className={`zoom-video-tile ${userIsSpeaking ? 'speaking' : ''}`}>
            {userIsSpeaking && (
              <div className="zoom-speaking-indicator" style={{ color: '#ff4b4b' }}>
                <span>音声録音中</span>
                <div className="waveform-dot" style={{ backgroundColor: '#ff4b4b' }}></div>
                <div className="waveform-dot" style={{ backgroundColor: '#ff4b4b' }}></div>
                <div className="waveform-dot" style={{ backgroundColor: '#ff4b4b' }}></div>
              </div>
            )}

            {videoActive ? (
              <video ref={videoRef} autoPlay playsInline muted />
            ) : (
              <div className="zoom-avatar-placeholder" style={{ background: '#37474f' }}>
                👤
              </div>
            )}

            <div className="zoom-participant-name">
              あなた (インカメラ映像)
            </div>
          </div>
        </div>

        {/* リアルタイム字幕エリア */}
        <div className="zoom-subtitles">
          {subtitleText || "マイク長押しで話しかけるか、右側のチャットで会話を開始してください。"}
        </div>

        {/* コントロールバー */}
        <div className="zoom-control-bar">
          <button
            className={`zoom-ctrl-btn ${micMuted ? 'active' : ''}`}
            onClick={() => setMicMuted(prev => !prev)}
            title={micMuted ? "マイクON" : "マイクOFF"}
          >
            {micMuted ? "🎙️" : "🎤"}
          </button>

          <button
            className={`zoom-ctrl-btn ${!videoActive ? 'active' : ''}`}
            onClick={() => setVideoActive(prev => !prev)}
            title={videoActive ? "ビデオ停止" : "ビデオ開始"}
          >
            {videoActive ? "📹" : "❌📹"}
          </button>

          <button
            className={`zoom-ctrl-btn ${!chatVisible ? 'active' : ''}`}
            onClick={() => setChatVisible(prev => !prev)}
            title={chatVisible ? "チャットを閉じる" : "チャットを開く"}
          >
            💬
          </button>

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: '13px', fontWeight: 'bold', color: timeLeft < 60 ? '#ff5252' : '#aaa', marginRight: '10px' }}>
            ⏱️ 残り: {formatTime(timeLeft)} | 第 {program.currentSessionCount + 1} 回商談
          </span>

          <button className="zoom-ctrl-btn end-call" onClick={handleFinish}>
            📞 商談を終了する
          </button>
        </div>
      </div>

      {/* チャットサイドバー */}
      {chatVisible && (
        <div className="zoom-chat-sidebar">
          <div className="zoom-chat-header">
            ミーティングチャット履歴
          </div>

          <div className="zoom-chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`zoom-chat-message ${m.role === 'user' ? 'user' : 'ai'}`}>
                <div className="small" style={{ fontWeight: 'bold', marginBottom: '3px', opacity: 0.8 }}>
                  {m.role === 'user' ? 'あなた' : meta.personName}
                </div>
                {m.content}
              </div>
            ))}
            {loading && <div className="zoom-chat-message ai" style={{ opacity: 0.6 }}>......</div>}
            <div ref={chatEndRef} />
          </div>

          <div className="zoom-chat-input-area">
            <button
              className={`zoom-chat-mic-btn ${isListening ? 'active' : ''}`}
              onMouseDown={() => { stopSpeaking(); startListening(); }}
              onMouseUp={() => { stopListening(); }}
              onMouseLeave={() => { if (isListening) stopListening(); }}
              title="プッシュトゥトーク（長押しで録音）"
            >
              🎤
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メッセージを入力..."
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="zoom-send-btn" onClick={() => handleSend()} disabled={loading}>
              ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
