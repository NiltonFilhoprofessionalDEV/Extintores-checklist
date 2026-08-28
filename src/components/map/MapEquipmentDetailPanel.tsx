"use client";

import { formatMapMarkerLabel, mapKindLabel } from "@/lib/map/marker-label";
import type { BlocoNaoConformidade } from "@/lib/checklist/observacao-conferencia";
import ModalCloseButton from "@/src/components/ModalCloseButton";

type ExtintorDetail = {
  kind: "extintor";
  codigo: string;
  localizacao: string;
  tipoCapacidade: string;
  pavimentoLabel: string;
  statusLabel: string;
  statusTone: "green" | "red" | "amber" | "gray";
  manutencaoLabel: string;
  manutencaoTone: "green" | "red" | "amber";
  semEquipamento?: boolean;
  /** Itens de NC com o texto digitado no checklist. */
  naoConformidades?: BlocoNaoConformidade[];
};

type HidranteDetail = {
  kind: "hidrante";
  codigo: string;
  localizacao: string;
  pavimentoLabel: string;
  statusLabel: string;
  statusTone: "green" | "red" | "amber" | "gray";
  /** Itens de NC com o texto digitado no checklist. */
  naoConformidades?: BlocoNaoConformidade[];
};

export type MapEquipmentDetail = ExtintorDetail | HidranteDetail;

type MapEquipmentDetailPanelProps = {
  detail: MapEquipmentDetail;
  layout: "sheet" | "panel";
  canInspect: boolean;
  canEdit: boolean;
  canManageInventory?: boolean;
  mode: "edicao" | "inspecao";
  onClose: () => void;
  onOpenInspection: () => void;
  onRemove?: () => void;
  onSubstituirEquipamento?: () => void;
  onCancelarRetirada?: () => void;
};

export default function MapEquipmentDetailPanel({
  detail,
  layout,
  canInspect,
  canEdit,
  canManageInventory = false,
  mode,
  onClose,
  onOpenInspection,
  onRemove,
  onSubstituirEquipamento,
  onCancelarRetirada,
}: MapEquipmentDetailPanelProps) {
  const isSheet = layout === "sheet";

  const statusClass =
    detail.statusTone === "green"
      ? "bg-green-100 text-green-700"
      : detail.statusTone === "red"
        ? "bg-red-100 text-red-800"
        : detail.statusTone === "gray"
          ? "bg-slate-100 text-slate-600"
          : "bg-yellow-100 text-yellow-800";

  const showInspection =
    mode === "inspecao" &&
    canInspect &&
    !(detail.kind === "extintor" && detail.semEquipamento);

  const content = (
    <>
      <div className={`flex items-start justify-between gap-3 ${isSheet ? "px-5 pt-2 pb-3" : "mb-3"}`}>
        <div>
          <h3 className="text-lg font-bold text-zinc-900">
            {formatMapMarkerLabel(detail.kind, detail.codigo)}
          </h3>
          <p className="mt-0.5 text-sm font-semibold text-zinc-700">{mapKindLabel(detail.kind)}</p>
          <p className="mt-0.5 text-sm text-zinc-500">{detail.localizacao}</p>
          <p className="mt-1 text-xs text-zinc-500">Setor: {detail.pavimentoLabel}</p>
        </div>
        {isSheet ? (
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
        ) : (
          <ModalCloseButton onClick={onClose} />
        )}
      </div>

      <div
        className={`flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 ${isSheet ? "mx-5 mb-4" : "mb-4"}`}
      >
        {detail.kind === "extintor" && detail.tipoCapacidade && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">Tipo / capacidade</span>
            <span className="text-xs font-medium text-zinc-700">{detail.tipoCapacidade}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">Status inspeção</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
            {detail.statusLabel}
          </span>
        </div>
        {detail.kind === "extintor" && !detail.semEquipamento && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">Manutenção</span>
            <span
              className={`text-xs font-semibold ${
                detail.manutencaoTone === "red"
                  ? "text-red-600"
                  : detail.manutencaoTone === "amber"
                    ? "text-amber-600"
                    : "text-green-600"
              }`}
            >
              {detail.manutencaoLabel}
            </span>
          </div>
        )}
      </div>

      {detail.naoConformidades && detail.naoConformidades.length > 0 && (
        <div
          className={`rounded-xl border border-red-100 bg-red-50 p-3 ${isSheet ? "mx-5 mb-4" : "mb-4"}`}
          role="status"
          aria-label="Detalhes da não conformidade"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-800">
            Não conformidade
          </p>
          <ul className="mt-2 flex flex-col gap-2.5">
            {detail.naoConformidades.map((item, index) => (
              <li key={`${item.titulo}-${index}`} className="min-w-0">
                <p className="text-xs font-semibold text-red-900">{item.titulo}</p>
                {item.descricao ? (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-red-950/90">
                    {item.descricao}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm italic text-red-800/70">Sem descrição informada</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`flex flex-col gap-2 ${isSheet ? "px-5 pb-6" : ""}`}>
        {showInspection && (
          <button
            type="button"
            className="w-full rounded-xl py-3 text-sm font-bold text-white"
            style={{ background: "linear-gradient(90deg,var(--forest),#B51313)" }}
            onClick={onOpenInspection}
          >
            Abrir inspeção
          </button>
        )}
        {canManageInventory && detail.kind === "extintor" && detail.semEquipamento && onSubstituirEquipamento && (
          <button
            type="button"
            className="w-full rounded-xl bg-[var(--orange)] py-3 text-sm font-bold text-white"
            onClick={onSubstituirEquipamento}
          >
            Substituir equipamento
          </button>
        )}
        {canManageInventory && detail.kind === "extintor" && detail.semEquipamento && onCancelarRetirada && (
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700"
            onClick={onCancelarRetirada}
          >
            Cancelar retirada
          </button>
        )}
        {canEdit && mode === "edicao" && onRemove && (
          <button
            type="button"
            className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600"
            onClick={onRemove}
          >
            Remover do mapa
          </button>
        )}
        {isSheet && (
          <button type="button" className="py-2 text-sm text-zinc-500" onClick={onClose}>
            Fechar
          </button>
        )}
      </div>
    </>
  );

  if (isSheet) {
    return (
      <div
        className="modal-layer fixed inset-0 z-[1600] flex items-end"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      >
        <div
          className="w-full rounded-t-2xl bg-white shadow-2xl"
          style={{ maxHeight: "min(70dvh, 520px)", overflowY: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-zinc-300" />
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
      {content}
    </div>
  );
}
