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

const TH = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500";

type ManutencaoLoteItemListProps = {
  items: ManutencaoLoteItem[];
  readOnly: boolean;
  cancelandoId?: string | null;
  onSubstituir: (item: ManutencaoLoteItem) => void;
  onCancelarRetirada: (item: ManutencaoLoteItem) => void;
};

function StatusBadge({ semEquipamento }: { semEquipamento: boolean }) {
  if (semEquipamento) {
    return (
      <span className="inv-badge inv-badge--mute shrink-0">Sem equipamento</span>
    );
  }
  return (
    <span className="inv-badge inv-badge--ok shrink-0">Substituído</span>
  );
}

function InstalledEquipment({ item }: { item: ManutencaoLoteItem }) {
  if (!item.num_inmetro_instalado) {
    return <span className="text-slate-500">—</span>;
  }

  return (
    <>
      <span className="font-medium text-slate-800">INMETRO {item.num_inmetro_instalado}</span>
      {item.num_cilindro_instalado ? (
        <span className="block text-xs text-slate-500">Cilindro {item.num_cilindro_instalado}</span>
      ) : null}
    </>
  );
}

function MobileDetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="text-sm text-slate-700 sm:text-right">{children}</div>
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
      <div className="inv-cards rounded-xl border border-slate-200 bg-slate-50/60">
        {items.map((item) => (
          <article key={item.extintor_id} className="inv-card flex-col items-stretch gap-3 !border-slate-200">
            <div className="flex w-full items-start justify-between gap-3">
              <EquipmentCode kind="extintor" codigo={item.codigo} />
              <StatusBadge semEquipamento={item.sem_equipamento} />
            </div>

            <div className="inv-place w-full">
              <p className="inv-place__floor">{item.pavimento || item.setor}</p>
              <p className="inv-place__local">{item.local_detalhado}</p>
            </div>

            <div className="grid w-full gap-2.5 rounded-xl border border-slate-100 bg-white p-3">
              <MobileDetailRow label="Configuração">
                <>
                  {formatExtintorConfigLabel(item)}
                  <span className="block text-xs text-slate-500">{item.capacidade_extintora}</span>
                </>
              </MobileDetailRow>
              <MobileDetailRow label="INMETRO retirado">
                {item.num_inmetro_retirado || "—"}
              </MobileDetailRow>
              <MobileDetailRow label="Equipamento instalado">
                <InstalledEquipment item={item} />
              </MobileDetailRow>
            </div>

            {!readOnly && item.sem_equipamento && (
              <div className="grid w-full gap-2">
                <button
                  type="button"
                  className="btn-primary w-full text-sm"
                  onClick={() => onSubstituir(item)}
                  disabled={cancelandoId === item.extintor_id}
                >
                  Substituir equipamento
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full text-sm"
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

      <div className="inv-table-wrap rounded-xl border border-slate-200">
        <table className="inv-table w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className={TH}>Código</th>
              <th className={TH}>Local</th>
              <th className={TH}>Configuração</th>
              <th className={TH}>INMETRO retirado</th>
              <th className={TH}>Equipamento instalado</th>
              <th className={TH}>Status</th>
              {!readOnly && <th className={TH}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.extintor_id} className="inv-table__row">
                <td className="px-4 py-3">
                  <EquipmentCode kind="extintor" codigo={item.codigo} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{item.pavimento || item.setor}</span>
                  <span className="block text-xs text-slate-500">{item.local_detalhado}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {formatExtintorConfigLabel(item)}
                  <span className="block text-xs text-slate-500">{item.capacidade_extintora}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{item.num_inmetro_retirado || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  <InstalledEquipment item={item} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge semEquipamento={item.sem_equipamento} />
                </td>
                {!readOnly && (
                  <td className="px-4 py-3">
                    {item.sem_equipamento ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => onSubstituir(item)}
                          disabled={cancelandoId === item.extintor_id}
                        >
                          Substituir
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs text-slate-700"
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
