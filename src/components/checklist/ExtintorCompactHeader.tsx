"use client";

import { useState } from "react";
import type { InspecaoExtintorCabecalho } from "@/lib/checklist/types";
import { isDataVencida } from "@/lib/checklist/types";
import { formatDateOnlyPt } from "@/lib/date/date-only";

type ExtintorCompactHeaderProps = {
  info: InspecaoExtintorCabecalho;
};

export default function ExtintorCompactHeader({ info }: ExtintorCompactHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const v2 = isDataVencida(info.manutencao_2_nivel);
  const v3 = isDataVencida(info.manutencao_3_nivel);

  return (
    <div className="checklist-equipment-header">
      <div>
        <p className="checklist-equipment-header__kind">Extintor</p>
        <h2 className="checklist-equipment-header__codigo">{info.codigo}</h2>
        <p className="checklist-equipment-header__meta">
          {info.tipo} · {info.tamanho}
        </p>
        <p className="checklist-equipment-header__local">
          <span aria-hidden>📍</span> {info.local_detalhado || "Local não informado"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="checklist-equipment-header__toggle"
        aria-expanded={expanded}
      >
        {expanded ? "Ocultar dados do equipamento" : "Ver dados do equipamento"}
      </button>
      {expanded && (
        <dl className="checklist-equipment-header__details">
          <div><dt>Pavimento</dt><dd>{info.pavimento?.trim() || "—"}</dd></div>
          <div><dt>Local detalhado</dt><dd>{info.local_detalhado || "—"}</dd></div>
          <div><dt>Nº do INMETRO</dt><dd>{info.num_inmetro || "—"}</dd></div>
          <div><dt>Nº do Cilindro</dt><dd>{info.num_cilindro?.trim() || "—"}</dd></div>
          <div><dt>Tipo de agente extintor</dt><dd>{info.tipo || "—"}</dd></div>
          <div><dt>Carga nominal</dt><dd>{info.tamanho || "—"}</dd></div>
          <div><dt>Capacidade extintora</dt><dd>{info.capacidade_extintora || "—"}</dd></div>
          <div>
            <dt>Próx. Manutenção 2º Nível</dt>
            <dd className={v2 ? "text-red-600" : ""}>
              {formatDateOnlyPt(info.manutencao_2_nivel)}{v2 ? " (vencido)" : ""}
            </dd>
          </div>
          <div>
            <dt>Próx. Manutenção 3º Nível</dt>
            <dd className={v3 ? "text-red-600" : ""}>
              {formatDateOnlyPt(info.manutencao_3_nivel)}{v3 ? " (vencido)" : ""}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
