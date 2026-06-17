import { useEffect, useState } from "react";
import "./App.css";
import Header from "./components/Header";
import PhaseIndicator from "./components/PhaseIndicator";
import ChatWindow from "./components/ChatWindow";
import InputBar from "./components/InputBar";
import IndustrySelect from "./components/IndustrySelect";
import { sendMessage, resetSession } from "./services/api";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import type { ChatMessage, Industry, Phase } from "./types";
import { INDUSTRY_META } from "./types";

const STORAGE_KEY = "salesRoleplay";

function loadIndustry(): Industry | null {
  return localStorage.getItem(`${STORAGE_KEY}_industry`) as Industry | null;
}

function loadSessionId(): string {
  const saved = localStorage.getItem(`${STORAGE_KEY}_sessionId`);
  if (saved) return saved;
  const created = `session_${Date.now()}`;
  localStorage.setItem(`${STORAGE_KEY}_sessionId`, created);
  return created;
}

function loadMessages(industry: Industry): ChatMessage[] {
  const saved = localStorage.getItem(`${STORAGE_KEY}_messages`);
  if (saved) return JSON.parse(saved);
  return [{ role: "assistant", content: INDUSTRY_META[industry].initialGreeting }];
}

function loadPhase(): Phase {
  return (localStorage.getItem(`${STORAGE_KEY}_phase`) as Phase) || "greeting";
}

function App() {
  const [industry, setIndustry] = useState<Industry | null>(loadIndustry);
  const [page, setPage] = useState<"select" | "chat">(
    () => (loadIndustry() ? "chat" : "select")
  );
  const [sessionId, setSessionId] = useState(loadSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    industry ? loadMessages(industry) : []
  );
  const [phase, setPhase] = useState<Phase>(loadPhase);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);

  const { speak, stop: stopSpeaking, speaking, supported: ttsSupported } =
    useSpeechSynthesis();

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_messages`, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_phase`, phase);
  }, [phase]);

  const handleSelectIndustry = (selected: Industry) => {
    const newSessionId = `session_${Date.now()}`;
    const greeting: ChatMessage = {
      role: "assistant",
      content: INDUSTRY_META[selected].initialGreeting,
    };
    localStorage.setItem(`${STORAGE_KEY}_industry`, selected);
    localStorage.setItem(`${STORAGE_KEY}_sessionId`, newSessionId);
    localStorage.removeItem(`${STORAGE_KEY}_messages`);
    localStorage.removeItem(`${STORAGE_KEY}_phase`);
    setIndustry(selected);
    setSessionId(newSessionId);
    setMessages([greeting]);
    setPhase("greeting");
    setPage("chat");
  };

  const handleSend = async (text: string) => {
    if (!industry) return;
    stopSpeaking();
    const userMessage: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setLoading(true);

    try {
      const result = await sendMessage(sessionId, text, updated, industry);
      const aiMessage: ChatMessage = {
        role: "assistant",
        content: result.message,
      };
      setMessages([...updated, aiMessage]);
      setPhase(result.phase);
      if (!muted) speak(result.message);
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "（応答エラーが発生しました。サーバーが起動しているか確認してください）",
      };
      setMessages([...updated, errorMessage]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    stopSpeaking();
    await resetSession(sessionId);
    localStorage.removeItem(`${STORAGE_KEY}_industry`);
    localStorage.removeItem(`${STORAGE_KEY}_sessionId`);
    localStorage.removeItem(`${STORAGE_KEY}_messages`);
    localStorage.removeItem(`${STORAGE_KEY}_phase`);
    setIndustry(null);
    setMessages([]);
    setPhase("greeting");
    setPage("select");
  };

  const handleToggleMute = () => {
    if (!muted) stopSpeaking();
    setMuted((m) => !m);
  };

  if (page === "select") {
    return (
      <div className="app">
        <IndustrySelect onSelect={handleSelectIndustry} />
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        industry={industry!}
        onReset={handleReset}
        muted={muted}
        speaking={speaking}
        ttsSupported={ttsSupported}
        onToggleMute={handleToggleMute}
      />
      <PhaseIndicator phase={phase} />
      <ChatWindow messages={messages} loading={loading} aiName={INDUSTRY_META[industry!].personName.split(" ")[0]} />
      <InputBar
        onSend={handleSend}
        disabled={loading}
        onBeforeListen={stopSpeaking}
        personLabel={`${INDUSTRY_META[industry!].personName.split(" ")[0]}${INDUSTRY_META[industry!].honorific}`}
      />
    </div>
  );
}

export default App;
