import type { ChecklistProgress } from "@/lib/inspecao/checklist-progress";

type ChecklistProgressBarProps = {
  progress: ChecklistProgress;
  label?: string;
};

export default function ChecklistProgressBar({ progress, label = "Inspeção" }: ChecklistProgressBarProps) {
  return (
    <div className="checklist-progress">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-[var(--fc-text-primary)]">{label}</p>
        <p className="text-xs font-semibold text-[var(--fc-text-secondary)]">
          {progress.answered} de {progress.total} respondidos
        </p>
      </div>
      <div className="checklist-progress__track" aria-hidden>
        <div
          className="checklist-progress__fill"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="text-[10px] font-semibold text-[var(--fc-text-secondary)]">{progress.percent}%</p>
    </div>
  );
}
