"use client";

import type { TipoEquipamento } from "@/lib/inventario/equipamento-padrao";
import { ExtinguisherIcon, HydrantIcon } from "@/src/components/EquipmentIcons";

type InventarioTipoTabsProps = {
  value: TipoEquipamento;
  onChange: (tipo: TipoEquipamento) => void;
  extintoresCount: number;
  hidrantesCount: number;
  className?: string;
  /** `quiet`: aba ativa branca, sem preenchimento laranja. */
  tone?: "solid" | "quiet";
};

export default function InventarioTipoTabs({
  value,
  onChange,
  extintoresCount,
  hidrantesCount,
  className = "",
  tone = "solid",
}: InventarioTipoTabsProps) {
  function tabClass(selected: boolean) {
    if (tone === "quiet") {
      return `flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${
        selected
          ? "bg-white text-[var(--ink)] shadow-sm ring-1 ring-black/5"
          : "text-[var(--muted-foreground)] hover:text-[var(--ink)]"
      }`;
    }
    return `flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${
      selected
        ? "bg-[var(--orange)] text-white shadow-sm"
        : "text-[var(--muted-foreground)] hover:text-[var(--ink)]"
    }`;
  }

  function countClass(selected: boolean) {
    if (tone === "quiet") {
      return `ml-1.5 text-xs font-semibold ${selected ? "text-[var(--orange-deep)]" : "text-slate-400"}`;
    }
    return `ml-1.5 text-xs font-semibold ${selected ? "text-white/75" : "text-slate-400"}`;
  }

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
        className={tabClass(value === "extintor")}
      >
        <ExtinguisherIcon size={17} />
        Extintores
        <span className={countClass(value === "extintor")}>({extintoresCount})</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "hidrante"}
        onClick={() => onChange("hidrante")}
        className={tabClass(value === "hidrante")}
      >
        <HydrantIcon size={18} />
        Hidrantes
        <span className={countClass(value === "hidrante")}>({hidrantesCount})</span>
      </button>
    </div>
  );
}
