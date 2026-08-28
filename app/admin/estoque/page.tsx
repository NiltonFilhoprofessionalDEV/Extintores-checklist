"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentSession, getProfileBySession, type UserRole } from "@/lib/auth/profile";
import { isAdminLikeRole, isInventoryReadOnlyRole, canManageInventory } from "@/lib/auth/roles";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { DashboardStatCard } from "@/app/admin/dashboard/dashboard-stat-card";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";
import { normalizeEstoquePayload, estoqueFormFromRow } from "@/lib/estoque/stock-form";
import FormDrawer from "@/src/components/inventory/FormDrawer";
import RowActionsMenu from "@/src/components/RowActionsMenu";
import EstoqueStockForm, { useEstoqueFormState } from "@/src/components/estoque/EstoqueStockForm";
import SubstituirEquipamentoDrawer from "@/src/components/estoque/SubstituirEquipamentoDrawer";
import RetiradaLoteDrawer from "@/src/components/estoque/RetiradaLoteDrawer";
import { formatDateOnlyPt } from "@/lib/date/date-only";
import { buildStockStatsByTipo, colorForTipo } from "@/lib/estoque/stock-stats";
import { formatPrevisaoRetorno } from "@/src/components/estoque/RetiradaEquipamentoDrawer";
import ManutencaoLoteItemList, {
  type ManutencaoLoteItem,
} from "@/src/components/estoque/ManutencaoLoteItemList";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";

type EstoqueRow = {
  id: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
};

type SubstituirTarget = {
  id: string;
  codigo: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
};

type ManutencaoLote = {
  id: string;
  motivo: string;
  previsao_retorno: string | null;
  creator_nome: string;
  created_at: string;
  item_count: number;
};

type ViewMode = "estoque" | "manutencao";

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
  const [lotes, setLotes] = useState<ManutencaoLote[]>([]);
  const [loteItems, setLoteItems] = useState<ManutencaoLoteItem[]>([]);
  const [expandedLoteId, setExpandedLoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actorRole, setActorRole] = useState<UserRole>("admin");
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [substituirTarget, setSubstituirTarget] = useState<SubstituirTarget | null>(null);
  const [substituindo, setSubstituindo] = useState(false);
  const [loteDrawerOpen, setLoteDrawerOpen] = useState(false);
  const [loteSaving, setLoteSaving] = useState(false);
  const [cancelandoRetiradaId, setCancelandoRetiradaId] = useState<string | null>(null);
  const [loteAutoExpandDone, setLoteAutoExpandDone] = useState(false);

  const { form, errors, onChange, onTipoChange, validate, reset } = useEstoqueFormState();
  const readOnly = isInventoryReadOnlyRole(actorRole);
  const canDelete = isAdminLikeRole(actorRole);
  const canManage = canManageInventory(actorRole);
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
        .select("id,tipo,tamanho,capacidade_extintora,quantidade,manutencao_2_nivel,manutencao_3_nivel")
        .order("tipo", { ascending: true });

      if (activeBaseId) estoqueQuery = estoqueQuery.eq("base_id", activeBaseId);

      const estRes = await estoqueQuery;

      if (estRes.error && /manutencao_2_nivel|manutencao_3_nivel|schema cache/i.test(estRes.error.message)) {
        let fallbackQuery = supabase
          .from("estoque_extintores")
          .select("id,tipo,tamanho,capacidade_extintora,quantidade")
          .order("tipo", { ascending: true });
        if (activeBaseId) fallbackQuery = fallbackQuery.eq("base_id", activeBaseId);
        const fbRes = await fallbackQuery;
        if (fbRes.error) {
          setFeedback({
            type: "err",
            msg: fbRes.error.message.includes("estoque_extintores")
              ? "Execute docs/migration_estoque_substituicao.sql no Supabase."
              : fbRes.error.message,
          });
          setItems([]);
        } else {
          setItems(
            (fbRes.data ?? []).map((row) => ({
              ...(row as Omit<EstoqueRow, "manutencao_2_nivel" | "manutencao_3_nivel">),
              manutencao_2_nivel: null,
              manutencao_3_nivel: null,
            })),
          );
        }
      } else if (estRes.error) {
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

      let lotesQuery = supabase
        .from("manutencao_lotes")
        .select("id,motivo,previsao_retorno,creator_nome,created_at,item_count")
        .order("created_at", { ascending: false });

      if (activeBaseId) lotesQuery = lotesQuery.eq("base_id", activeBaseId);

      const lotesRes = await lotesQuery;

      if (lotesRes.error && /manutencao_lotes|schema cache/i.test(lotesRes.error.message)) {
        setLotes([]);
        setLoteItems([]);
      } else if (!lotesRes.error) {
        const lotesData = (lotesRes.data ?? []) as ManutencaoLote[];
        setLotes(lotesData);

        if (lotesData.length > 0) {
          let histLoteQuery = supabase
            .from("extintor_equipment_history")
            .select(
              "lote_id,extintor_id,num_inmetro,extintores(codigo,setor,local_detalhado,pavimento,tipo,tamanho,capacidade_extintora,sem_equipamento,num_inmetro,num_cilindro)",
            )
            .eq("event_type", "retirada")
            .in("lote_id", lotesData.map((l) => l.id));

          if (activeBaseId) histLoteQuery = histLoteQuery.eq("base_id", activeBaseId);

          const histLoteRes = await histLoteQuery;
          if (!histLoteRes.error && histLoteRes.data) {
            const parsed: ManutencaoLoteItem[] = [];
            for (const row of histLoteRes.data as Array<{
              lote_id: string;
              extintor_id: string;
              num_inmetro: string | null;
              extintores: {
                codigo: string;
                setor: string;
                local_detalhado: string;
                pavimento: string | null;
                tipo: string;
                tamanho: string;
                capacidade_extintora: string;
                sem_equipamento: boolean;
                num_inmetro: string | null;
                num_cilindro: string | null;
              } | null;
            }>) {
              if (!row.extintores || !row.lote_id) continue;
              parsed.push({
                lote_id: row.lote_id,
                extintor_id: row.extintor_id,
                codigo: row.extintores.codigo,
                setor: row.extintores.setor,
                local_detalhado: row.extintores.local_detalhado,
                pavimento: row.extintores.pavimento,
                tipo: row.extintores.tipo,
                tamanho: row.extintores.tamanho,
                capacidade_extintora: row.extintores.capacidade_extintora,
                num_inmetro_retirado: row.num_inmetro,
                num_inmetro_instalado: row.extintores.sem_equipamento
                  ? null
                  : row.extintores.num_inmetro,
                num_cilindro_instalado: row.extintores.sem_equipamento
                  ? null
                  : row.extintores.num_cilindro,
                sem_equipamento: row.extintores.sem_equipamento,
              });
            }
            setLoteItems(parsed);
          } else {
            setLoteItems([]);
          }
        } else {
          setLoteItems([]);
        }
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

  useEffect(() => {
    if (view === "manutencao" && lotes.length > 0 && !loteAutoExpandDone) {
      setExpandedLoteId(lotes[0].id);
      setLoteAutoExpandDone(true);
    }
  }, [view, lotes, loteAutoExpandDone]);

  useEffect(() => {
    if (view !== "manutencao") setLoteAutoExpandDone(false);
  }, [view]);

  const stats = useMemo(() => buildStockStatsByTipo(items), [items]);

  function openCreate() {
    reset();
    setEditId(null);
    setDrawerMode("create");
  }

  function openEdit(row: EstoqueRow) {
    reset(estoqueFormFromRow(row));
    setEditId(row.id);
    setDrawerMode("edit");
  }

  function openSubstituirFromLoteItem(item: ManutencaoLoteItem) {
    if (!item.sem_equipamento) return;
    setSubstituirTarget({
      id: item.extintor_id,
      codigo: item.codigo,
      tipo: item.tipo,
      tamanho: item.tamanho,
      capacidade_extintora: item.capacidade_extintora,
    });
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

  async function handleCancelarRetirada(item: ManutencaoLoteItem) {
    if (!item.sem_equipamento) return;
    const inmetro = item.num_inmetro_retirado?.trim();
    const msg = inmetro
      ? `Cancelar a retirada e devolver o equipamento INMETRO ${inmetro} ao ponto ${formatEquipmentIdentifier("extintor", item.codigo)}?`
      : `Cancelar a retirada e devolver o equipamento original ao ponto ${formatEquipmentIdentifier("extintor", item.codigo)}?`;
    if (!window.confirm(msg)) return;

    setCancelandoRetiradaId(item.extintor_id);
    setFeedback(null);
    try {
      await callApi("/api/admin/extintores/cancelar-retirada", {
        method: "POST",
        body: JSON.stringify({ id: item.extintor_id }),
      });
      setFeedback({
        type: "ok",
        msg: `Retirada cancelada. Equipamento restaurado em ${formatEquipmentIdentifier("extintor", item.codigo)}.`,
      });
      await loadData();
    } catch (error) {
      setFeedback({
        type: "err",
        msg: error instanceof Error ? error.message : "Erro ao cancelar retirada.",
      });
    } finally {
      setCancelandoRetiradaId(null);
    }
  }

  async function handleRetiradaLote(payload: {
    extintor_ids: string[];
    motivo: string;
    previsao_retorno: string | null;
  }) {
    setLoteSaving(true);
    try {
      await callApi("/api/admin/extintores/retirada-lote", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setFeedback({
        type: "ok",
        msg: `Lista de manutenção criada com ${payload.extintor_ids.length} extintor(es) retirado(s).`,
      });
      setLoteDrawerOpen(false);
      setView("manutencao");
      await loadData();
    } catch (error) {
      setFeedback({
        type: "err",
        msg: error instanceof Error ? error.message : "Erro na retirada em lote.",
      });
    } finally {
      setLoteSaving(false);
    }
  }

  const manutencaoPendentes = useMemo(
    () => loteItems.filter((item) => item.sem_equipamento).length,
    [loteItems],
  );

  const loteItemsByLote = useMemo(() => {
    const map = new Map<string, ManutencaoLoteItem[]>();
    for (const item of loteItems) {
      const list = map.get(item.lote_id) ?? [];
      list.push(item);
      map.set(item.lote_id, list);
    }
    return map;
  }, [loteItems]);

  return (
    <div className="inv-page">
      <div className="professional-card inv-header">
        <div className="min-w-0">
          <h1 className="inv-header__title text-xl font-bold text-slate-900 sm:text-2xl">
            Estoque e Manutenção
          </h1>
          <p className="inv-header__subtitle mt-1 text-sm text-slate-500">
            Equipamentos disponíveis para substituição e ordens de serviço de manutenção
          </p>
        </div>
        <div className="inv-header__actions w-full sm:w-auto">
          {!readOnly && view === "estoque" && (
            <button type="button" onClick={openCreate} className="btn-primary w-full sm:w-auto">
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

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          className={`w-full sm:w-auto ${view === "estoque" ? "btn-primary text-xs" : "btn-secondary text-xs"}`}
          onClick={() => setView("estoque")}
        >
          Estoque disponível
        </button>
        <button
          type="button"
          className={`w-full sm:w-auto ${view === "manutencao" ? "btn-primary text-xs" : "btn-secondary text-xs"}`}
          onClick={() => setView("manutencao")}
        >
          Lista de manutenção ({manutencaoPendentes})
        </button>
      </div>

      {view === "estoque" && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <DashboardStatCard
              label="Total disponível"
              value={stats.total}
              color="#0f766e"
              icon={<StatBoxesIcon />}
            />
            {stats.porTipo.map((row, index) => (
              <DashboardStatCard
                key={row.tipo}
                label={row.tipo}
                value={row.quantidade}
                color={colorForTipo(row.tipo, index)}
                icon={<StatBoxesIcon />}
              />
            ))}
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

      {view === "manutencao" && (
        <>
          <div className="professional-card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Listas de manutenção em lote</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Controle principal das retiradas em lote — data, responsável e substituição por item.
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="btn-primary w-full text-xs sm:w-auto shrink-0"
                  onClick={() => setLoteDrawerOpen(true)}
                >
                  Retirada em lote
                </button>
              )}
            </div>

            {loading ? (
              <p className="p-6 text-sm text-slate-500">Carregando listas...</p>
            ) : lotes.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                Nenhuma lista em lote salva. Use &quot;Retirada em lote&quot; para remover vários extintores de uma vez.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {lotes.map((lote) => {
                  const items = loteItemsByLote.get(lote.id) ?? [];
                  const expanded = expandedLoteId === lote.id;
                  const pendentes = items.filter((i) => i.sem_equipamento).length;
                  return (
                    <div key={lote.id} className="px-4 py-4 sm:px-5">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 text-left"
                        onClick={() => setExpandedLoteId(expanded ? null : lote.id)}
                        aria-expanded={expanded}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">{lote.motivo}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateOnlyPt(lote.created_at)} · Criado por {lote.creator_nome}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {lote.item_count} extintor{lote.item_count !== 1 ? "es" : ""}
                            {items.length > 0 ? ` · ${pendentes} ainda sem equipamento` : ""}
                            {lote.previsao_retorno
                              ? ` · Previsão: ${formatPrevisaoRetorno(lote.previsao_retorno)}`
                              : " · Sem data prevista"}
                          </p>
                        </div>
                        <svg
                          width={20}
                          height={20}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className={`shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                        </svg>
                      </button>

                      {expanded && items.length > 0 && (
                        <div className="mt-4">
                          <ManutencaoLoteItemList
                            items={items}
                            readOnly={readOnly}
                            cancelandoId={cancelandoRetiradaId}
                            onSubstituir={openSubstituirFromLoteItem}
                            onCancelarRetirada={handleCancelarRetirada}
                          />
                        </div>
                      )}

                      {expanded && items.length === 0 && (
                        <p className="mt-3 text-sm text-slate-500">Nenhum item vinculado a esta lista.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {drawerMode && (
        <FormDrawer
          eyebrow="Estoque"
          title={drawerMode === "create" ? "Adicionar ao estoque" : "Editar estoque"}
          description="Cadastre equipamentos no estoque (tipo, carga, classe e datas de manutenção), sem código E-XXX, INMETRO ou localização."
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

      {loteDrawerOpen && (
        <RetiradaLoteDrawer
          activeBaseId={activeBaseId}
          saving={loteSaving}
          onClose={() => setLoteDrawerOpen(false)}
          onConfirm={handleRetiradaLote}
        />
      )}
    </div>
  );
}
