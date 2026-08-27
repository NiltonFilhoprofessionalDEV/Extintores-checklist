"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ExtintorStockConfig } from "@/lib/estoque/compatibility";
import { extintorConfigsAreCompatible, formatExtintorConfigLabel } from "@/lib/estoque/compatibility";
import FormDrawer from "@/src/components/inventory/FormDrawer";
import { FormField, FormSection, fieldControlClass } from "@/src/components/inventory/FormPrimitives";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";

type StockOption = {
  id: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
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
      let query = supabase
        .from("estoque_extintores")
        .select("id,tipo,tamanho,capacidade_extintora,quantidade")
        .gt("quantidade", 0)
        .order("tipo", { ascending: true });

      if (activeBaseId) query = query.eq("base_id", activeBaseId);

      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        setLoadError(
          error.message.includes("estoque_extintores")
            ? "Tabela de estoque não encontrada. Execute a migration de estoque."
            : error.message,
        );
        setOptions([]);
      } else {
        const rows = (data ?? []) as StockOption[];
        setOptions(
          rows.filter((row) =>
            extintorConfigsAreCompatible(expectedConfig, row),
          ),
        );
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, activeBaseId, expectedConfig]);

  const selected = options.find((o) => o.id === selectedId);

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
        <p className="text-sm font-bold text-slate-800">{formatEquipmentIdentifier("extintor", codigo)}</p>
        <p className="mt-1 text-sm text-slate-600">
          Configuração esperada: {formatExtintorConfigLabel(expectedConfig)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Classe: {expectedConfig.capacidade_extintora}
        </p>
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
                  {formatExtintorConfigLabel(opt)} — {opt.quantidade} disponível
                  {opt.quantidade !== 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </FormField>
        </FormSection>
      )}

      {selected ? (
        <FormSection title="Equipamento físico">
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
