import type { Industry } from "../types";
import { INDUSTRY_META } from "../types";

interface HeaderProps {
  industry: Industry;
  onReset: () => void;
  muted: boolean;
  speaking: boolean;
  ttsSupported: boolean;
  onToggleMute: () => void;
}

export default function Header({
  industry,
  onReset,
  muted,
  speaking,
  ttsSupported,
  onToggleMute,
}: HeaderProps) {
  const meta = INDUSTRY_META[industry];
  return (
    <header className="app-header">
      <div className="app-header__title">
        <span className="app-header__logo">営業ヒアリングロープレAI</span>
        <span className="app-header__subtitle">
          {meta.company}　{meta.role}　{meta.personName} 様
        </span>
      </div>
      <div className="app-header__actions">
        {ttsSupported && (
          <button
            className={
              "app-header__mute" +
              (speaking && !muted ? " app-header__mute--active" : "")
            }
            onClick={onToggleMute}
            title={muted ? "読み上げをオンにする" : "読み上げをオフにする"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}
        <button className="app-header__reset" onClick={onReset}>
          業界選択に戻る
        </button>
      </div>
    </header>
  );
}
