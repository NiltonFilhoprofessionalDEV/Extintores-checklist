"use client";

import { useEffect } from "react";
import type { InspecaoFilters, InspecaoOrdenacao, InspecaoStatusFilter } from "@/lib/inspecao/filter-types";

type InspecaoFiltersPanelProps = {
  open: boolean;
  tipo: "extintor" | "hidrante";
  filters: InspecaoFilters;
  pavimentos: string[];
  tipos: string[];
  capacidades: string[];
  resultCount: number;
  onChange: (filters: InspecaoFilters) => void;
  onClear: () => void;
  onClose: () => void;
};

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold text-[var(--fc-text-primary)]">{label}</span>
      {children}
    </label>
  );
}

const STATUS_OPTIONS: { value: InspecaoStatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "concluido", label: "Concluídos" },
  { value: "nao_conforme", label: "Não conforme" },
];

const ORDENACAO_OPTIONS: { value: InspecaoOrdenacao; label: string }[] = [
  { value: "codigo", label: "Código" },
  { value: "setor", label: "Setor / local" },
  { value: "pavimento", label: "Pavimento" },
];

export default function InspecaoFiltersPanel({
  open,
  tipo,
  filters,
  pavimentos,
  tipos,
  capacidades,
  resultCount,
  onChange,
  onClear,
  onClose,
}: InspecaoFiltersPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-layer fixed inset-0 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[2px] lg:items-center lg:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspecao-filters-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl lg:rounded-[1.75rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--fc-border)] px-5 py-4">
          <div>
            <p className="page-eyebrow">Refinar lista</p>
            <h2 id="inspecao-filters-title" className="mt-1 text-xl font-extrabold text-[var(--fc-text-primary)]">
              Filtros
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--muted)] text-lg text-slate-600"
            aria-label="Fechar filtros"
          >
            ×
          </button>
        </div>

        <div className="max-h-[70dvh] space-y-4 overflow-y-auto px-5 py-4">
          <FilterField label="Pavimento">
            <select
              className="field-control field-control--touch"
              value={filters.pavimento}
              onChange={(event) => onChange({ ...filters, pavimento: event.target.value })}
            >
              <option value="">Todos os pavimentos</option>
              {pavimentos.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </FilterField>

          {tipo === "extintor" && (
            <>
              <FilterField label="Tipo de agente">
                <select
                  className="field-control field-control--touch"
                  value={filters.tipo}
                  onChange={(event) => onChange({ ...filters, tipo: event.target.value })}
                >
                  <option value="">Todos os tipos</option>
                  {tipos.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Capacidade">
                <select
                  className="field-control field-control--touch"
                  value={filters.capacidade}
                  onChange={(event) => onChange({ ...filters, capacidade: event.target.value })}
                >
                  <option value="">Todas as capacidades</option>
                  {capacidades.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </FilterField>
            </>
          )}

          <FilterField label="Status">
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...filters, status: option.value })}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    filters.status === option.value
                      ? "border-[var(--fc-primary)] bg-[var(--fc-primary-soft)] text-[var(--fc-primary-deep)]"
                      : "border-[var(--fc-border)] bg-white text-[var(--fc-text-secondary)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </FilterField>

          <FilterField label="Ordenação">
            <select
              className="field-control field-control--touch"
              value={filters.ordenacao}
              onChange={(event) =>
                onChange({ ...filters, ordenacao: event.target.value as InspecaoOrdenacao })
              }
            >
              {ORDENACAO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FilterField>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--fc-border)] px-5 py-4">
          <p className="text-xs font-semibold text-[var(--fc-text-secondary)]">
            {resultCount} equipamento{resultCount === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClear} className="btn-secondary !py-2 !text-xs">
              Limpar
            </button>
            <button type="button" onClick={onClose} className="btn-primary !py-2 !text-xs">
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
