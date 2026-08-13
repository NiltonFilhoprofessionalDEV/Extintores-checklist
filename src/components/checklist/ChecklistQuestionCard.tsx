import { memo } from "react";
import type { ChecklistValue } from "@/lib/checklist/types";
import ChecklistOptionButtons from "./ChecklistOptionButtons";

type ChecklistQuestionCardProps = {
  index: number;
  label: string;
  value: ChecklistValue | null;
  detalheNc: string;
  unanswered?: boolean;
  onChange: (value: ChecklistValue) => void;
  onDetalheNcChange: (text: string) => void;
};

function ChecklistQuestionCardComponent({
  index,
  label,
  value,
  detalheNc,
  unanswered = false,
  onChange,
  onDetalheNcChange,
}: ChecklistQuestionCardProps) {
  return (
    <div
      className="checklist-question-card"
      data-checklist-unanswered={unanswered ? "true" : undefined}
    >
      <p className="checklist-question-card__label">
        <span className="checklist-question-card__index">{String(index).padStart(2, "0")}</span>
        {label}
      </p>
      <ChecklistOptionButtons value={value} onChange={onChange} />
      {value === "nao_conforme" && (
        <div className="checklist-nc-panel">
          <p className="checklist-nc-panel__title">Não conformidade</p>
          <textarea
            required
            rows={3}
            placeholder="Descreva o problema encontrado..."
            className="field-control field-control--touch !border-red-200 !bg-white"
            value={detalheNc}
            onChange={(event) => onDetalheNcChange(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default memo(ChecklistQuestionCardComponent);
