"use client";

import { useState } from "react";
import type { HidranteImportRow } from "@/lib/rf01/hidrante-import-parser";
import { diasParaVencimentoTeste, dataVencimentoTeste } from "@/lib/checklist/types";
import { formatDateOnlyPt } from "@/lib/date/date-only";
import ChecklistEquipmentIdentity from "./ChecklistEquipmentIdentity";

type HidranteCompactHeaderProps = {
  hidrante: Partial<HidranteImportRow> & { codigo: string };
};

function testeLabel(val: string | null | undefined): string {
  if (!val) return "";
  const dias = diasParaVencimentoTeste(val);
  if (dias === null) return "";
  if (dias < 0) return `Mang. vencida (${Math.abs(dias)}d)`;
  if (dias <= 30) return `Mang. vence em ${dias}d`;
  return "";
}

export default function HidranteCompactHeader({ hidrante }: HidranteCompactHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const mangAviso = [
    testeLabel(hidrante.teste_hidrostatico_m1),
    testeLabel(hidrante.teste_hidrostatico_m2),
    testeLabel(hidrante.teste_hidrostatico_m3),
    testeLabel(hidrante.teste_hidrostatico_m4),
  ].find(Boolean);

  const metaParts = [
    hidrante.pavimento?.trim() || "",
    hidrante.quantidade_mangueiras != null ? `${hidrante.quantidade_mangueiras} mang.` : "",
  ].filter(Boolean);

  return (
    <ChecklistEquipmentIdentity
      kind="hidrante"
      codigo={hidrante.codigo}
      meta={metaParts.join(" · ")}
      local={hidrante.local_detalhado?.trim() || ""}
      expanded={expanded}
      onToggle={() => setExpanded((current) => !current)}
      extra={mangAviso ? <p className="checklist-equipment-header__alert">{mangAviso}</p> : null}
    >
      <dl className="checklist-equipment-header__details">
        <div><dt>Pavimento</dt><dd>{hidrante.pavimento?.trim() || "—"}</dd></div>
        <div><dt>Localização detalhada</dt><dd>{hidrante.local_detalhado?.trim() || "—"}</dd></div>
        <div>
          <dt>Quantidade de mangueiras</dt>
          <dd>{hidrante.quantidade_mangueiras != null ? hidrante.quantidade_mangueiras : "—"}</dd>
        </div>
        <div>
          <dt>Chaves Storz / Esguichos</dt>
          <dd>
            {[hidrante.quantidade_chaves_storz, hidrante.quantidade_esguichos].every((v) => v == null)
              ? "—"
              : `${hidrante.quantidade_chaves_storz ?? "—"} / ${hidrante.quantidade_esguichos ?? "—"}`}
          </dd>
        </div>
        {(
          [
            [1, hidrante.teste_hidrostatico_m1],
            [2, hidrante.teste_hidrostatico_m2],
            [3, hidrante.teste_hidrostatico_m3],
            [4, hidrante.teste_hidrostatico_m4],
          ] as const
        ).map(([n, val]) => {
          if (!val) return null;
          const venc = dataVencimentoTeste(val);
          const dias = diasParaVencimentoTeste(val);
          return (
            <div key={n}>
              <dt>Teste hidrostático M-{n}</dt>
              <dd>
                Última: {formatDateOnlyPt(val)} · Venc.: {formatDateOnlyPt(venc?.toISOString().slice(0, 10) ?? null)}
                {dias !== null && dias < 0 ? " (vencido)" : ""}
              </dd>
            </div>
          );
        })}
      </dl>
    </ChecklistEquipmentIdentity>
  );
}
