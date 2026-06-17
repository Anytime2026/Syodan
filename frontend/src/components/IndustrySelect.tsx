import type { Industry } from "../types";
import { INDUSTRY_META } from "../types";

const INDUSTRIES: Industry[] = [
  "manufacturing",
  "finance",
  "distribution",
  "retail",
];

interface IndustrySelectProps {
  onSelect: (industry: Industry) => void;
}

export default function IndustrySelect({ onSelect }: IndustrySelectProps) {
  return (
    <div className="industry-select">
      <div className="industry-select__header">
        <h1 className="industry-select__title">営業ヒアリングロープレAI</h1>
        <p className="industry-select__subtitle">
          練習する業界を選択してください
        </p>
      </div>

      <div className="industry-select__grid">
        {INDUSTRIES.map((industry) => {
          const meta = INDUSTRY_META[industry];
          return (
            <button
              key={industry}
              className="industry-card"
              onClick={() => onSelect(industry)}
            >
              <span className="industry-card__icon">{meta.icon}</span>
              <span className="industry-card__label">{meta.label}</span>
              <span className="industry-card__desc">{meta.description}</span>
              <span className="industry-card__persona">
                {meta.company}
                <br />
                {meta.role} {meta.personName} 様
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
