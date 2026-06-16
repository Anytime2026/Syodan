import { useEffect, useState } from "react";
import "./App.css";
import Header from "./components/Header";
import PhaseIndicator from "./components/PhaseIndicator";
import ChatWindow from "./components/ChatWindow";
import InputBar from "./components/InputBar";
import { sendMessage, resetSession } from "./services/api";
import type { ChatMessage, Phase } from "./types";

const STORAGE_KEY = "salesRoleplay";

const INITIAL_GREETING: ChatMessage = {
  role: "assistant",
  content:
    "…はい、田中ですが。本日はお時間をいただきありがとうございます。少し忙しいので、要点からお願いできますか？",
};

function loadSessionId(): string {
  const saved = localStorage.getItem(`${STORAGE_KEY}_sessionId`);
  if (saved) return saved;
  const created = `session_${Date.now()}`;
  localStorage.setItem(`${STORAGE_KEY}_sessionId`, created);
  return created;
}

function loadMessages(): ChatMessage[] {
  const saved = localStorage.getItem(`${STORAGE_KEY}_messages`);
  if (saved) return JSON.parse(saved);
  return [INITIAL_GREETING];
}

function loadPhase(): Phase {
  const saved = localStorage.getItem(`${STORAGE_KEY}_phase`);
  return (saved as Phase) || "greeting";
}

function App() {
  const [sessionId, setSessionId] = useState(loadSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [phase, setPhase] = useState<Phase>(loadPhase);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_messages`, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_phase`, phase);
  }, [phase]);

  const handleSend = async (text: string) => {
    const userMessage: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setLoading(true);

    try {
      const result = await sendMessage(sessionId, text, updated);
      const aiMessage: ChatMessage = {
        role: "assistant",
        content: result.message,
      };
      setMessages([...updated, aiMessage]);
      setPhase(result.phase);
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "（応答エラーが発生しました。サーバーが起動しているか確認してください）",
      };
      setMessages([...updated, errorMessage]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    await resetSession(sessionId);
    const newSessionId = `session_${Date.now()}`;
    localStorage.setItem(`${STORAGE_KEY}_sessionId`, newSessionId);
    setSessionId(newSessionId);
    setMessages([INITIAL_GREETING]);
    setPhase("greeting");
  };

  return (
    <div className="app">
      <Header onReset={handleReset} />
      <PhaseIndicator phase={phase} />
      <ChatWindow messages={messages} loading={loading} />
      <InputBar onSend={handleSend} disabled={loading} />
    </div>
  );
}

export default App;
