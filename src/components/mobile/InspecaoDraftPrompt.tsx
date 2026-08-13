"use client";

type InspecaoDraftPromptProps = {
  equipmentCodigo: string;
  kindLabel: string;
  onContinue: () => void;
  onDiscard: () => void;
};

export default function InspecaoDraftPrompt({
  equipmentCodigo,
  kindLabel,
  onContinue,
  onDiscard,
}: InspecaoDraftPromptProps) {
  return (
    <div className="rounded-[var(--fc-radius-lg)] border border-[var(--fc-primary)]/25 bg-[var(--fc-primary-pale)] px-4 py-3">
      <p className="text-sm font-bold text-[var(--fc-text-primary)]">
        Você possui uma inspeção não finalizada.
      </p>
      <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
        {kindLabel} <span className="font-semibold text-[var(--fc-text-primary)]">{equipmentCodigo}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onContinue} className="btn-primary !py-2 !text-xs">
          Continuar inspeção
        </button>
        <button type="button" onClick={onDiscard} className="btn-secondary !py-2 !text-xs">
          Descartar
        </button>
      </div>
    </div>
  );
}
