import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

interface InputBarProps {
  onSend: (text: string) => void;
  disabled: boolean;
  onBeforeListen?: () => void;
  personLabel: string;
}

export default function InputBar({
  onSend,
  disabled,
  onBeforeListen,
  personLabel,
}: InputBarProps) {
  const [text, setText] = useState("");
  const baseTextRef = useRef("");

  const handleSpeechResult = (transcript: string, isFinal: boolean) => {
    if (isFinal) {
      baseTextRef.current = baseTextRef.current + transcript;
      setText(baseTextRef.current);
    } else {
      setText(baseTextRef.current + transcript);
    }
  };

  const { listening, supported, start, stop } =
    useSpeechRecognition(handleSpeechResult);

  const handleMicClick = () => {
    if (listening) {
      stop();
    } else {
      onBeforeListen?.();
      baseTextRef.current = text;
      start();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    if (listening) stop();
    onSend(trimmed);
    setText("");
    baseTextRef.current = "";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-bar-wrapper">
      <div className="input-bar">
        <textarea
          className="input-bar__textarea"
          placeholder={`${personLabel}への質問を入力してください（Enterで送信、Shift+Enterで改行）`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            baseTextRef.current = e.target.value;
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={2}
        />
        {supported && (
          <button
            type="button"
            className={
              "input-bar__mic" + (listening ? " input-bar__mic--active" : "")
            }
            onClick={handleMicClick}
            disabled={disabled}
            title={listening ? "録音を停止" : "音声入力を開始"}
          >
            {listening ? "■" : "🎤"}
          </button>
        )}
        <button
          className="input-bar__send"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
        >
          送信
        </button>
      </div>
      {supported && (
        <p className="input-bar__notice">
          ※音声入力はブラウザの音声認識機能を使用します。Chrome等では音声がブラウザ提供元（Google等）のサーバーで文字変換処理されます。
        </p>
      )}
    </div>
  );
}
