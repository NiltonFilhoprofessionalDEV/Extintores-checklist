"use client";

import { useEffect } from "react";
import { EQUIPES_CONFERENCIA, type EquipeConferenciaId } from "@/lib/equipes/conferencia-filtro";
import type { ConferenciaExportStatus } from "@/lib/export/conferencia-historico";

type StatusFilter = ConferenciaExportStatus | "";

type ConferenciaFilterModalProps = {
  open: boolean;
  showEquipeFilter: boolean;
  filtroEquipe: EquipeConferenciaId | "";
  filtroStatus: StatusFilter;
  dataInicio: string;
  dataFim: string;
  resultCount: number;
  onEquipeChange: (value: EquipeConferenciaId | "") => void;
  onStatusChange: (value: StatusFilter) => void;
  onDataInicioChange: (value: string) => void;
  onDataFimChange: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "conforme", label: "Conforme" },
  { value: "alerta", label: "Não conforme" },
  { value: "vencido", label: "Vencido" },
];

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold text-[var(--ink)]">{label}</span>
      {children}
    </label>
  );
}

export default function ConferenciaFilterModal({
  open,
  showEquipeFilter,
  filtroEquipe,
  filtroStatus,
  dataInicio,
  dataFim,
  resultCount,
  onEquipeChange,
  onStatusChange,
  onDataInicioChange,
  onDataFimChange,
  onClear,
  onClose,
}: ConferenciaFilterModalProps) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-layer fixed inset-0 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-5">
          <div>
            <p className="page-eyebrow">Refinar resultados</p>
            <h2 id="filter-modal-title" className="mt-1 text-2xl font-extrabold text-[var(--ink)]">
              Filtros
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--muted)] text-xl text-slate-600"
            aria-label="Fechar filtros"
          >
            ×
          </button>
        </div>

        <div className="max-h-[70dvh] space-y-5 overflow-y-auto px-5 py-5">
          {showEquipeFilter && (
            <FilterField label="Equipe">
              <select
                className="field-control !rounded-xl"
                value={filtroEquipe}
                onChange={(event) => onEquipeChange(event.target.value as EquipeConferenciaId | "")}
              >
                <option value="">Todas as equipes</option>
                {EQUIPES_CONFERENCIA.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>{equipe.label}</option>
                ))}
              </select>
            </FilterField>
          )}

          <FilterField label="Status da inspeção">
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value || "todos"}
                  type="button"
                  onClick={() => onStatusChange(option.value)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    filtroStatus === option.value
                      ? "border-[var(--orange)] bg-[var(--orange-soft)] text-[var(--orange-deep)]"
                      : "border-[var(--border)] bg-white text-slate-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </FilterField>

          <div className="grid grid-cols-2 gap-3">
            <FilterField label="Data inicial">
              <input
                type="date"
                className="field-control !rounded-xl"
                value={dataInicio}
                onChange={(event) => onDataInicioChange(event.target.value)}
              />
            </FilterField>
            <FilterField label="Data final">
              <input
                type="date"
                className="field-control !rounded-xl"
                value={dataFim}
                min={dataInicio || undefined}
                onChange={(event) => onDataFimChange(event.target.value)}
              />
            </FilterField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] p-4">
          <button type="button" className="btn-secondary" onClick={onClear}>Limpar</button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Ver {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
          </button>
        </div>
      </div>
    </div>
  );
}
