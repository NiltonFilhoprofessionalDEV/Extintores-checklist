import type { ReactNode } from "react";

export type InspecaoCardStatus = "concluido" | "pendente" | "nao_conforme";

const STATUS_LABELS: Record<InspecaoCardStatus, string> = {
  concluido: "Concluído",
  pendente: "Pendente",
  nao_conforme: "Não conforme",
};

type InspecaoEquipmentCardProps = {
  codigo: string;
  localDetalhado: string;
  metaLine: string;
  status: InspecaoCardStatus;
  aviso?: string | null;
  icon: ReactNode;
  onClick: () => void;
};

export default function InspecaoEquipmentCard({
  codigo,
  localDetalhado,
  metaLine,
  status,
  aviso,
  icon,
  onClick,
}: InspecaoEquipmentCardProps) {
  return (
    <button type="button" onClick={onClick} className="inspecao-equipment-card pressable">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="inspecao-equipment-card__codigo truncate">{codigo}</p>
          <span className={`inspecao-status-badge inspecao-status-badge--${status} shrink-0`}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        <p className="inspecao-equipment-card__local truncate">{localDetalhado}</p>
        <p className="inspecao-equipment-card__meta truncate">{metaLine}</p>
        {aviso ? (
          <p className="mt-1 text-[11px] font-semibold text-amber-700">{aviso}</p>
        ) : null}
      </div>
      <svg
        className="mt-0.5 shrink-0"
        width="16"
        height="16"
        fill="none"
        viewBox="0 0 24 24"
        stroke="#c5cad0"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
