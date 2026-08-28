"use client";

import { useEffect, type ReactNode } from "react";
import { EQUIPES_CONFERENCIA, type EquipeConferenciaId } from "@/lib/equipes/conferencia-filtro";
import type { InspecaoFilters, InspecaoOrdenacao, InspecaoStatusFilter } from "@/lib/inspecao/filter-types";

type InspecaoFiltersPanelProps = {
  open: boolean;
  tipo: "extintor" | "hidrante";
  filters: InspecaoFilters;
  pavimentos: string[];
  tipos: string[];
  capacidades: string[];
  showEquipeFilter: boolean;
  resultCount: number;
  onChange: (filters: InspecaoFilters) => void;
  onClear: () => void;
  onClose: () => void;
};

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

const SECTION_LABEL = "mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500";
const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-[#fafafa] px-3 py-2.5 text-sm font-semibold text-slate-700";

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
        selected
          ? "border-[var(--orange)] bg-[var(--orange-soft)] text-[var(--orange-deep)]"
          : "border-slate-200 bg-white text-slate-700"
      }`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function InspecaoFiltersPanel({
  open,
  tipo,
  filters,
  pavimentos,
  tipos,
  capacidades,
  showEquipeFilter,
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
      className="modal-layer fixed inset-0 z-[1800] flex items-end md:items-stretch md:justify-end"
      style={{ background: "rgba(15, 23, 42, 0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspecao-filters-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(86dvh,640px)] w-full flex-col rounded-t-[1.5rem] bg-white shadow-2xl md:h-full md:max-h-none md:max-w-md md:rounded-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>

        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 id="inspecao-filters-title" className="text-lg font-extrabold text-zinc-900">
            Filtros
          </h2>
          <button
            type="button"
            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400"
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <div className="mb-5">
            <label htmlFor="inspecao-filter-pavimento" className={SECTION_LABEL}>
              Pavimento
            </label>
            <select
              id="inspecao-filter-pavimento"
              className={SELECT_CLASS}
              value={filters.pavimento}
              onChange={(event) => onChange({ ...filters, pavimento: event.target.value })}
            >
              <option value="">Todos os pavimentos</option>
              {pavimentos.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {tipo === "extintor" ? (
            <>
              <div className="mb-5">
                <label htmlFor="inspecao-filter-tipo" className={SECTION_LABEL}>
                  Tipo de agente
                </label>
                <select
                  id="inspecao-filter-tipo"
                  className={SELECT_CLASS}
                  value={filters.tipo}
                  onChange={(event) => onChange({ ...filters, tipo: event.target.value })}
                >
                  <option value="">Todos os tipos</option>
                  {tipos.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="mb-5">
                <label htmlFor="inspecao-filter-capacidade" className={SECTION_LABEL}>
                  Capacidade
                </label>
                <select
                  id="inspecao-filter-capacidade"
                  className={SELECT_CLASS}
                  value={filters.capacidade}
                  onChange={(event) => onChange({ ...filters, capacidade: event.target.value })}
                >
                  <option value="">Todas as capacidades</option>
                  {capacidades.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          {showEquipeFilter ? (
            <div className="mb-5">
              <label htmlFor="inspecao-filter-equipe" className={SECTION_LABEL}>
                Equipe responsável
              </label>
              <select
                id="inspecao-filter-equipe"
                className={SELECT_CLASS}
                value={filters.equipe}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    equipe: event.target.value as EquipeConferenciaId | "",
                  })
                }
              >
                <option value="">Todas as equipes</option>
                {EQUIPES_CONFERENCIA.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <p className={SECTION_LABEL}>Status</p>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                selected={filters.status === option.value}
                onClick={() => onChange({ ...filters, status: option.value })}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>

          <div>
            <label htmlFor="inspecao-filter-ordenacao" className={SECTION_LABEL}>
              Ordenação
            </label>
            <select
              id="inspecao-filter-ordenacao"
              className={SELECT_CLASS}
              value={filters.ordenacao}
              onChange={(event) => onChange({ ...filters, ordenacao: event.target.value as InspecaoOrdenacao })}
            >
              {ORDENACAO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600"
            onClick={onClear}
          >
            Limpar filtros
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-[var(--orange)] py-3 text-sm font-bold text-white shadow-sm"
            onClick={onClose}
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
