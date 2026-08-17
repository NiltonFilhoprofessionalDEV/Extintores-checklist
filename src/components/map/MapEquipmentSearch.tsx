"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MapSearchHit } from "@/lib/map/equipment-search";

type MapEquipmentSearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  results: MapSearchHit[];
  onSelect: (hit: MapSearchHit) => void;
};

export default function MapEquipmentSearch({
  query,
  onQueryChange,
  results,
  onSelect,
}: MapEquipmentSearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1);

  const showList = open && query.trim().length > 0;

  useEffect(() => {
    if (!showList) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [showList]);

  function selectHit(hit: MapSearchHit) {
    onSelect(hit);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="map-search">
      <input
        type="search"
        role="combobox"
        aria-label="Buscar equipamento na base"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Buscar equipamento..."
        className="map-toolbar__search"
        value={query}
        autoComplete="off"
        onChange={(event) => {
          onQueryChange(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!showList || results.length === 0) {
            if (event.key === "Escape") setOpen(false);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(results.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(0, index - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            const hit = results[safeIndex];
            if (hit) selectHit(hit);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showList ? (
        <ul id={listId} role="listbox" className="map-search__list">
          {results.length === 0 ? (
            <li className="map-search__empty">Nenhum equipamento encontrado na base.</li>
          ) : (
            results.map((hit, index) => (
              <li key={`${hit.kind}-${hit.id}`} role="option" aria-selected={index === safeIndex}>
                <button
                  type="button"
                  className={`map-search__item${index === safeIndex ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectHit(hit)}
                >
                  <span className="map-search__code">{hit.displayLabel}</span>
                  <span className="map-search__meta">
                    <span>{hit.tipoLabel}</span>
                    <span>{hit.setorLabel}</span>
                    {hit.localizacao ? <span>{hit.localizacao}</span> : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
