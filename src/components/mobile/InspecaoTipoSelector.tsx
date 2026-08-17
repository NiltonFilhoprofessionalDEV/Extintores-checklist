"use client";

import type { TipoEquipamento } from "@/lib/inventario/equipamento-padrao";
import { ExtinguisherIcon, HydrantIcon } from "@/src/components/EquipmentIcons";

type InspecaoTipoSelectorProps = {
  value: TipoEquipamento;
  extintoresCount: number;
  hidrantesCount: number;
  onChange: (tipo: TipoEquipamento) => void;
};

export default function InspecaoTipoSelector({
  value,
  extintoresCount,
  hidrantesCount,
  onChange,
}: InspecaoTipoSelectorProps) {
  return (
    <div className="inspecao-type-tabs" role="tablist" aria-label="Tipo de equipamento">
      <button
        type="button"
        role="tab"
        aria-selected={value === "extintor"}
        onClick={() => onChange("extintor")}
        className={`inspecao-type-tab${value === "extintor" ? " is-active" : ""}`}
      >
        <ExtinguisherIcon size={16} className="text-slate-700" />
        <span>Extintores</span>
        <span className="inspecao-type-tab__count">{extintoresCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "hidrante"}
        onClick={() => onChange("hidrante")}
        className={`inspecao-type-tab${value === "hidrante" ? " is-active" : ""}`}
      >
        <HydrantIcon size={16} className="text-slate-700" />
        <span>Hidrantes</span>
        <span className="inspecao-type-tab__count">{hidrantesCount}</span>
      </button>
    </div>
  );
}
