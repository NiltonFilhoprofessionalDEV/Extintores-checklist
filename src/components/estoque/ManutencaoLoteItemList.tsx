"use client";

import type { ReactNode } from "react";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";
import { EquipmentCode } from "@/src/components/inventory/InventoryVisuals";

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
      <span className="font-semibold text-slate-800">INMETRO {item.num_inmetro_instalado}</span>
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

export default function ManutencaoLoteItemList({
  items,
  readOnly,
  cancelandoId = null,
  onSubstituir,
  onCancelarRetirada,
}: ManutencaoLoteItemListProps) {
  return (
    <>
      <div className="estoque-mobile-list space-y-0 md:hidden">
        {items.map((item) => (
          <article key={item.extintor_id} className="estoque-maint-card">
            <div className="flex items-start justify-between gap-3">
              <EquipmentCode kind="extintor" codigo={item.codigo} />
              <StatusBadge semEquipamento={item.sem_equipamento} />
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

            {!readOnly && item.sem_equipamento && (
              <div className="grid gap-2">
                <button
                  type="button"
                  className="btn-primary min-h-[44px] w-full"
                  onClick={() => onSubstituir(item)}
                  disabled={cancelandoId === item.extintor_id}
                >
                  Substituir
                </button>
                <button
                  type="button"
                  className="btn-secondary min-h-[44px] w-full"
                  onClick={() => onCancelarRetirada(item)}
                  disabled={cancelandoId === item.extintor_id}
                >
                  {cancelandoId === item.extintor_id ? "Cancelando..." : "Cancelar retirada"}
                </button>
              </div>
            )}
          </article>
        ))}
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
              {!readOnly && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
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
                {!readOnly && (
                  <td>
                    {item.sem_equipamento ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-primary text-xs"
                          onClick={() => onSubstituir(item)}
                          disabled={cancelandoId === item.extintor_id}
                        >
                          Substituir
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => onCancelarRetirada(item)}
                          disabled={cancelandoId === item.extintor_id}
                        >
                          {cancelandoId === item.extintor_id ? "Cancelando..." : "Cancelar retirada"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
