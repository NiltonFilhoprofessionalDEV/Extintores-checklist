"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ExtintorStockConfig } from "@/lib/estoque/compatibility";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";
import { toDateInputValue } from "@/lib/inventario/inventory-form";
import FormDrawer from "@/src/components/inventory/FormDrawer";
import { FormField, FormSection, fieldControlClass } from "@/src/components/inventory/FormPrimitives";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";

type StockOption = {
  id: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
};

type SubstituirEquipamentoDrawerProps = {
  extintorId: string;
  codigo: string;
  expectedConfig: ExtintorStockConfig;
  activeBaseId: string | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    estoque_id: string;
    num_inmetro: string;
    num_cilindro: string | null;
    manutencao_2_nivel: string | null;
    manutencao_3_nivel: string | null;
  }) => void;
};

function formatStockOptionLabel(opt: StockOption): string {
  const config = formatExtintorConfigLabel(opt);
  const cap = opt.capacidade_extintora.trim();
  const qtd = `${opt.quantidade} disponível${opt.quantidade !== 1 ? "s" : ""}`;
  return cap ? `${config} · ${cap} · ${qtd}` : `${config} · ${qtd}`;
}

export default function SubstituirEquipamentoDrawer({
  extintorId,
  codigo,
  expectedConfig,
  activeBaseId,
  saving,
  onClose,
  onConfirm,
}: SubstituirEquipamentoDrawerProps) {
  const [options, setOptions] = useState<StockOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [numInmetro, setNumInmetro] = useState("");
  const [numCilindro, setNumCilindro] = useState("");
  const [manut2, setManut2] = useState("");
  const [manut3, setManut3] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const supabase = useMemo(() => getSupabaseClient(), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");

        const params = new URLSearchParams({ extintor_id: extintorId });
        const response = await fetch(`/api/admin/estoque?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(activeBaseId ? { "X-Active-Base-Id": activeBaseId } : {}),
          },
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          items?: StockOption[];
        };

        if (cancelled) return;

        if (!response.ok) {
          setLoadError(payload.error ?? "Erro ao consultar estoque.");
          setOptions([]);
        } else {
          setOptions(payload.items ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Erro ao consultar estoque.");
          setOptions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, activeBaseId, extintorId]);

  const selected = options.find((o) => o.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setManut2(toDateInputValue(selected.manutencao_2_nivel));
    setManut3(toDateInputValue(selected.manutencao_3_nivel));
  }, [selectedId, selected]);

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (!selectedId) nextErrors.estoque = "Selecione um item do estoque.";
    if (!numInmetro.trim()) nextErrors.num_inmetro = "Nº do INMETRO é obrigatório.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onConfirm({
      estoque_id: selectedId,
      num_inmetro: numInmetro.trim(),
      num_cilindro: numCilindro.trim() || null,
      manutencao_2_nivel: manut2.trim() || null,
      manutencao_3_nivel: manut3.trim() || null,
    });
  }

  return (
    <FormDrawer
      eyebrow="Substituição"
      title="Substituir equipamento"
      description={`Associar equipamento do estoque ao ponto ${formatEquipmentIdentifier("extintor", codigo)}.`}
      onClose={onClose}
      footer={
        <div className="inv-drawer__footer-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={saving || loading || options.length === 0}
          >
            {saving ? "Substituindo..." : "Confirmar substituição"}
          </button>
        </div>
      }
    >
      <div className="inv-detail-summary mb-4 rounded-xl bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">{formatEquipmentIdentifier("extintor", codigo)}</p>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-semibold text-slate-800">Configuração esperada:</span>{" "}
          {formatExtintorConfigLabel(expectedConfig)}
        </p>
        {expectedConfig.capacidade_extintora.trim() ? (
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold text-slate-800">Capacidade extintora:</span>{" "}
            {expectedConfig.capacidade_extintora.trim()}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Consultando estoque compatível...</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-amber-700">
          Não há equipamentos compatíveis disponíveis no estoque para esta configuração.
        </p>
      ) : (
        <FormSection title="Estoque compatível">
          <FormField id="sub-estoque" label="Item do estoque" required error={errors.estoque} className="inv-field--full">
            <select
              className={fieldControlClass(errors.estoque)}
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.estoque;
                  return next;
                });
              }}
            >
              <option value="">Selecione...</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {formatStockOptionLabel(opt)}
                </option>
              ))}
            </select>
          </FormField>
        </FormSection>
      )}

      {selected ? (
        <FormSection title="Equipamento físico">
          <p className="inv-field--full mb-2 text-xs text-slate-500">
            INMETRO e cilindro são do equipamento que está sendo instalado no ponto.
          </p>
          <FormField id="sub-inmetro" label="Nº do INMETRO" required error={errors.num_inmetro}>
            <input
              className={fieldControlClass(errors.num_inmetro)}
              value={numInmetro}
              onChange={(event) => {
                setNumInmetro(event.target.value);
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.num_inmetro;
                  return next;
                });
              }}
              autoComplete="off"
            />
          </FormField>

          <FormField id="sub-cilindro" label="Nº do cilindro">
            <input
              className={fieldControlClass()}
              value={numCilindro}
              onChange={(event) => setNumCilindro(event.target.value)}
              autoComplete="off"
            />
          </FormField>

          <FormField id="sub-manut2" label="Próx. manutenção 2º nível">
            <input type="date" className={fieldControlClass()} value={manut2} onChange={(e) => setManut2(e.target.value)} />
          </FormField>

          <FormField id="sub-manut3" label="Próx. manutenção 3º nível">
            <input type="date" className={fieldControlClass()} value={manut3} onChange={(e) => setManut3(e.target.value)} />
          </FormField>
        </FormSection>
      ) : null}

      <input type="hidden" value={extintorId} readOnly />
    </FormDrawer>
  );
}
