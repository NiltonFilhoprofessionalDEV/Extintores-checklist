import type { ChecklistValue } from "@/lib/checklist/types";

type OptionDef = {
  value: ChecklistValue;
  label: string;
  shortLabel: string;
  icon: string;
  activeClass: string;
};

const OPTIONS: OptionDef[] = [
  {
    value: "conforme",
    label: "Conforme",
    shortLabel: "Conforme",
    icon: "✓",
    activeClass: "checklist-option--conforme",
  },
  {
    value: "nao_conforme",
    label: "Não conforme",
    shortLabel: "Não conforme",
    icon: "×",
    activeClass: "checklist-option--nao-conforme",
  },
  {
    value: "nao_aplica",
    label: "N/A",
    shortLabel: "N/A",
    icon: "—",
    activeClass: "checklist-option--na",
  },
];

type ChecklistOptionButtonsProps = {
  value: ChecklistValue | null;
  onChange: (value: ChecklistValue) => void;
  disabled?: boolean;
};

export default function ChecklistOptionButtons({
  value,
  onChange,
  disabled = false,
}: ChecklistOptionButtonsProps) {
  return (
    <div className="checklist-options" role="group" aria-label="Resposta da inspeção">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`checklist-option pressable ${active ? opt.activeClass : ""}`}
            aria-pressed={active}
            aria-label={opt.label}
          >
            <span className="checklist-option__icon" aria-hidden>{opt.icon}</span>
            <span className="checklist-option__label">{opt.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
