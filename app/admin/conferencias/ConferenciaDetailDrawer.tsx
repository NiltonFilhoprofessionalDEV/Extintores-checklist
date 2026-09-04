"use client";

import { useEffect, useId } from "react";
import type { ChecklistQuestion } from "@/lib/checklist/default-questions";
import { formatEquipmentIdentifier, mapKindLabel } from "@/lib/map/marker-label";
import {
  STATUS_META,
  formatDate,
  formatDateTime,
  getInspectionView,
  localLines,
  type ConferenciaItem,
} from "./conferencia-view";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden>
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="conf-detail-field">
      <p>{label}</p>
      <strong>{value || "Não informado"}</strong>
    </div>
  );
}

export default function ConferenciaDetailDrawer({
  item,
  teamLabel,
  questions,
  onClose,
}: {
  item: ConferenciaItem;
  teamLabel: string;
  questions: ChecklistQuestion[];
  onClose: () => void;
}) {
  const titleId = useId();
  const status = STATUS_META[item.exportStatus];
  const { local, pavimento } = localLines(item);
  const codigoVisual = formatEquipmentIdentifier(item.tipo, item.codigo);
  const { answers, naoConformidades, comentariosLivres } = getInspectionView(item, questions);
  const inspecaoConforme = item.exportStatus === "conforme" && naoConformidades.length === 0;
  const isPendente = item.exportStatus === "pendente";

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

  return (
    <div className="conf-drawer-layer" onClick={onClose} role="presentation">
      <aside
        className="conf-drawer conf-drawer--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="conf-drawer__header">
          <div className="conf-drawer__heading">
            <div className="conf-drawer__title-row">
              <h2 id={titleId}>{codigoVisual}</h2>
              <span className={status.badge}>{status.label}</span>
            </div>
            <p className="conf-drawer__kind">{mapKindLabel(item.tipo)}</p>
            <p className="conf-drawer__local">{local}</p>
            {pavimento ? <p className="conf-drawer__floor">{pavimento}</p> : null}
          </div>
          <button type="button" className="conf-drawer__close" onClick={onClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </header>

        <div className="conf-drawer__body">
          <section className="conf-section">
            <h3>Conferência</h3>
            <div className="conf-detail-grid">
              <DetailField
                label="Data e hora"
                value={isPendente ? "Não realizada" : formatDateTime(item.data_conferencia)}
              />
              <DetailField
                label="Conferente"
                value={isPendente ? "—" : item.conferente || "Não informado"}
              />
              <DetailField label="Equipe" value={teamLabel || "Não definida"} />
              <DetailField label="Status geral" value={status.label} />
            </div>
          </section>

          {isPendente ? (
            <p className="conf-ok-banner" style={{ background: "#f1f5f9", color: "#334155" }}>
              Sem inspeção no período de referência selecionado nos filtros.
            </p>
          ) : null}

          {inspecaoConforme ? (
            <p className="conf-ok-banner">Inspeção conforme</p>
          ) : null}

          {!isPendente && naoConformidades.length > 0 ? (
            <section className="conf-section">
              <div className="conf-section__head">
                <h3>Não conformidades</h3>
                <span className="conf-section__count">{naoConformidades.length}</span>
              </div>
              <div className="conf-nc-list">
                {naoConformidades.map((row) => (
                  <article key={row.key} className="conf-nc">
                    <div className="conf-nc__top">
                      <p>{row.label}</p>
                      <span className={row.className}>{row.text}</span>
                    </div>
                    {row.observacao ? <p className="conf-nc__note">{row.observacao}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="conf-section">
            <h3>Equipamento</h3>
            <div className="conf-detail-grid">
              {item.tipo === "extintor" ? (
                <>
                  <DetailField label="Código" value={codigoVisual} />
                  <DetailField label="Pavimento" value={pavimento || "Não informado"} />
                  <DetailField label="Local detalhado" value={item.local_detalhado} />
                  <DetailField label="Nº INMETRO" value={item.numInmetro ?? "Não informado"} />
                  <DetailField label="Tipo" value={item.tipoEquip ?? "Não informado"} />
                  <DetailField label="Carga" value={item.tamanho ?? "Não informado"} />
                  <DetailField label="Capacidade extintora" value={item.capacidadeExtintora ?? "Não informado"} />
                  <DetailField label="Manutenção 2º nível" value={formatDate(item.manutencao_2_nivel)} />
                  <DetailField label="Manutenção 3º nível" value={formatDate(item.manutencao_3_nivel)} />
                </>
              ) : (
                <>
                  <DetailField label="Código" value={codigoVisual} />
                  <DetailField label="Pavimento" value={item.pavimento ?? "Não informado"} />
                  <DetailField label="Local detalhado" value={item.local_detalhado} />
                  <DetailField
                    label="Mangueiras"
                    value={String(item.hidrante?.quantidade_mangueiras ?? "Não informado")}
                  />
                  <DetailField
                    label="Chaves Storz"
                    value={String(item.hidrante?.quantidade_chaves_storz ?? "Não informado")}
                  />
                  <DetailField
                    label="Esguichos"
                    value={String(item.hidrante?.quantidade_esguichos ?? "Não informado")}
                  />
                  <DetailField label="Teste hidrostático M-1" value={formatDate(item.hidrante?.teste_hidrostatico_m1)} />
                  <DetailField label="Teste hidrostático M-2" value={formatDate(item.hidrante?.teste_hidrostatico_m2)} />
                  <DetailField label="Teste hidrostático M-3" value={formatDate(item.hidrante?.teste_hidrostatico_m3)} />
                  <DetailField label="Teste hidrostático M-4" value={formatDate(item.hidrante?.teste_hidrostatico_m4)} />
                </>
              )}
            </div>
          </section>

          {!isPendente ? (
            <section className="conf-section">
              <h3>{naoConformidades.length > 0 ? "Todas as respostas" : "Resultado da inspeção"}</h3>
              <div className="conf-answers">
                {answers.map((answer) => (
                  <div key={answer.key} className="conf-answer">
                    <p>{answer.label}</p>
                    <span className={answer.className}>{answer.text}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!isPendente && comentariosLivres.length > 0 ? (
            <section className="conf-section">
              <h3>Observações</h3>
              <p className="conf-notes">{comentariosLivres.join("\n")}</p>
            </section>
          ) : null}
        </div>

        <footer className="conf-drawer__footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </aside>
    </div>
  );
}
