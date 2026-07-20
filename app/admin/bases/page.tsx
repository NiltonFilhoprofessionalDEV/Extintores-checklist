"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import ModalCloseButton from "@/src/components/ModalCloseButton";
import RowActionsMenu from "@/src/components/RowActionsMenu";

type BaseItem = {
  id: string;
  slug: string;
  nome: string;
  active: boolean;
  config: Record<string, unknown> | null;
  created_at: string;
};

type CandidateAdmin = {
  id: string;
  nome: string;
  role: UserRole;
  base_id: string | null;
  active: boolean;
};

type AdminMode = "create" | "existing";

type EditState = {
  id: string;
  nome: string;
  slug: string;
  active: boolean;
  empresaTabs: boolean;
  equipesConferencia: boolean;
};

function readBaseFlags(config: Record<string, unknown> | null) {
  return {
    empresaTabs: config?.empresa_tabs === true,
    equipesConferencia: config?.equipes_conferencia === true,
  };
}

export default function AdminBasesPage() {
  const { refresh } = useActiveBase();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [bases, setBases] = useState<BaseItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateAdmin[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editBase, setEditBase] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BaseItem | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [empresaTabs, setEmpresaTabs] = useState(false);
  const [equipesConferencia, setEquipesConferencia] = useState(false);
  const [adminMode, setAdminMode] = useState<AdminMode>("create");
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUserId, setAdminUserId] = useState("");

  const deleteNameMatches = deleteTarget
    ? deleteConfirmName.trim() === deleteTarget.nome.trim()
    : false;

  const callApi = useCallback(
    async <T,>(url: string, init?: RequestInit) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");

      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(init?.headers ?? {}),
        },
      });

      const text = await response.text();
      let payload: (T & { error?: string }) | null = null;
      try {
        payload = text ? (JSON.parse(text) as T & { error?: string }) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error ?? text ?? "Falha na requisição.");
      }
      if (!payload) throw new Error("Resposta inválida da API.");
      return payload;
    },
    [supabase],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await callApi<{ bases: BaseItem[]; candidateAdmins: CandidateAdmin[] }>(
        "/api/admin/bases",
      );
      setBases(payload.bases);
      setCandidates(payload.candidateAdmins);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar bases.");
    } finally {
      setLoading(false);
    }
  }, [callApi]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function openEdit(base: BaseItem) {
    const flags = readBaseFlags(base.config);
    setEditBase({
      id: base.id,
      nome: base.nome,
      slug: base.slug,
      active: base.active,
      empresaTabs: flags.empresaTabs,
      equipesConferencia: flags.equipesConferencia,
    });
    setMessage("");
  }

  function openDelete(base: BaseItem) {
    setDeleteTarget(base);
    setDeleteConfirmName("");
    setMessage("");
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      await callApi("/api/admin/bases", {
        method: "POST",
        body: JSON.stringify({
          nome,
          slug: slug.trim() || undefined,
          empresa_tabs: empresaTabs,
          equipes_conferencia: equipesConferencia,
          admin_mode: adminMode,
          admin_nome: adminNome,
          admin_email: adminEmail,
          admin_password: adminPassword,
          admin_user_id: adminUserId,
        }),
      });
      setNome("");
      setSlug("");
      setEmpresaTabs(false);
      setEquipesConferencia(false);
      setAdminNome("");
      setAdminEmail("");
      setAdminPassword("");
      setAdminUserId("");
      setAdminMode("create");
      setMessage("Base criada e administrador vinculado com sucesso.");
      await load();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar base.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!editBase) return;

    setMessage("");
    setSaving(true);
    try {
      await callApi("/api/admin/bases", {
        method: "PATCH",
        body: JSON.stringify({
          id: editBase.id,
          nome: editBase.nome,
          slug: editBase.slug,
          active: editBase.active,
          empresa_tabs: editBase.empresaTabs,
          equipes_conferencia: editBase.equipesConferencia,
        }),
      });
      setEditBase(null);
      setMessage("Base atualizada com sucesso.");
      await load();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar base.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !deleteNameMatches) return;

    setMessage("");
    setSaving(true);
    try {
      await callApi("/api/admin/bases", {
        method: "DELETE",
        body: JSON.stringify({
          id: deleteTarget.id,
          confirm_name: deleteConfirmName.trim(),
        }),
      });
      setDeleteTarget(null);
      setDeleteConfirmName("");
      setMessage("Base excluída com sucesso.");
      await load();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao excluir base.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">Corporativo</p>
          <h2 className="text-2xl font-black tracking-tight text-[var(--ink)]">Bases</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
            Crie novas bases e gerencie as bases acessíveis ao seu perfil corporativo.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="professional-card space-y-4 p-5">
        <h3 className="text-lg font-black text-[var(--ink)]">Nova base</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="field-control"
            required
            placeholder="Nome da base (ex.: Aeroporto TECA)"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
          />
          <input
            className="field-control"
            placeholder="Slug (opcional, gerado do nome)"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={empresaTabs}
              onChange={(event) => setEmpresaTabs(event.target.checked)}
            />
            Abas Santa Genoveva / TECA no dashboard
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={equipesConferencia}
              onChange={(event) => setEquipesConferencia(event.target.checked)}
            />
            Filtro por equipes nas conferências
          </label>
        </div>

        <div className="border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            Administrador da base
          </p>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setAdminMode("create")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                adminMode === "create"
                  ? "bg-[var(--graphite)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--ink)]"
              }`}
            >
              Criar novo
            </button>
            <button
              type="button"
              onClick={() => setAdminMode("existing")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                adminMode === "existing"
                  ? "bg-[var(--graphite)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--ink)]"
              }`}
            >
              Selecionar existente
            </button>
          </div>

          {adminMode === "create" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="field-control"
                required
                placeholder="Nome do admin"
                value={adminNome}
                onChange={(event) => setAdminNome(event.target.value)}
              />
              <input
                className="field-control"
                type="email"
                required
                placeholder="E-mail"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
              />
              <input
                className="field-control"
                type="password"
                required
                minLength={6}
                placeholder="Senha inicial"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
              />
            </div>
          ) : (
            <select
              className="field-control"
              required
              value={adminUserId}
              onChange={(event) => setAdminUserId(event.target.value)}
            >
              <option value="">Selecione o usuário</option>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nome} · {ROLE_LABELS[user.role]}
                </option>
              ))}
            </select>
          )}
          {adminMode === "existing" && (
            <p className="mt-2 text-xs text-amber-700">
              O usuário selecionado passará a ser Administrador desta nova base (sai da base
              anterior, se houver).
            </p>
          )}
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Criando…" : "Criar base"}
        </button>
      </form>

      {message ? (
        <p className="professional-card p-3 text-sm font-medium text-[var(--ink)]">{message}</p>
      ) : null}

      <div className="professional-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[var(--ink)]">Bases acessíveis</h3>
          <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-bold text-[var(--muted-foreground)]">
            {bases.length}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Carregando...</p>
        ) : bases.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Nenhuma base vinculada ainda.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {bases.map((base) => {
              const flags = readBaseFlags(base.config);
              return (
                <article
                  key={base.id}
                  className="flex items-start justify-between gap-3 rounded-[1.15rem] border border-[var(--border)] bg-[var(--mist)]/60 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-extrabold text-[var(--ink)]">{base.nome}</h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          base.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {base.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted-foreground)]">{base.slug}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {flags.empresaTabs ? (
                        <span className="rounded-md bg-[var(--orange-soft)] px-2 py-1 text-[10px] font-bold text-[var(--orange-deep)]">
                          Abas empresa
                        </span>
                      ) : null}
                      {flags.equipesConferencia ? (
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                          Equipes
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <RowActionsMenu
                    label={base.nome}
                    onEdit={() => openEdit(base)}
                    onDelete={() => openDelete(base)}
                  />
                </article>
              );
            })}
          </div>
        )}
      </div>

      {editBase ? (
        <div className="modal-layer fixed inset-0 z-[5000] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div className="relative w-full max-w-lg rounded-[1.5rem] bg-white p-5 shadow-2xl">
            <ModalCloseButton onClick={() => setEditBase(null)} />

            <h3 className="pr-10 text-lg font-black text-[var(--ink)]">Editar base</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Atualize nome, slug, status e configurações da base.
            </p>

            <form onSubmit={handleUpdate} className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                    Nome
                  </span>
                  <input
                    className="field-control"
                    required
                    value={editBase.nome}
                    onChange={(event) =>
                      setEditBase((current) =>
                        current ? { ...current, nome: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                    Slug
                  </span>
                  <input
                    className="field-control"
                    required
                    value={editBase.slug}
                    onChange={(event) =>
                      setEditBase((current) =>
                        current ? { ...current, slug: event.target.value } : current,
                      )
                    }
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={editBase.active}
                  onChange={(event) =>
                    setEditBase((current) =>
                      current ? { ...current, active: event.target.checked } : current,
                    )
                  }
                />
                Base ativa
              </label>

              <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--mist)]/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Configurações
                </p>
                <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={editBase.empresaTabs}
                    onChange={(event) =>
                      setEditBase((current) =>
                        current ? { ...current, empresaTabs: event.target.checked } : current,
                      )
                    }
                  />
                  Abas Santa Genoveva / TECA no dashboard
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={editBase.equipesConferencia}
                    onChange={(event) =>
                      setEditBase((current) =>
                        current
                          ? { ...current, equipesConferencia: event.target.checked }
                          : current,
                      )
                    }
                  />
                  Filtro por equipes nas conferências
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditBase(null)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="modal-layer fixed inset-0 z-[5000] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div className="relative w-full max-w-lg rounded-[1.5rem] border border-rose-200 bg-white p-5 shadow-2xl">
            <ModalCloseButton
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirmName("");
              }}
            />

            <h3 className="pr-10 text-lg font-black text-rose-700">Excluir base</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Esta ação é <strong className="text-[var(--ink)]">permanente e irreversível</strong>.
              Todos os extintores, hidrantes, conferências e dados operacionais desta base serão
              removidos.
            </p>

            <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
              <p className="text-sm text-[var(--ink)]">
                Para confirmar, digite o nome da base{" "}
                <strong className="font-extrabold text-rose-700">{deleteTarget.nome}</strong>
              </p>
              <input
                className="field-control mt-3"
                value={deleteConfirmName}
                onChange={(event) => setDeleteConfirmName(event.target.value)}
                placeholder={deleteTarget.nome}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <p className="mt-3 text-xs text-[var(--muted-foreground)]">
              A base só pode ser excluída se não houver usuários vinculados a ela.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmName("");
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={!deleteNameMatches || saving}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition enabled:hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? "Excluindo…" : "Excluir base"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
