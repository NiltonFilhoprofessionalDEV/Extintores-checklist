"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";
import FormDrawer from "@/src/components/inventory/FormDrawer";
import { FormField, FormSection, fieldControlClass } from "@/src/components/inventory/FormPrimitives";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";

export type ExtintorRetiradaLoteRow = {
  id: string;
  codigo: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  setor: string;
  local_detalhado: string;
  pavimento: string | null;
  num_inmetro: string | null;
};

type RetiradaLoteDrawerProps = {
  activeBaseId: string | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    extintor_ids: string[];
    motivo: string;
    previsao_retorno: string | null;
  }) => void;
};

function compareCodigo(a: ExtintorRetiradaLoteRow, b: ExtintorRetiradaLoteRow): number {
  return a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true, sensitivity: "accent" });
}

export default function RetiradaLoteDrawer({
  activeBaseId,
  saving,
  onClose,
  onConfirm,
}: RetiradaLoteDrawerProps) {
  const [rows, setRows] = useState<ExtintorRetiradaLoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [semDataPrevista, setSemDataPrevista] = useState(true);
  const [previsao, setPrevisao] = useState("");
  const [error, setError] = useState("");

  const supabase = useMemo(() => getSupabaseClient(), []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const select =
      "id,codigo,tipo,tamanho,capacidade_extintora,setor,local_detalhado,pavimento,num_inmetro,sem_equipamento,active";

    let query = supabase
      .from("extintores")
      .select(select)
      .eq("active", true)
      .order("codigo", { ascending: true });

    if (activeBaseId) query = query.eq("base_id", activeBaseId);

    let { data, error: qError } = await query;

    if (qError && /sem_equipamento|schema cache|column/i.test(qError.message)) {
      let fallback = supabase
        .from("extintores")
        .select("id,codigo,tipo,tamanho,capacidade_extintora,setor,local_detalhado,pavimento,num_inmetro,active")
        .eq("active", true)
        .order("codigo", { ascending: true });
      if (activeBaseId) fallback = fallback.eq("base_id", activeBaseId);
      const retry = await fallback;
      data = retry.data as typeof data;
      qError = retry.error;
    }

    if (qError) {
      setLoadError(qError.message);
      setRows([]);
    } else {
      const list = (data ?? []) as (ExtintorRetiradaLoteRow & { sem_equipamento?: boolean | null })[];
      setRows(
        list
          .filter((row) => !row.sem_equipamento)
          .map(({ sem_equipamento: _, ...row }) => row),
      );
    }
    setLoading(false);
  }, [supabase, activeBaseId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase("pt-BR");
    if (!q) return [...rows].sort(compareCodigo);
    return rows
      .filter((row) => {
        const blob = [
          row.codigo,
          row.tipo,
          row.tamanho,
          row.capacidade_extintora,
          row.setor,
          row.local_detalhado,
          row.pavimento ?? "",
          row.num_inmetro ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR");
        return blob.includes(q);
      })
      .sort(compareCodigo);
  }, [rows, filter]);

  function toggleId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllVisible() {
    const visibleIds = filtered.map((r) => r.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  }

  function handleSubmit() {
    const trimmed = motivo.trim();
    if (!trimmed) {
      setError("Informe o motivo da retirada.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Selecione ao menos um extintor.");
      return;
    }
    setError("");
    onConfirm({
      extintor_ids: selectedIds,
      motivo: trimmed,
      previsao_retorno: semDataPrevista ? null : previsao.trim() || null,
    });
  }

  return (
    <FormDrawer
      eyebrow="Manutenção em lote"
      title="Retirar extintores das posições"
      description="Selecione os extintores do inventário para gerar uma lista de manutenção salva com data e responsável."
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
            disabled={saving || loading || selectedIds.length === 0}
          >
            {saving ? "Salvando lista..." : `Confirmar retirada (${selectedIds.length})`}
          </button>
        </div>
      }
    >
      <FormSection title="Dados da lista">
        <FormField
          id="lote-motivo"
          label="Motivo / observação da lista"
          required
          error={error && !motivo.trim() ? error : undefined}
          className="inv-field--full"
        >
          <textarea
            className={fieldControlClass(error && !motivo.trim() ? error : undefined)}
            rows={2}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (error) setError("");
            }}
            placeholder="Ex: Lote para recarga — manutenção preventiva"
          />
        </FormField>

        <div className="inv-field inv-field--full">
          <label className="inv-field__label flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={semDataPrevista}
              onChange={(e) => {
                setSemDataPrevista(e.target.checked);
                if (e.target.checked) setPrevisao("");
              }}
            />
            Sem data prevista de retorno
          </label>
        </div>

        {!semDataPrevista ? (
          <FormField id="lote-previsao" label="Previsão de retorno">
            <input
              type="date"
              className={fieldControlClass()}
              value={previsao}
              onChange={(e) => setPrevisao(e.target.value)}
            />
          </FormField>
        ) : null}
      </FormSection>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          Inventário ({selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""})
        </p>
        <button type="button" className="btn-secondary text-xs" onClick={toggleAllVisible} disabled={loading}>
          {filtered.length > 0 && filtered.every((r) => selectedIds.includes(r.id))
            ? "Desmarcar visíveis"
            : "Selecionar visíveis"}
        </button>
      </div>

      <div className="inv-toolbar__search mb-3">
        <input
          type="search"
          placeholder="Buscar por código, local, tipo ou INMETRO..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full"
          aria-label="Buscar extintores"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando inventário...</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum extintor disponível para retirada.</p>
      ) : (
        <div className="max-h-[min(52vh,480px)] space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
          {filtered.map((row) => {
            const checked = selectedIds.includes(row.id);
            return (
              <label
                key={row.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  checked ? "border-[var(--orange)] bg-orange-50/60" : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0"
                  checked={checked}
                  onChange={() => toggleId(row.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">
                    {formatEquipmentIdentifier("extintor", row.codigo)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {row.pavimento || row.setor} — {row.local_detalhado}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatExtintorConfigLabel(row)} · {row.capacidade_extintora}
                  </p>
                  {row.num_inmetro ? (
                    <p className="text-xs text-slate-500">INMETRO: {row.num_inmetro}</p>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {error && motivo.trim() && selectedIds.length === 0 ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}
    </FormDrawer>
  );
}
