import type { Phase } from "../types";

const STEPS: { key: Phase; label: string }[] = [
  { key: "greeting", label: "挨拶" },
  { key: "surface", label: "表面課題" },
  { key: "middle", label: "中間課題" },
  { key: "deep", label: "真の課題" },
];

interface PhaseIndicatorProps {
  phase: Phase;
}

export default function PhaseIndicator({ phase }: PhaseIndicatorProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === phase);

  return (
    <div className="phase-indicator">
      {STEPS.map((step, i) => (
        <div className="phase-indicator__item" key={step.key}>
          <div
            className={
              "phase-indicator__dot" +
              (i < currentIndex
                ? " phase-indicator__dot--done"
                : i === currentIndex
                ? " phase-indicator__dot--active"
                : "")
            }
          />
          <span
            className={
              "phase-indicator__label" +
              (i === currentIndex ? " phase-indicator__label--active" : "")
            }
          >
            {step.label}
          </span>
          {i < STEPS.length - 1 && <div className="phase-indicator__line" />}
        </div>
      ))}
    </div>
  );
}
