"use client";

import { formatDateOnlyPt } from "@/lib/date/date-only";
import { formatPrevisaoRetorno } from "@/src/components/estoque/RetiradaEquipamentoDrawer";
import ManutencaoLoteItemList, { type ManutencaoLoteItem } from "@/src/components/estoque/ManutencaoLoteItemList";

export type ManutencaoLoteSummary = {
  id: string;
  motivo: string;
  previsao_retorno: string | null;
  creator_nome: string;
  created_at: string;
  item_count: number;
};

type ManutencaoLoteGroupProps = {
  lote: ManutencaoLoteSummary;
  items: ManutencaoLoteItem[];
  expanded: boolean;
  readOnly: boolean;
  cancelandoId: string | null;
  onToggle: () => void;
  onSubstituir: (item: ManutencaoLoteItem) => void;
  onCancelarRetirada: (item: ManutencaoLoteItem) => void;
  onVerDetalhes: (item: ManutencaoLoteItem) => void;
};

export default function ManutencaoLoteGroup({
  lote,
  items,
  expanded,
  readOnly,
  cancelandoId,
  onToggle,
  onSubstituir,
  onCancelarRetirada,
  onVerDetalhes,
}: ManutencaoLoteGroupProps) {
  const pendentes = items.filter((i) => i.sem_equipamento).length;
  const substituidos = items.length > 0 ? items.length - pendentes : 0;

  return (
    <section className="estoque-lote">
      <button
        type="button"
        className="estoque-lote__trigger"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="estoque-lote__title">{lote.motivo}</p>
          <p className="estoque-lote__meta">
            {formatDateOnlyPt(lote.created_at)} · Criado por {lote.creator_nome}
          </p>
          <div className="estoque-lote__stats">
            <span className="estoque-badge estoque-badge--mute">
              {lote.item_count} extintor{lote.item_count !== 1 ? "es" : ""}
            </span>
            {items.length > 0 ? (
              <>
                <span className="estoque-badge estoque-badge--ok">{substituidos} substituído{substituidos !== 1 ? "s" : ""}</span>
                {pendentes > 0 ? (
                  <span className="estoque-badge estoque-badge--warn">{pendentes} pendente{pendentes !== 1 ? "s" : ""}</span>
                ) : null}
              </>
            ) : null}
            {lote.previsao_retorno ? (
              <span className="estoque-badge estoque-badge--mute">
                Previsão: {formatPrevisaoRetorno(lote.previsao_retorno)}
              </span>
            ) : null}
          </div>
        </div>
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && items.length > 0 && (
        <div className="estoque-lote__body">
          <ManutencaoLoteItemList
            items={items}
            readOnly={readOnly}
            cancelandoId={cancelandoId}
            onSubstituir={onSubstituir}
            onCancelarRetirada={onCancelarRetirada}
            onVerDetalhes={onVerDetalhes}
          />
        </div>
      )}

      {expanded && items.length === 0 && (
        <p className="estoque-lote__body pb-4 text-sm text-slate-500">Nenhum item vinculado a esta lista.</p>
      )}
    </section>
  );
}
