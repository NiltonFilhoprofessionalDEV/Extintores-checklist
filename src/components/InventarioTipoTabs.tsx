"use client";

import type { TipoEquipamento } from "@/lib/inventario/equipamento-padrao";

type InventarioTipoTabsProps = {
  value: TipoEquipamento;
  onChange: (tipo: TipoEquipamento) => void;
  extintoresCount: number;
  hidrantesCount: number;
  className?: string;
};

export default function InventarioTipoTabs({
  value,
  onChange,
  extintoresCount,
  hidrantesCount,
  className = "",
}: InventarioTipoTabsProps) {
  return (
    <div
      className={`flex rounded-full border border-[var(--border)] bg-[var(--muted)] p-1 ${className}`}
      role="tablist"
      aria-label="Tipo de equipamento"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "extintor"}
        onClick={() => onChange("extintor")}
        className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition ${
          value === "extintor"
            ? "bg-[var(--orange)] text-white shadow-sm"
            : "text-[var(--muted-foreground)] hover:text-[var(--ink)]"
        }`}
      >
        Extintores
        <span className={`ml-1.5 text-xs font-semibold ${value === "extintor" ? "text-white/75" : "text-slate-400"}`}>
          ({extintoresCount})
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "hidrante"}
        onClick={() => onChange("hidrante")}
        className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition ${
          value === "hidrante"
            ? "bg-[var(--orange)] text-white shadow-sm"
            : "text-[var(--muted-foreground)] hover:text-[var(--ink)]"
        }`}
      >
        Hidrantes
        <span className={`ml-1.5 text-xs font-semibold ${value === "hidrante" ? "text-white/75" : "text-slate-400"}`}>
          ({hidrantesCount})
        </span>
      </button>
    </div>
  );
}
