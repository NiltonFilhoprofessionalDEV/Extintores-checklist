"use client";

type InspecaoDraftPromptProps = {
  equipmentCodigo: string;
  kindLabel: string;
  answeredCount?: number;
  totalCount?: number;
  onContinue: () => void;
  onDiscard: () => void;
};

export default function InspecaoDraftPrompt({
  equipmentCodigo,
  kindLabel,
  answeredCount,
  totalCount,
  onContinue,
  onDiscard,
}: InspecaoDraftPromptProps) {
  const hasProgress =
    answeredCount != null && totalCount != null && totalCount > 0 && answeredCount < totalCount;

  return (
    <div className="rounded-[var(--fc-radius-lg)] border border-[var(--fc-primary)]/25 bg-[var(--fc-primary-pale)] px-4 py-3">
      <p className="text-sm font-bold text-[var(--fc-text-primary)]">Inspeção em andamento</p>
      {hasProgress ? (
        <p className="mt-1 text-xs font-semibold text-[var(--fc-primary-deep)]">
          {answeredCount} de {totalCount} itens respondidos
        </p>
      ) : null}
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
