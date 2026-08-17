"use client";

import type { ReactNode } from "react";

type PavimentoOption = {
  key: string;
  label: string;
};

type MapToolbarProps = {
  pavimentos: PavimentoOption[];
  pavimentoKey: string;
  onPavimentoChange: (key: string) => void;
  busca: string;
  onBuscaChange: (value: string) => void;
  showSearch: boolean;
  onOpenFilters: () => void;
  activeFilterCount: number;
  actions?: ReactNode;
};

function SlidersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" d="M4 8h10M18 8h2M4 16h2M10 16h10" />
      <circle cx="16" cy="8" r="2.25" />
      <circle cx="8" cy="16" r="2.25" />
    </svg>
  );
}

export default function MapToolbar({
  pavimentos,
  pavimentoKey,
  onPavimentoChange,
  busca,
  onBuscaChange,
  showSearch,
  onOpenFilters,
  activeFilterCount,
  actions,
}: MapToolbarProps) {
  const filtersLabel = activeFilterCount > 0 ? `Filtros • ${activeFilterCount}` : "Filtros";

  const filtersButton = (
    <button
      type="button"
      className={`map-toolbar__filters${activeFilterCount > 0 ? " is-active" : ""}`}
      onClick={onOpenFilters}
      aria-label={filtersLabel}
    >
      <SlidersIcon />
      <span>Filtros</span>
      {activeFilterCount > 0 ? (
        <span className="map-toolbar__badge">{activeFilterCount}</span>
      ) : null}
    </button>
  );

  return (
    <div className="map-toolbar">
      <div className="map-toolbar__row">
        <select
          aria-label="Selecionar setor"
          className="map-toolbar__sector"
          value={pavimentoKey}
          onChange={(event) => onPavimentoChange(event.target.value)}
        >
          {pavimentos.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        {actions}
        {showSearch ? null : filtersButton}
      </div>

      {showSearch ? (
        <div className="map-toolbar__row">
          <input
            type="search"
            aria-label="Buscar equipamento"
            placeholder="Buscar equipamento..."
            className="map-toolbar__search"
            value={busca}
            onChange={(event) => onBuscaChange(event.target.value)}
          />
          {filtersButton}
        </div>
      ) : null}
    </div>
  );
}
