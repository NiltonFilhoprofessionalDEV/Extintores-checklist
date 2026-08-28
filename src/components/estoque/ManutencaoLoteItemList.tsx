"use client";

import type { ReactNode } from "react";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";
import { EquipmentCode } from "@/src/components/inventory/InventoryVisuals";
import ManutencaoLoteItemActionsMenu, {
  type ManutencaoLoteActionItem,
} from "@/src/components/estoque/ManutencaoLoteItemActionsMenu";

export type ManutencaoLoteItem = {
  lote_id: string;
  extintor_id: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  pavimento: string | null;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  num_inmetro_retirado: string | null;
  num_inmetro_instalado: string | null;
  num_cilindro_instalado: string | null;
  sem_equipamento: boolean;
};

type ManutencaoLoteItemListProps = {
  items: ManutencaoLoteItem[];
  readOnly: boolean;
  cancelandoId?: string | null;
  onSubstituir: (item: ManutencaoLoteItem) => void;
  onCancelarRetirada: (item: ManutencaoLoteItem) => void;
  onVerDetalhes: (item: ManutencaoLoteItem) => void;
};

function StatusBadge({ semEquipamento }: { semEquipamento: boolean }) {
  if (semEquipamento) {
    return <span className="estoque-badge estoque-badge--mute">Sem equipamento</span>;
  }
  return <span className="estoque-badge estoque-badge--ok">Substituído</span>;
}

function InstalledEquipment({ item }: { item: ManutencaoLoteItem }) {
  if (!item.num_inmetro_instalado) {
    return <span className="text-slate-500">—</span>;
  }

  return (
    <>
      <span className="font-semibold text-slate-800">{item.num_inmetro_instalado}</span>
      {item.num_cilindro_instalado ? (
        <span className="mt-0.5 block text-xs text-slate-500">Cilindro {item.num_cilindro_instalado}</span>
      ) : null}
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="estoque-maint-card__detail-row">
      <span className="estoque-maint-card__detail-label">{label}</span>
      <div className="estoque-maint-card__detail-value">{children}</div>
    </div>
  );
}

function IconSubstituir() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function IconCancelar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  );
}

function IconDetalhes() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function buildActionItems(
  item: ManutencaoLoteItem,
  readOnly: boolean,
  cancelandoId: string | null,
  onSubstituir: (item: ManutencaoLoteItem) => void,
  onCancelarRetirada: (item: ManutencaoLoteItem) => void,
  onVerDetalhes: (item: ManutencaoLoteItem) => void,
): ManutencaoLoteActionItem[] {
  const busy = cancelandoId === item.extintor_id;
  const items: ManutencaoLoteActionItem[] = [
    {
      id: "detalhes",
      label: "Ver detalhes",
      icon: <IconDetalhes />,
      onClick: () => onVerDetalhes(item),
    },
  ];

  if (!readOnly && item.sem_equipamento) {
    items.unshift(
      {
        id: "substituir",
        label: "Substituir",
        icon: <IconSubstituir />,
        onClick: () => onSubstituir(item),
        disabled: busy,
      },
      {
        id: "cancelar",
        label: busy ? "Cancelando..." : "Cancelar retirada",
        icon: <IconCancelar />,
        onClick: () => onCancelarRetirada(item),
        tone: "danger",
        disabled: busy,
      },
    );
  }

  return items;
}

export default function ManutencaoLoteItemList({
  items,
  readOnly,
  cancelandoId = null,
  onSubstituir,
  onCancelarRetirada,
  onVerDetalhes,
}: ManutencaoLoteItemListProps) {
  return (
    <>
      <div className="estoque-mobile-list space-y-0 md:hidden">
        {items.map((item) => {
          const actionItems = buildActionItems(
            item,
            readOnly,
            cancelandoId,
            onSubstituir,
            onCancelarRetirada,
            onVerDetalhes,
          );
          const actionLabel = formatEquipmentIdentifier("extintor", item.codigo);

          return (
            <article key={item.extintor_id} className="estoque-maint-card">
              <div className="flex items-start justify-between gap-3">
                <EquipmentCode kind="extintor" codigo={item.codigo} />
                <div className="flex items-center gap-2">
                  <StatusBadge semEquipamento={item.sem_equipamento} />
                  <ManutencaoLoteItemActionsMenu label={actionLabel} items={actionItems} />
                </div>
              </div>

              <div className="inv-place">
                <p className="inv-place__floor">{item.pavimento || item.setor}</p>
                <p className="inv-place__local">{item.local_detalhado}</p>
              </div>

              <div className="estoque-maint-card__details">
                <DetailRow label="Configuração">
                  <>
                    {formatExtintorConfigLabel(item)}
                    <span className="mt-0.5 block text-xs font-medium text-slate-500">{item.capacidade_extintora}</span>
                  </>
                </DetailRow>
                <DetailRow label="INMETRO retirado">{item.num_inmetro_retirado || "—"}</DetailRow>
                <DetailRow label="Equipamento instalado">
                  <InstalledEquipment item={item} />
                </DetailRow>
              </div>
            </article>
          );
        })}
      </div>

      <div className="estoque-table-wrap hidden md:block">
        <table className="estoque-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Local</th>
              <th>Configuração</th>
              <th>INMETRO retirado</th>
              <th>Equipamento instalado</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const actionItems = buildActionItems(
                item,
                readOnly,
                cancelandoId,
                onSubstituir,
                onCancelarRetirada,
                onVerDetalhes,
              );
              const actionLabel = formatEquipmentIdentifier("extintor", item.codigo);

              return (
                <tr key={item.extintor_id}>
                  <td>
                    <EquipmentCode kind="extintor" codigo={item.codigo} />
                  </td>
                  <td>
                    <p className="font-semibold text-slate-800">{item.pavimento || item.setor}</p>
                    <p className="mt-0.5 max-w-[16rem] text-xs leading-relaxed text-slate-500">{item.local_detalhado}</p>
                  </td>
                  <td>
                    <p className="font-medium text-slate-800">{formatExtintorConfigLabel(item)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.capacidade_extintora}</p>
                  </td>
                  <td>{item.num_inmetro_retirado || "—"}</td>
                  <td>
                    <InstalledEquipment item={item} />
                  </td>
                  <td>
                    <StatusBadge semEquipamento={item.sem_equipamento} />
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <ManutencaoLoteItemActionsMenu label={actionLabel} items={actionItems} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
