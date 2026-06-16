import type { ChatMessage } from "../types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  return (
    <div className={`message-row ${isUser ? "message-row--user" : ""}`}>
      <div className="message-avatar">{isUser ? "あなた" : "田中"}</div>
      <div
        className={
          "message-bubble " +
          (isUser ? "message-bubble--user" : "message-bubble--ai")
        }
      >
        {message.content}
      </div>
    </div>
  );
}
