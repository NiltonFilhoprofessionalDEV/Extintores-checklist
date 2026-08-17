"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assignableRoles,
  canManageTarget,
  isMultiBaseRole,
  ROLE_LABELS,
  TEAM_LABELS,
  USER_TEAMS,
  type UserRole,
  type UserTeam,
} from "@/lib/auth/roles";
import ModalCloseButton from "@/src/components/ModalCloseButton";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { getCurrentSession } from "@/lib/auth/session-client";
import { getSupabaseClient } from "@/lib/supabase/client";
import UserList from "./UserList";
import type { UserItem } from "./user-types";

type FormState = {
  email: string;
  password: string;
  nome: string;
  role: UserRole;
  team: UserTeam | "";
  base_ids: string[];
};

type EditState = {
  id: string;
  nome: string;
  role: UserRole;
  team: UserTeam | null;
  active: boolean;
  password: string;
  base_ids: string[];
};

const INITIAL_FORM: FormState = {
  email: "",
  password: "",
  nome: "",
  role: "user",
  team: "",
  base_ids: [],
};

function isTeamRequired(role: UserRole): boolean {
  return role === "leadership" || role === "user";
}

export default function AdminUsuariosPage() {
  const { ready, activeBaseId, accessibleBases, activeBase } = useActiveBase();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [managerRole, setManagerRole] = useState<UserRole>("admin");
  const [managerTeam, setManagerTeam] = useState<UserTeam | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [editUser, setEditUser] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(false);
  const loadGenerationRef = useRef(0);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const creatableRoles = useMemo(() => assignableRoles(managerRole), [managerRole]);
  const selectedFormRole = creatableRoles.includes(form.role)
    ? form.role
    : (creatableRoles[0] ?? "user");
  const selectedFormTeam =
    managerRole === "leadership"
      ? managerTeam
      : isTeamRequired(selectedFormRole)
        ? form.team || USER_TEAMS[0]
        : form.team || null;
  const defaultBaseIds = useMemo(() => {
    if (activeBaseId) return [activeBaseId];
    return accessibleBases[0]?.id ? [accessibleBases[0].id] : [];
  }, [activeBaseId, accessibleBases]);
  const needsBasePicker =
    isMultiBaseRole(selectedFormRole) || managerRole === "admin_corporativo";
  const formBaseIds =
    form.base_ids.length > 0 ? form.base_ids : needsBasePicker ? defaultBaseIds : [];

  const callAdminApi = useCallback(async <T,>(url: string, init?: RequestInit) => {
    const session = await getCurrentSession();
    if (!session?.access_token) throw new Error("Sessão não encontrada.");

    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(activeBaseId ? { "X-Active-Base-Id": activeBaseId } : {}),
        ...(init?.headers ?? {}),
      },
    });

    const responseText = await response.text();
    let payload: (T & { error?: string }) | null = null;

    try {
      payload = responseText ? (JSON.parse(responseText) as T & { error?: string }) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.error ??
          responseText ??
          "Falha na requisição. Verifique SUPABASE_SERVICE_ROLE_KEY e schema do Supabase.",
      );
    }

    if (!payload) {
      throw new Error("Resposta inválida da API de usuários.");
    }

    return payload;
  }, [activeBaseId]);

  const loadUsers = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setListError("");
    try {
      const session = await getCurrentSession();
      if (session) setCurrentUserId(session.user.id);

      const payload = await callAdminApi<{ users: UserItem[]; managerRole: UserRole; managerTeam: UserTeam | null }>(
        "/api/admin/usuarios",
      );
      if (generation !== loadGenerationRef.current) return;
      setUsers(payload.users ?? []);
      setManagerRole(payload.managerRole);
      setManagerTeam(payload.managerTeam);
    } catch (error) {
      if (generation !== loadGenerationRef.current) return;
      const text = error instanceof Error ? error.message : "Não foi possível carregar os usuários.";
      console.error("[admin/usuarios] falha ao carregar lista", error);
      setListError(text);
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, [callAdminApi]);

  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers, ready, activeBaseId]);

  function canActOn(user: UserItem): boolean {
    return canManageTarget(managerRole, user.role, managerTeam, user.team) && user.id !== currentUserId;
  }

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const resolvedBaseIds =
      formBaseIds.length > 0 ? formBaseIds : needsBasePicker ? defaultBaseIds : [];
    const base_ids = needsBasePicker
      ? isMultiBaseRole(selectedFormRole)
        ? resolvedBaseIds
        : resolvedBaseIds.slice(0, 1)
      : undefined;

    if (needsBasePicker && (!base_ids || base_ids.length === 0)) {
      setMessage(
        isMultiBaseRole(selectedFormRole)
          ? "Selecione ao menos uma base para o usuário."
          : "Selecione a base do usuário.",
      );
      return;
    }

    try {
      await callAdminApi("/api/admin/usuarios", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          role: selectedFormRole,
          team: selectedFormTeam,
          ...(base_ids ? { base_ids } : {}),
        }),
      });
      setForm({ ...INITIAL_FORM, role: creatableRoles[0] ?? "user", base_ids: [] });
      setCreateModalOpen(false);
      setMessage("Usuário criado com sucesso.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar usuário.");
    }
  }

  async function openEdit(user: UserItem) {
    let base_ids: string[] = [];
    if (isMultiBaseRole(user.role)) {
      const { data, error } = await supabase.from("base_memberships").select("base_id").eq("user_id", user.id);
      if (error) {
        console.error("[admin/usuarios] falha ao ler memberships do usuário", error);
      }
      base_ids = (data ?? []).map((row) => String(row.base_id));
      if (base_ids.length === 0) base_ids = defaultBaseIds;
    } else if (user.base_id) {
      base_ids = [user.base_id];
    } else {
      base_ids = defaultBaseIds;
    }

    setEditUser({
      id: user.id,
      nome: user.nome,
      role: user.role,
      team: user.team,
      active: user.active,
      password: "",
      base_ids,
    });
  }

  async function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editUser) return;
    setMessage("");

    const editNeedsBasePicker =
      isMultiBaseRole(editUser.role) || managerRole === "admin_corporativo";
    const resolvedBaseIds =
      editUser.base_ids.length > 0 ? editUser.base_ids : editNeedsBasePicker ? defaultBaseIds : [];
    const base_ids = editNeedsBasePicker
      ? isMultiBaseRole(editUser.role)
        ? resolvedBaseIds
        : resolvedBaseIds.slice(0, 1)
      : undefined;

    if (editNeedsBasePicker && (!base_ids || base_ids.length === 0)) {
      setMessage(
        isMultiBaseRole(editUser.role)
          ? "Selecione ao menos uma base para o usuário."
          : "Selecione a base do usuário.",
      );
      return;
    }

    try {
      await callAdminApi("/api/admin/usuarios", {
        method: "PATCH",
        body: JSON.stringify({
          id: editUser.id,
          nome: editUser.nome,
          role: editUser.role,
          team:
            managerRole === "leadership"
              ? managerTeam
              : isTeamRequired(editUser.role)
                ? editUser.team ?? USER_TEAMS[0]
                : editUser.team,
          active: editUser.active,
          ...(editUser.password ? { password: editUser.password } : {}),
          ...(base_ids ? { base_ids } : {}),
        }),
      });
      setEditUser(null);
      setMessage("Usuário atualizado com sucesso.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar usuário.");
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setMessage("");

    try {
      await callAdminApi("/api/admin/usuarios", {
        method: "DELETE",
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      setDeleteTarget(null);
      setMessage("Usuário excluído com sucesso.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao excluir usuário.");
    }
  }

  const isLeadership = managerRole === "leadership";

  return (
    <section className="space-y-5">
      <div className="page-hero p-6">
        <div className="page-hero-content flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--neon)]">Acesso e governança</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Usuários e permissões</h2>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-300">
              {isLeadership
                ? `Gerencie usuários da equipe ${managerTeam ?? "não definida"}.`
                : "Gerencie perfis, equipes e acessos às bases do FireCheck."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm({ ...INITIAL_FORM, role: creatableRoles[0] ?? "user", base_ids: [] });
              setMessage("");
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-[var(--ink)] shadow-lg transition hover:bg-orange-50"
          >
            Novo usuário
            <span className="text-lg leading-none text-[var(--orange)]">＋</span>
          </button>
        </div>
      </div>

      {createModalOpen && (
        <div
          className="modal-layer fixed inset-0 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-user-title"
          onClick={() => setCreateModalOpen(false)}
        >
          <form
            onSubmit={handleCreateUser}
            className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6">
              <div>
                <p className="page-eyebrow">Acesso e permissões</p>
                <h3 id="new-user-title" className="mt-1 text-2xl font-extrabold text-[var(--ink)]">
                  Novo usuário
                </h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Preencha os dados para criar um novo acesso.
                </p>
              </div>
              <ModalCloseButton onClick={() => setCreateModalOpen(false)} />
            </div>

            <div className="grid gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2 sm:px-6">
          <input
            type="text"
            required
            placeholder="Nome"
            className="field-control"
            value={form.nome}
            onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
          />
          <input
            type="email"
            required
            placeholder="E-mail"
            className="field-control"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Senha inicial"
            className="field-control"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
          {creatableRoles.length > 1 ? (
            <select
              className="field-control"
              value={selectedFormRole}
              onChange={(event) =>
                setForm((prev) => {
                  const nextRole = event.target.value as UserRole;
                  const nextNeedsBase =
                    isMultiBaseRole(nextRole) || managerRole === "admin_corporativo";
                  return {
                    ...prev,
                    role: nextRole,
                    team: isTeamRequired(nextRole) ? prev.team || USER_TEAMS[0] : "",
                    base_ids: nextNeedsBase
                      ? prev.base_ids.length
                        ? isMultiBaseRole(nextRole)
                          ? prev.base_ids
                          : prev.base_ids.slice(0, 1)
                        : defaultBaseIds
                      : [],
                  };
                })
              }
            >
              {creatableRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
              Perfil: {ROLE_LABELS.user}
            </div>
          )}
          {managerRole === "leadership" ? (
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
              Equipe: {managerTeam ?? "—"}
            </div>
          ) : (
            <>
              {needsBasePicker && (
                <div className="sm:col-span-2 lg:col-span-1">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {isMultiBaseRole(selectedFormRole) ? "Bases" : "Base"}
                  </p>
                  {isMultiBaseRole(selectedFormRole) ? (
                    <div className="max-h-28 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white px-3 py-2">
                      {accessibleBases.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhuma base acessível.</p>
                      ) : (
                        accessibleBases.map((base) => {
                          const checked = formBaseIds.includes(base.id);
                          return (
                            <label key={base.id} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setForm((prev) => {
                                    const current =
                                      prev.base_ids.length > 0 ? prev.base_ids : defaultBaseIds;
                                    const next = checked
                                      ? current.filter((id) => id !== base.id)
                                      : [...current, base.id];
                                    return { ...prev, base_ids: next };
                                  })
                                }
                              />
                              {base.nome}
                            </label>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <select
                      className="field-control"
                      value={formBaseIds[0] ?? ""}
                      required
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          base_ids: event.target.value ? [event.target.value] : [],
                        }))
                      }
                    >
                      <option value="">Selecione a base</option>
                      {accessibleBases.map((base) => (
                        <option key={base.id} value={base.id}>
                          {base.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {!isMultiBaseRole(selectedFormRole) && (
                <select
                  className="field-control"
                  value={selectedFormTeam ?? ""}
                  required={isTeamRequired(selectedFormRole)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      team: event.target.value ? (event.target.value as UserTeam) : "",
                    }))
                  }
                >
                  {!isTeamRequired(selectedFormRole) && <option value="">Sem equipe</option>}
                  {USER_TEAMS.map((team) => (
                    <option key={team} value={team}>
                      Equipe {TEAM_LABELS[team]}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
              {message && (
                <p className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                  {message}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
              <button type="button" className="btn-secondary" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Criar usuário
              </button>
            </div>
          </form>
        </div>
      )}

      {message && (
        <p className="surface-muted rounded-2xl p-3 text-sm font-medium text-slate-700">{message}</p>
      )}

      <div className="professional-card p-5">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="page-eyebrow">Equipe e acessos</p>
            <h3 className="mt-1 text-xl font-extrabold text-[var(--ink)]">Usuários cadastrados</h3>
            {activeBase ? (
              <p className="mt-1 text-sm text-slate-500">
                Base ativa: <span className="font-semibold text-slate-700">{activeBase.nome}</span>
              </p>
            ) : null}
          </div>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-bold text-slate-600">
            {users.length} {users.length === 1 ? "usuário" : "usuários"}
          </span>
        </div>
        {!ready || loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm font-semibold text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--orange)] border-t-transparent" />
            Carregando usuários…
          </div>
        ) : listError ? (
          <div className="rounded-2xl bg-red-50 px-5 py-12 text-center">
            <p className="font-bold text-red-800">Não foi possível carregar os usuários</p>
            <p className="mt-1 text-sm text-red-700">{listError}</p>
            <button type="button" className="btn-primary mt-4" onClick={() => void loadUsers()}>
              Tentar novamente
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl bg-[var(--muted)] px-5 py-12 text-center">
            <p className="font-bold text-[var(--ink)]">Nenhum usuário cadastrado</p>
            <p className="mt-1 text-sm text-slate-500">
              {activeBase
                ? `Não há usuários nesta base (${activeBase.nome}). Troque a base ativa para ver os demais.`
                : "Use “Novo usuário” para criar o primeiro acesso."}
            </p>
          </div>
        ) : (
          <UserList
            users={users}
            currentUserId={currentUserId}
            canActOn={canActOn}
            onEdit={(user) => void openEdit(user)}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      {editUser && (
        <div className="modal-layer fixed inset-0 flex items-center justify-center bg-[var(--forest)]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="section-card w-full max-w-md space-y-3 p-5 shadow-2xl shadow-[var(--forest)]/30"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-[var(--ink)]">Editar usuário</h3>
              <ModalCloseButton onClick={() => setEditUser(null)} />
            </div>
            <input
              type="text"
              required
              placeholder="Nome"
              className="field-control"
              value={editUser.nome}
              onChange={(event) =>
                setEditUser((prev) => (prev ? { ...prev, nome: event.target.value } : prev))
              }
            />
            {assignableRoles(managerRole).length > 1 ? (
              <select
                className="field-control"
                value={editUser.role}
                onChange={(event) =>
                  setEditUser((prev) => {
                    if (!prev) return prev;
                    const nextRole = event.target.value as UserRole;
                    const nextNeedsBase =
                      isMultiBaseRole(nextRole) || managerRole === "admin_corporativo";
                    return {
                      ...prev,
                      role: nextRole,
                      team: isTeamRequired(nextRole) ? prev.team ?? USER_TEAMS[0] : null,
                      base_ids: nextNeedsBase
                        ? prev.base_ids.length
                          ? isMultiBaseRole(nextRole)
                            ? prev.base_ids
                            : prev.base_ids.slice(0, 1)
                          : defaultBaseIds
                        : [],
                    };
                  })
                }
              >
                {assignableRoles(managerRole).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-slate-600">Perfil: {ROLE_LABELS.user}</p>
            )}
            {managerRole === "leadership" ? (
              <p className="text-sm text-slate-600">Equipe: {managerTeam ?? "—"}</p>
            ) : (
              <>
                {(isMultiBaseRole(editUser.role) || managerRole === "admin_corporativo") && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {isMultiBaseRole(editUser.role) ? "Bases" : "Base"}
                    </p>
                    {isMultiBaseRole(editUser.role) ? (
                      <div className="max-h-28 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white px-3 py-2">
                        {accessibleBases.length === 0 ? (
                          <p className="text-xs text-slate-500">Nenhuma base acessível.</p>
                        ) : (
                          accessibleBases.map((base) => {
                            const selectedIds =
                              editUser.base_ids.length > 0 ? editUser.base_ids : defaultBaseIds;
                            const checked = selectedIds.includes(base.id);
                            return (
                              <label key={base.id} className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setEditUser((prev) => {
                                      if (!prev) return prev;
                                      const current =
                                        prev.base_ids.length > 0 ? prev.base_ids : defaultBaseIds;
                                      const next = checked
                                        ? current.filter((id) => id !== base.id)
                                        : [...current, base.id];
                                      return { ...prev, base_ids: next };
                                    })
                                  }
                                />
                                {base.nome}
                              </label>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <select
                        className="field-control"
                        value={
                          (editUser.base_ids[0] ?? defaultBaseIds[0] ?? "") as string
                        }
                        required
                        onChange={(event) =>
                          setEditUser((prev) =>
                            prev
                              ? { ...prev, base_ids: event.target.value ? [event.target.value] : [] }
                              : prev,
                          )
                        }
                      >
                        <option value="">Selecione a base</option>
                        {accessibleBases.map((base) => (
                          <option key={base.id} value={base.id}>
                            {base.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {!isMultiBaseRole(editUser.role) && (
                  <select
                    className="field-control"
                    value={editUser.team ?? ""}
                    required={isTeamRequired(editUser.role)}
                    onChange={(event) =>
                      setEditUser((prev) =>
                        prev
                          ? {
                              ...prev,
                              team: event.target.value ? (event.target.value as UserTeam) : null,
                            }
                          : prev,
                      )
                    }
                  >
                    {!isTeamRequired(editUser.role) && <option value="">Sem equipe</option>}
                    {USER_TEAMS.map((team) => (
                      <option key={team} value={team}>
                        Equipe {TEAM_LABELS[team]}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editUser.active}
                onChange={(event) =>
                  setEditUser((prev) => (prev ? { ...prev, active: event.target.checked } : prev))
                }
              />
              Usuário ativo
            </label>
            <input
              type="password"
              minLength={6}
              placeholder="Nova senha (opcional)"
              className="field-control"
              value={editUser.password}
              onChange={(event) =>
                setEditUser((prev) => (prev ? { ...prev, password: event.target.value } : prev))
              }
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-layer fixed inset-0 flex items-center justify-center bg-[var(--forest)]/60 p-4 backdrop-blur-sm">
          <div className="section-card w-full max-w-sm space-y-4 p-5 shadow-2xl shadow-[var(--forest)]/30">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-[var(--ink)]">Excluir usuário</h3>
              <ModalCloseButton onClick={() => setDeleteTarget(null)} />
            </div>
            <p className="text-sm text-slate-600">
              Tem certeza que deseja excluir <strong>{deleteTarget.nome}</strong>? Esta ação não
              pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteUser()}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
