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
      className={`flex rounded-2xl border border-slate-200 bg-slate-50 p-1 ${className}`}
      role="tablist"
      aria-label="Tipo de equipamento"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "extintor"}
        onClick={() => onChange("extintor")}
        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
          value === "extintor" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Extintores
        <span className="ml-1.5 text-xs font-semibold text-slate-400">({extintoresCount})</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "hidrante"}
        onClick={() => onChange("hidrante")}
        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
          value === "hidrante" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Hidrantes
        <span className="ml-1.5 text-xs font-semibold text-slate-400">({hidrantesCount})</span>
      </button>
    </div>
  );
}
