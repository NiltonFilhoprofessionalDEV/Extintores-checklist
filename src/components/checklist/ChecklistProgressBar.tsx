import type { ChecklistProgress } from "@/lib/inspecao/checklist-progress";

type ChecklistProgressBarProps = {
  progress: ChecklistProgress;
  label?: string;
};

export default function ChecklistProgressBar({ progress, label = "Inspeção" }: ChecklistProgressBarProps) {
  return (
    <div className="checklist-progress">
      <div className="checklist-progress__row">
        <p className="checklist-progress__label">{label}</p>
        <p className="checklist-progress__meta">
          {progress.answered} de {progress.total} respondidos · {progress.percent}%
        </p>
      </div>
      <div
        className="checklist-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
      >
        <div className="checklist-progress__fill" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}
