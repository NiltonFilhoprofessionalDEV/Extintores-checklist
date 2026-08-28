"use client";

import { formatDateOnlyPt } from "@/lib/date/date-only";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";
import FormDrawer from "@/src/components/inventory/FormDrawer";
import { EquipmentCode } from "@/src/components/inventory/InventoryVisuals";
import { formatPrevisaoRetorno } from "@/src/components/estoque/RetiradaEquipamentoDrawer";
import type { ManutencaoLoteItem } from "@/src/components/estoque/ManutencaoLoteItemList";
import type { ManutencaoLoteSummary } from "@/src/components/estoque/ManutencaoLoteGroup";

type ManutencaoLoteItemDetailDrawerProps = {
  item: ManutencaoLoteItem;
  lote: ManutencaoLoteSummary;
  onClose: () => void;
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="estoque-maint-detail__field">
      <p className="estoque-maint-detail__label">{label}</p>
      <p className="estoque-maint-detail__value">{value || "—"}</p>
    </div>
  );
}

export default function ManutencaoLoteItemDetailDrawer({
  item,
  lote,
  onClose,
}: ManutencaoLoteItemDetailDrawerProps) {
  const codigoVisual = formatEquipmentIdentifier("extintor", item.codigo);
  const statusLabel = item.sem_equipamento ? "Aguardando substituição" : "Substituído";

  return (
    <FormDrawer
      eyebrow="Manutenção"
      title={codigoVisual}
      description={`Detalhes da retirada e ${item.sem_equipamento ? "pendência" : "substituição"} neste ponto.`}
      onClose={onClose}
      footer={
        <div className="inv-drawer__footer-actions">
          <button type="button" className="btn-primary min-h-[44px] w-full sm:w-auto" onClick={onClose}>
            Fechar
          </button>
        </div>
      }
    >
      <div className="estoque-maint-detail space-y-5">
        <section className="estoque-maint-detail__section">
          <div className="flex flex-wrap items-center gap-3">
            <EquipmentCode kind="extintor" codigo={item.codigo} />
            <span
              className={
                item.sem_equipamento
                  ? "estoque-badge estoque-badge--warn"
                  : "estoque-badge estoque-badge--ok"
              }
            >
              {statusLabel}
            </span>
          </div>
          <div className="inv-place mt-3">
            <p className="inv-place__floor">{item.pavimento || item.setor}</p>
            <p className="inv-place__local">{item.local_detalhado}</p>
          </div>
        </section>

        <section className="estoque-maint-detail__section">
          <h3 className="estoque-maint-detail__heading">Lista de manutenção</h3>
          <div className="estoque-maint-detail__grid">
            <DetailField label="Motivo" value={lote.motivo} />
            <DetailField label="Retirada em" value={formatDateOnlyPt(lote.created_at)} />
            <DetailField label="Criado por" value={lote.creator_nome} />
            <DetailField
              label="Previsão de retorno"
              value={lote.previsao_retorno ? formatPrevisaoRetorno(lote.previsao_retorno) : "—"}
            />
          </div>
        </section>

        <section className="estoque-maint-detail__section">
          <h3 className="estoque-maint-detail__heading">Configuração do ponto</h3>
          <div className="estoque-maint-detail__grid">
            <DetailField label="Tipo / carga" value={formatExtintorConfigLabel(item)} />
            <DetailField label="Capacidade extintora" value={item.capacidade_extintora || "—"} />
          </div>
        </section>

        <section className="estoque-maint-detail__section">
          <h3 className="estoque-maint-detail__heading">Equipamentos</h3>
          <div className="estoque-maint-detail__grid">
            <DetailField label="INMETRO retirado" value={item.num_inmetro_retirado || "—"} />
            <DetailField
              label="INMETRO instalado"
              value={item.num_inmetro_instalado || (item.sem_equipamento ? "Pendente" : "—")}
            />
            <DetailField
              label="Cilindro instalado"
              value={item.num_cilindro_instalado || "—"}
            />
          </div>
        </section>
      </div>
    </FormDrawer>
  );
}
