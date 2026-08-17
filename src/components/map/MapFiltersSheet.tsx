"use client";

import { useState, type ReactNode } from "react";
import { EQUIPES_CONFERENCIA } from "@/lib/equipes/conferencia-filtro";
import {
  DEFAULT_MAP_FILTERS,
  MAP_STATUS_FILTER_OPTIONS,
  type MapFilterState,
  type MapStatusFilter,
} from "@/lib/map/map-filters";

type MapFiltersSheetProps = {
  open: boolean;
  variant: "sheet" | "drawer";
  value: MapFilterState;
  showEquipe: boolean;
  onClose: () => void;
  onApply: (next: MapFilterState) => void;
};

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

function MapFiltersSheetBody({
  variant,
  value,
  showEquipe,
  onClose,
  onApply,
}: Omit<MapFiltersSheetProps, "open">) {
  const [draft, setDraft] = useState<MapFilterState>(value);
  const isSheet = variant === "sheet";

  function applyAndClose(next: MapFilterState) {
    onApply(next);
    onClose();
  }

  return (
    <div
      className={`modal-layer fixed inset-0 z-[1800] ${
        isSheet ? "flex items-end" : "flex items-stretch justify-end"
      }`}
      style={{ background: "rgba(15, 23, 42, 0.4)" }}
      onClick={onClose}
    >
      <div
        className={
          isSheet
            ? "flex max-h-[min(86dvh,640px)] w-full flex-col rounded-t-[1.5rem] bg-white shadow-2xl"
            : "flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        }
        role="dialog"
        aria-labelledby="map-filters-title"
        onClick={(event) => event.stopPropagation()}
      >
        {isSheet ? (
          <div className="flex justify-center pt-3">
            <div className="h-1 w-10 rounded-full bg-zinc-300" />
          </div>
        ) : null}

        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 id="map-filters-title" className="text-lg font-extrabold text-zinc-900">
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
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Tipo de equipamento</p>
          <div className="mb-5 flex gap-2">
            <ChoiceButton
              selected={draft.layers.extintor}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  layers: { ...prev.layers, extintor: !prev.layers.extintor },
                }))
              }
            >
              Extintor
            </ChoiceButton>
            <ChoiceButton
              selected={draft.layers.hidrante}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  layers: { ...prev.layers, hidrante: !prev.layers.hidrante },
                }))
              }
            >
              Hidrante
            </ChoiceButton>
          </div>

          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Status</p>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {MAP_STATUS_FILTER_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.id}
                selected={draft.status === option.id}
                onClick={() => setDraft((prev) => ({ ...prev, status: option.id as MapStatusFilter }))}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>

          {showEquipe ? (
            <>
              <label htmlFor="map-filter-equipe" className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                Equipe responsável
              </label>
              <select
                id="map-filter-equipe"
                className="mb-2 w-full rounded-xl border border-slate-200 bg-[#fafafa] px-3 py-2.5 text-sm font-semibold text-slate-700"
                value={draft.equipe}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    equipe: event.target.value as MapFilterState["equipe"],
                  }))
                }
              >
                <option value="">Todas as equipes</option>
                {EQUIPES_CONFERENCIA.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600"
            onClick={() => applyAndClose(DEFAULT_MAP_FILTERS)}
          >
            Limpar filtros
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-[var(--orange)] py-3 text-sm font-bold text-white shadow-sm"
            onClick={() => applyAndClose(draft)}
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MapFiltersSheet({ open, ...props }: MapFiltersSheetProps) {
  if (!open) return null;
  return <MapFiltersSheetBody {...props} />;
}
