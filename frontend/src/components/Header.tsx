interface HeaderProps {
  onReset: () => void;
}

export default function Header({ onReset }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__title">
        <span className="app-header__logo">営業ヒアリングロープレAI</span>
        <span className="app-header__subtitle">
          商談相手：田中金属加工株式会社 代表取締役社長 田中 誠一 様
        </span>
      </div>
      <button className="app-header__reset" onClick={onReset}>
        商談をリセット
      </button>
    </header>
  );
}
