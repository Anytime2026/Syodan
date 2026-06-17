import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import MessageBubble from "./MessageBubble";

interface ChatWindowProps {
  messages: ChatMessage[];
  loading: boolean;
  aiName: string;
}

export default function ChatWindow({ messages, loading, aiName }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="chat-window">
      {messages.map((m, i) => (
        <MessageBubble key={i} message={m} aiName={aiName} />
      ))}
      {loading && (
        <div className="message-row">
          <div className="message-avatar">{aiName}</div>
          <div className="message-bubble message-bubble--ai message-bubble--typing">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
