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
    <div className="flex items-center gap-1 rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--muted)] p-1" role="tablist" aria-label="Tipo de equipamento">
      <button
        type="button"
        role="tab"
        aria-selected={value === "extintor"}
        onClick={() => onChange("extintor")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--fc-radius-md)] px-3 py-2 text-sm font-bold transition ${
          value === "extintor"
            ? "bg-white text-[var(--fc-text-primary)] shadow-sm"
            : "text-[var(--fc-text-secondary)]"
        }`}
      >
        <ExtinguisherIcon size={16} />
        <span>Extintores</span>
        <span className={`text-xs font-extrabold ${value === "extintor" ? "text-[var(--fc-primary)]" : "text-slate-400"}`}>
          {extintoresCount}
        </span>
      </button>
      <span className="text-slate-300" aria-hidden>|</span>
      <button
        type="button"
        role="tab"
        aria-selected={value === "hidrante"}
        onClick={() => onChange("hidrante")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--fc-radius-md)] px-3 py-2 text-sm font-bold transition ${
          value === "hidrante"
            ? "bg-white text-[var(--fc-text-primary)] shadow-sm"
            : "text-[var(--fc-text-secondary)]"
        }`}
      >
        <HydrantIcon size={17} />
        <span>Hidrantes</span>
        <span className={`text-xs font-extrabold ${value === "hidrante" ? "text-[var(--fc-primary)]" : "text-slate-400"}`}>
          {hidrantesCount}
        </span>
      </button>
    </div>
  );
}
