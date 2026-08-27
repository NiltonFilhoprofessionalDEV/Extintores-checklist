"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentSession, getProfileBySession, type UserRole } from "@/lib/auth/profile";
import { isAdminLikeRole, isInventoryReadOnlyRole } from "@/lib/auth/roles";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { DashboardStatCard } from "@/app/admin/dashboard/dashboard-stat-card";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";
import { normalizeEstoquePayload } from "@/lib/estoque/stock-form";
import FormDrawer from "@/src/components/inventory/FormDrawer";
import RowActionsMenu from "@/src/components/RowActionsMenu";
import EstoqueStockForm, { useEstoqueFormState } from "@/src/components/estoque/EstoqueStockForm";
import SubstituirEquipamentoDrawer from "@/src/components/estoque/SubstituirEquipamentoDrawer";
import { formatRetiradoEm } from "@/src/components/estoque/RetiradaEquipamentoDrawer";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";
import { EquipmentCode } from "@/src/components/inventory/InventoryVisuals";

type EstoqueRow = {
  id: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
};

type AusenteRow = {
  id: string;
  codigo: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  setor: string;
  local_detalhado: string;
  pavimento: string | null;
  retirado_em: string | null;
  retirado_motivo: string | null;
};

type ViewMode = "estoque" | "ausentes";

const TH = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500";

function StatBoxesIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  );
}

export default function AdminEstoquePage() {
  const { ready, activeBaseId } = useActiveBase();
  const [view, setView] = useState<ViewMode>("estoque");
  const [items, setItems] = useState<EstoqueRow[]>([]);
  const [ausentes, setAusentes] = useState<AusenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorRole, setActorRole] = useState<UserRole>("admin");
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [substituirTarget, setSubstituirTarget] = useState<AusenteRow | null>(null);
  const [substituindo, setSubstituindo] = useState(false);

  const { form, errors, onChange, onTipoChange, validate, reset } = useEstoqueFormState();
  const readOnly = isInventoryReadOnlyRole(actorRole);
  const canDelete = isAdminLikeRole(actorRole);
  const supabase = useMemo(() => getSupabaseClient(), []);

  const callApi = useCallback(
    async (url: string, init?: RequestInit) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");

      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(activeBaseId ? { "X-Active-Base-Id": activeBaseId } : {}),
          ...init?.headers,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Erro na requisição.");
      return payload;
    },
    [supabase, activeBaseId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let estoqueQuery = supabase
        .from("estoque_extintores")
        .select("id,tipo,tamanho,capacidade_extintora,quantidade")
        .order("tipo", { ascending: true });

      if (activeBaseId) estoqueQuery = estoqueQuery.eq("base_id", activeBaseId);

      const estRes = await estoqueQuery;

      if (estRes.error) {
        setFeedback({
          type: "err",
          msg: estRes.error.message.includes("estoque_extintores")
            ? "Execute docs/migration_estoque_substituicao.sql no Supabase."
            : estRes.error.message,
        });
        setItems([]);
      } else {
        setItems((estRes.data ?? []) as EstoqueRow[]);
      }

      let ausQuery = supabase
        .from("extintores")
        .select(
          "id,codigo,tipo,tamanho,capacidade_extintora,setor,local_detalhado,pavimento,retirado_em,retirado_motivo",
        )
        .eq("sem_equipamento", true)
        .eq("active", true)
        .order("codigo", { ascending: true });

      if (activeBaseId) ausQuery = ausQuery.eq("base_id", activeBaseId);

      const ausRes = await ausQuery;

      if (ausRes.error && /sem_equipamento|schema cache|column/i.test(ausRes.error.message)) {
        setAusentes([]);
      } else if (!ausRes.error) {
        setAusentes((ausRes.data ?? []) as AusenteRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, activeBaseId]);

  useEffect(() => {
    if (!ready) return;
    void loadData();
  }, [ready, loadData]);

  useEffect(() => {
    void (async () => {
      const session = await getCurrentSession();
      if (!session) return;
      const profile = await getProfileBySession(session);
      if (profile) setActorRole(profile.role);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = items.reduce((sum, row) => sum + row.quantidade, 0);
    const sumTipo = (tipo: string) =>
      items
        .filter((row) => row.tipo.toLocaleUpperCase("pt-BR") === tipo.toLocaleUpperCase("pt-BR"))
        .reduce((sum, row) => sum + row.quantidade, 0);
    return {
      total,
      pqsAbc: sumTipo("PQS ABC"),
      pqsBc: sumTipo("PQS BC"),
      co2: sumTipo("CO2"),
    };
  }, [items]);

  function openCreate() {
    reset();
    setEditId(null);
    setDrawerMode("create");
  }

  function openEdit(row: EstoqueRow) {
    reset({
      tipo: row.tipo,
      tamanho: row.tamanho,
      capacidade_extintora: row.capacidade_extintora,
      quantidade: String(row.quantidade),
    });
    setEditId(row.id);
    setDrawerMode("edit");
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const payload = normalizeEstoquePayload(form);
      if (drawerMode === "create") {
        await callApi("/api/admin/estoque", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setFeedback({ type: "ok", msg: "Item adicionado ao estoque." });
      } else if (drawerMode === "edit" && editId) {
        await callApi("/api/admin/estoque", {
          method: "PATCH",
          body: JSON.stringify({ id: editId, ...payload }),
        });
        setFeedback({ type: "ok", msg: "Estoque atualizado." });
      }
      setDrawerMode(null);
      await loadData();
    } catch (error) {
      setFeedback({
        type: "err",
        msg: error instanceof Error ? error.message : "Erro ao salvar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: EstoqueRow) {
    if (!canDelete) return;
    if (!window.confirm(`Remover ${formatExtintorConfigLabel(row)} do estoque?`)) return;
    try {
      await callApi("/api/admin/estoque", {
        method: "DELETE",
        body: JSON.stringify({ id: row.id }),
      });
      setFeedback({ type: "ok", msg: "Item removido do estoque." });
      await loadData();
    } catch (error) {
      setFeedback({
        type: "err",
        msg: error instanceof Error ? error.message : "Erro ao remover.",
      });
    }
  }

  async function handleSubstituir(payload: {
    estoque_id: string;
    num_inmetro: string;
    num_cilindro: string | null;
    manutencao_2_nivel: string | null;
    manutencao_3_nivel: string | null;
  }) {
    if (!substituirTarget) return;
    setSubstituindo(true);
    try {
      await callApi("/api/admin/extintores/substituir", {
        method: "POST",
        body: JSON.stringify({
          extintor_id: substituirTarget.id,
          ...payload,
        }),
      });
      setFeedback({ type: "ok", msg: `Equipamento substituído em ${formatEquipmentIdentifier("extintor", substituirTarget.codigo)}.` });
      setSubstituirTarget(null);
      await loadData();
    } catch (error) {
      setFeedback({
        type: "err",
        msg: error instanceof Error ? error.message : "Erro na substituição.",
      });
    } finally {
      setSubstituindo(false);
    }
  }

  return (
    <div className="inv-page">
      <div className="inv-header">
        <div>
          <h1 className="inv-header__title">Estoque</h1>
          <p className="inv-header__subtitle">Equipamentos disponíveis para substituição</p>
        </div>
        <div className="inv-header__actions">
          {!readOnly && view === "estoque" && (
            <button type="button" onClick={openCreate} className="btn-primary">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar ao estoque
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={view === "estoque" ? "btn-primary text-xs" : "btn-secondary text-xs"}
          onClick={() => setView("estoque")}
        >
          Estoque disponível
        </button>
        <button
          type="button"
          className={view === "ausentes" ? "btn-primary text-xs" : "btn-secondary text-xs"}
          onClick={() => setView("ausentes")}
        >
          Equipamentos ausentes ({ausentes.length})
        </button>
      </div>

      {view === "estoque" && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardStatCard
              label="Total disponível"
              value={stats.total}
              color="#0f766e"
              icon={<StatBoxesIcon />}
            />
            <DashboardStatCard label="PQS ABC" value={stats.pqsAbc} color="#2563eb" icon={<StatBoxesIcon />} />
            <DashboardStatCard label="PQS BC" value={stats.pqsBc} color="#7c3aed" icon={<StatBoxesIcon />} />
            <DashboardStatCard label="CO₂" value={stats.co2} color="#475569" icon={<StatBoxesIcon />} />
          </div>

          <div className="professional-card overflow-hidden">
            {loading ? (
              <p className="p-6 text-sm text-slate-500">Carregando estoque...</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Nenhum item cadastrado no estoque.</p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="inv-table w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className={TH}>Tipo</th>
                        <th className={TH}>Classe</th>
                        <th className={TH}>Capacidade</th>
                        <th className={TH}>Quantidade disponível</th>
                        {!readOnly && <th className={TH}>Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={row.id} className="inv-table__row">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.tipo}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{row.capacidade_extintora}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{row.tamanho}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                            {row.quantidade} disponível{row.quantidade !== 1 ? "s" : ""}
                          </td>
                          {!readOnly && (
                            <td className="px-4 py-3">
                              <RowActionsMenu
                                label={formatExtintorConfigLabel(row)}
                                onEdit={() => openEdit(row)}
                                onDelete={canDelete ? () => handleDelete(row) : undefined}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100">
                  {items.map((row) => (
                    <article key={row.id} className="inv-card p-4">
                      <p className="font-bold text-slate-900">{row.tipo}</p>
                      <p className="mt-1 text-sm text-slate-600">{row.capacidade_extintora} · {row.tamanho}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        {row.quantidade} disponível{row.quantidade !== 1 ? "s" : ""}
                      </p>
                      {!readOnly && (
                        <div className="mt-3 flex gap-2">
                          <button type="button" className="btn-secondary text-xs" onClick={() => openEdit(row)}>
                            Editar
                          </button>
                          {canDelete && (
                            <button type="button" className="btn-secondary text-xs text-red-600" onClick={() => handleDelete(row)}>
                              Remover
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {view === "ausentes" && (
        <div className="professional-card overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Carregando equipamentos ausentes...</p>
          ) : ausentes.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Nenhum ponto sem equipamento no momento.</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="inv-table w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={TH}>Código</th>
                      <th className={TH}>Local</th>
                      <th className={TH}>Configuração</th>
                      <th className={TH}>Retirada</th>
                      <th className={TH}>Status</th>
                      {!readOnly && <th className={TH}>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {ausentes.map((row) => (
                      <tr key={row.id} className="inv-table__row">
                        <td className="px-4 py-3">
                          <EquipmentCode kind="extintor" codigo={row.codigo} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {row.pavimento || row.setor} — {row.local_detalhado}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatExtintorConfigLabel(row)}
                          <span className="block text-xs text-slate-500">{row.capacidade_extintora}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatRetiradoEm(row.retirado_em)}
                          {row.retirado_motivo ? (
                            <span className="block text-xs text-slate-500">{row.retirado_motivo}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            Sem equipamento
                          </span>
                        </td>
                        {!readOnly && (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="btn-secondary text-xs"
                              onClick={() => setSubstituirTarget(row)}
                            >
                              Substituir equipamento
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-100">
                {ausentes.map((row) => (
                  <article key={row.id} className="inv-card p-4">
                    <EquipmentCode kind="extintor" codigo={row.codigo} />
                    <p className="mt-1 text-sm text-slate-600">
                      {row.pavimento || row.setor} — {row.local_detalhado}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{formatExtintorConfigLabel(row)}</p>
                    <p className="mt-1 text-xs text-slate-500">Retirada: {formatRetiradoEm(row.retirado_em)}</p>
                    <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      Sem equipamento
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="btn-primary mt-3 w-full text-xs"
                        onClick={() => setSubstituirTarget(row)}
                      >
                        Substituir equipamento
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {drawerMode && (
        <FormDrawer
          eyebrow="Estoque"
          title={drawerMode === "create" ? "Adicionar ao estoque" : "Editar estoque"}
          description="Cadastre a configuração física disponível, sem código de ponto (E-XXX)."
          onClose={() => setDrawerMode(null)}
          footer={
            <div className="inv-drawer__footer-actions">
              <button type="button" className="btn-secondary" onClick={() => setDrawerMode(null)} disabled={saving}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          }
        >
          <EstoqueStockForm form={form} errors={errors} onChange={onChange} onTipoChange={onTipoChange} />
        </FormDrawer>
      )}

      {substituirTarget && (
        <SubstituirEquipamentoDrawer
          extintorId={substituirTarget.id}
          codigo={substituirTarget.codigo}
          expectedConfig={{
            tipo: substituirTarget.tipo,
            tamanho: substituirTarget.tamanho,
            capacidade_extintora: substituirTarget.capacidade_extintora,
          }}
          activeBaseId={activeBaseId}
          saving={substituindo}
          onClose={() => setSubstituirTarget(null)}
          onConfirm={handleSubstituir}
        />
      )}
    </div>
  );
}
