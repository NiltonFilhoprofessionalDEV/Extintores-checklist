import type { ChecklistProgress } from "@/lib/inspecao/checklist-progress";
import { ChecklistCheckIcon, ChecklistChevronIcon } from "./ChecklistUiIcons";

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
        <span className="checklist-operational-bar__count">
          {progress.answered} de {progress.total} respondidos
        </span>
        <span className="checklist-operational-bar__percent">{progress.percent}% concluído</span>
      </div>
      {complete ? (
        <button
          type="button"
          disabled={isSaving || !isValid}
          onClick={onFinalize}
          className="checklist-operational-bar__cta pressable"
        >
          {isSaving ? "Finalizando..." : "Concluir inspeção"}
          {!isSaving ? <ChecklistCheckIcon size={16} /> : null}
        </button>
      ) : (
        <button
          type="button"
          onClick={onContinue}
          className="checklist-operational-bar__cta pressable"
        >
          Continuar
          <ChecklistChevronIcon size={16} />
        </button>
      )}
    </div>
  );
}
