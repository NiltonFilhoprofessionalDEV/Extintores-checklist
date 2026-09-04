"use client";

import { formatEquipmentIdentifier, mapKindLabel } from "@/lib/map/marker-label";
import {
  STATUS_META,
  formatDateTime,
  listarTiposNaoConformidade,
  localLines,
  type ConferenciaItem,
} from "./conferencia-view";
import type { ChecklistQuestion } from "@/lib/checklist/default-questions";

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function ConferenciaCard({
  item,
  questions,
  teamLabel,
  onOpen,
}: {
  item: ConferenciaItem;
  questions: ChecklistQuestion[];
  teamLabel: string;
  onOpen: () => void;
}) {
  const status = STATUS_META[item.exportStatus];
  const { local, pavimento } = localLines(item);
  const tiposNc = listarTiposNaoConformidade(item, questions);
  const codigoVisual = formatEquipmentIdentifier(item.tipo, item.codigo);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`conf-card conf-card--${status.accent}`}
      aria-haspopup="dialog"
    >
      <div className="conf-card__top">
        <div className="min-w-0">
          <div className="conf-card__identity">
            <span className="conf-card__code">{codigoVisual}</span>
            <span className="conf-card__kind">{mapKindLabel(item.tipo)}</span>
          </div>
          <p className="conf-card__local">{local}</p>
          {pavimento ? <p className="conf-card__floor">{pavimento}</p> : null}
        </div>
        <span className={status.badge}>{status.label}</span>
      </div>

      {item.exportStatus === "pendente" ? (
        <p className="conf-card__nc">Sem inspeção no período selecionado</p>
      ) : tiposNc.length > 0 ? (
        <p className="conf-card__nc">
          {tiposNc.length === 1 ? "1 não conformidade" : `${tiposNc.length} não conformidades`}
        </p>
      ) : null}

      <div className="conf-card__meta">
        <div className="min-w-0">
          {item.exportStatus === "pendente" ? (
            <>
              <p className="conf-card__when">Aguardando conferência</p>
              <p className="conf-card__who">{teamLabel || "Equipe não definida"}</p>
            </>
          ) : (
            <>
              <p className="conf-card__when">{formatDateTime(item.data_conferencia)}</p>
              <p className="conf-card__who">
                {item.conferente || "Não informado"}
                {teamLabel ? ` · ${teamLabel}` : ""}
              </p>
            </>
          )}
        </div>
        <span className="conf-card__chevron" aria-hidden>
          <ChevronRightIcon />
        </span>
      </div>
    </button>
  );
}
