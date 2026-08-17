"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EQUIPES_CONFERENCIA, type EquipeConferenciaId } from "@/lib/equipes/conferencia-filtro";
import {
  OPCOES_FILTRO_STATUS,
  PERIODO_PRESETS,
  datasParaPreset,
  detectarPeriodoPreset,
  type ConferenciaFiltrosDraft,
  type FiltroStatusConferencia,
  type PeriodoPreset,
} from "./conferencia-filtros";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

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
      className={`conf-choice${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="conf-filter-group">
      <p className="conf-filter-group__label">{label}</p>
      {children}
    </div>
  );
}

type ConferenciaFilterDrawerProps = {
  open: boolean;
  showEquipeFilter: boolean;
  value: ConferenciaFiltrosDraft;
  locais: string[];
  conferentes: string[];
  onApply: (next: ConferenciaFiltrosDraft) => void;
  onClear: () => void;
  onClose: () => void;
};

function ConferenciaFilterDrawerBody({
  showEquipeFilter,
  value,
  locais,
  conferentes,
  onApply,
  onClear,
  onClose,
}: Omit<ConferenciaFilterDrawerProps, "open">) {
  const [draft, setDraft] = useState<ConferenciaFiltrosDraft>(value);
  const preset = detectarPeriodoPreset(draft.dataInicio, draft.dataFim);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function applyPreset(next: Exclude<PeriodoPreset, "custom">) {
    const dates = datasParaPreset(next);
    setDraft((prev) => ({ ...prev, dataInicio: dates.inicio, dataFim: dates.fim }));
  }

  return (
    <div className="conf-drawer-layer" onClick={onClose} role="presentation">
      <aside
        className="conf-drawer conf-drawer--filters"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conf-filters-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="conf-drawer__header">
          <div className="conf-drawer__heading">
            <p className="conf-drawer__eyebrow">Refinar resultados</p>
            <h2 id="conf-filters-title">Filtros</h2>
          </div>
          <button type="button" className="conf-drawer__close" onClick={onClose} aria-label="Fechar filtros">
            <CloseIcon />
          </button>
        </header>

        <div className="conf-drawer__body">
          <FilterGroup label="Período">
            <div className="conf-choice-grid">
              {PERIODO_PRESETS.map((option) => (
                <ChoiceButton
                  key={option.id}
                  selected={preset === option.id}
                  onClick={() => applyPreset(option.id)}
                >
                  {option.label}
                </ChoiceButton>
              ))}
              <ChoiceButton selected={preset === "custom"} onClick={() => {}}>
                Personalizado
              </ChoiceButton>
            </div>
            <div className="conf-date-grid">
              <label className="conf-field">
                <span>Início</span>
                <input
                  type="date"
                  className="field-control !rounded-xl"
                  value={draft.dataInicio}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, dataInicio: event.target.value }))
                  }
                />
              </label>
              <label className="conf-field">
                <span>Fim</span>
                <input
                  type="date"
                  className="field-control !rounded-xl"
                  value={draft.dataFim}
                  min={draft.dataInicio || undefined}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, dataFim: event.target.value }))
                  }
                />
              </label>
            </div>
          </FilterGroup>

          <FilterGroup label="Resultado">
            <div className="conf-choice-grid">
              <ChoiceButton selected={draft.status === ""} onClick={() => setDraft((prev) => ({ ...prev, status: "" }))}>
                Todos
              </ChoiceButton>
              {OPCOES_FILTRO_STATUS.map((option) => (
                <ChoiceButton
                  key={option.value}
                  selected={draft.status === option.value}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      status: option.value as FiltroStatusConferencia,
                    }))
                  }
                >
                  {option.label}
                </ChoiceButton>
              ))}
            </div>
          </FilterGroup>

          {locais.length > 0 ? (
            <FilterGroup label="Local">
              <select
                className="field-control !rounded-xl"
                value={draft.local}
                onChange={(event) => setDraft((prev) => ({ ...prev, local: event.target.value }))}
              >
                <option value="">Todos os locais</option>
                {locais.map((local) => (
                  <option key={local} value={local}>
                    {local}
                  </option>
                ))}
              </select>
            </FilterGroup>
          ) : null}

          {conferentes.length > 0 ? (
            <FilterGroup label="Conferente">
              <select
                className="field-control !rounded-xl"
                value={draft.conferente}
                onChange={(event) => setDraft((prev) => ({ ...prev, conferente: event.target.value }))}
              >
                <option value="">Todos os conferentes</option>
                {conferentes.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </FilterGroup>
          ) : null}

          {showEquipeFilter ? (
            <FilterGroup label="Equipe">
              <select
                className="field-control !rounded-xl"
                value={draft.equipe}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    equipe: event.target.value as EquipeConferenciaId | "",
                  }))
                }
              >
                <option value="">Todas as equipes</option>
                {EQUIPES_CONFERENCIA.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.label}
                  </option>
                ))}
              </select>
            </FilterGroup>
          ) : null}
        </div>

        <footer className="conf-drawer__footer conf-drawer__footer--split">
          <button type="button" className="btn-secondary" onClick={onClear}>
            Limpar filtros
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Aplicar filtros
          </button>
        </footer>
      </aside>
    </div>
  );
}

export default function ConferenciaFilterDrawer({
  open,
  ...props
}: ConferenciaFilterDrawerProps) {
  if (!open) return null;
  return <ConferenciaFilterDrawerBody {...props} />;
}
