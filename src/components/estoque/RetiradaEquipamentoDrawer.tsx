"use client";

import { useState } from "react";
import { formatDateOnlyPt } from "@/lib/date/date-only";
import FormDrawer from "@/src/components/inventory/FormDrawer";
import { FormField, FormSection, fieldControlClass } from "@/src/components/inventory/FormPrimitives";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";

type RetiradaEquipamentoDrawerProps = {
  codigo: string;
  tipo: string;
  tamanho: string;
  numInmetro?: string | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (payload: { motivo: string; previsao_retorno: string | null }) => void;
};

export default function RetiradaEquipamentoDrawer({
  codigo,
  tipo,
  tamanho,
  numInmetro,
  saving,
  onClose,
  onConfirm,
}: RetiradaEquipamentoDrawerProps) {
  const [motivo, setMotivo] = useState("");
  const [previsao, setPrevisao] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    const trimmed = motivo.trim();
    if (!trimmed) {
      setError("Informe o motivo da retirada.");
      return;
    }
    setError("");
    onConfirm({
      motivo: trimmed,
      previsao_retorno: previsao.trim() || null,
    });
  }

  return (
    <FormDrawer
      eyebrow="Manutenção"
      title="Retirar equipamento"
      description={`O ponto ${formatEquipmentIdentifier("extintor", codigo)} ficará sem equipamento até a substituição.`}
      onClose={onClose}
      footer={
        <div className="inv-drawer__footer-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Retirando..." : "Confirmar retirada"}
          </button>
        </div>
      }
    >
      <div className="inv-detail-summary mb-4 rounded-xl bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-800">{formatEquipmentIdentifier("extintor", codigo)}</p>
        <p className="mt-1 text-sm text-slate-600">{tipo} — {tamanho}</p>
        {numInmetro ? (
          <p className="mt-1 text-xs text-slate-500">INMETRO: {numInmetro}</p>
        ) : null}
      </div>

      <FormSection title="Dados da retirada">
        <FormField
          id="ret-motivo"
          label="Motivo da retirada"
          required
          error={error}
          className="inv-field--full"
        >
          <textarea
            className={fieldControlClass(error)}
            rows={3}
            value={motivo}
            onChange={(event) => {
              setMotivo(event.target.value);
              if (error) setError("");
            }}
            placeholder="Ex: Recarga / manutenção preventiva"
          />
        </FormField>

        <FormField id="ret-previsao" label="Previsão de retorno" hint="Opcional">
          <input
            type="date"
            className={fieldControlClass()}
            value={previsao}
            onChange={(event) => setPrevisao(event.target.value)}
          />
        </FormField>
      </FormSection>

      <p className="mt-2 text-xs text-slate-500">
        O equipamento anterior será registrado no histórico. O ponto permanece no mapa com o mesmo código.
      </p>
    </FormDrawer>
  );
}

export function formatRetiradoEm(value: string | null | undefined): string {
  if (!value) return "—";
  return formatDateOnlyPt(value);
}
