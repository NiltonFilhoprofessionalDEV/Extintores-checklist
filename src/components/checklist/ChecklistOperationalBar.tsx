import type { ChecklistProgress } from "@/lib/inspecao/checklist-progress";

type ChecklistOperationalBarProps = {
  progress: ChecklistProgress;
  isSaving: boolean;
  isValid: boolean;
  onFinalize: () => void;
  onContinue?: () => void;
};

export default function ChecklistOperationalBar({
  progress,
  isSaving,
  isValid,
  onFinalize,
  onContinue,
}: ChecklistOperationalBarProps) {
  const complete = progress.isComplete;

  return (
    <div className="checklist-operational-bar">
      <div className="checklist-operational-bar__status">
        <span className="text-xs font-bold text-[var(--fc-text-primary)]">
          {progress.answered}/{progress.total} respondidos
        </span>
        {complete ? (
          <span className="text-[11px] font-semibold text-[var(--fc-success)]">Pronto para finalizar</span>
        ) : (
          <span className="text-[11px] font-semibold text-[var(--fc-text-secondary)]">
            Continue respondendo o checklist
          </span>
        )}
      </div>
      {complete ? (
        <button
          type="button"
          disabled={isSaving || !isValid}
          onClick={onFinalize}
          className="btn-primary checklist-operational-bar__cta pressable"
        >
          {isSaving ? "Finalizando..." : "Finalizar inspeção"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onContinue}
          className="btn-secondary checklist-operational-bar__cta pressable"
        >
          Continuar
        </button>
      )}
    </div>
  );
}
