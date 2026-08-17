import type { ReactNode } from "react";

export type InspecaoCardStatus = "concluido" | "pendente" | "nao_conforme" | "vencido";

const STATUS_LABELS: Record<InspecaoCardStatus, string> = {
  concluido: "Concluído",
  pendente: "Pendente",
  nao_conforme: "Não conforme",
  vencido: "Vencido",
};

const STATUS_CLASS: Record<InspecaoCardStatus, string> = {
  concluido: "inspecao-status-badge--concluido",
  pendente: "inspecao-status-badge--pendente",
  nao_conforme: "inspecao-status-badge--nao-conforme",
  vencido: "inspecao-status-badge--vencido",
};

type InspecaoEquipmentCardProps = {
  codigo: string;
  localDetalhado: string;
  metaLine: string;
  status: InspecaoCardStatus;
  aviso?: string | null;
  draftProgress?: { answered: number; total: number } | null;
  icon: ReactNode;
  onClick: () => void;
};

export default function InspecaoEquipmentCard({
  codigo,
  localDetalhado,
  metaLine,
  status,
  aviso,
  draftProgress,
  icon,
  onClick,
}: InspecaoEquipmentCardProps) {
  const hasDraft = draftProgress && draftProgress.answered > 0 && draftProgress.answered < draftProgress.total;

  return (
    <button type="button" onClick={onClick} className="inspecao-equipment-card pressable">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="inspecao-equipment-card__codigo truncate">{codigo}</p>
          <span className={`inspecao-status-badge ${STATUS_CLASS[status]} shrink-0`}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        {hasDraft ? (
          <p className="mt-1 text-[11px] font-semibold text-slate-600">
            Inspeção em andamento · {draftProgress.answered} de {draftProgress.total} respondidos
          </p>
        ) : null}
        <p className="inspecao-equipment-card__local">{localDetalhado}</p>
        <p className="inspecao-equipment-card__meta">{metaLine}</p>
        {aviso ? (
          <p className="mt-1 text-[11px] font-semibold text-rose-800">{aviso}</p>
        ) : null}
      </div>
      <svg
        className="mt-1.5 shrink-0 text-slate-300"
        width="16"
        height="16"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
