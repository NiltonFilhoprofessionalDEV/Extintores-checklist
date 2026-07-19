"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignableRoles,
  canManageTarget,
  ROLE_LABELS,
  TEAM_LABELS,
  USER_TEAMS,
  type UserRole,
  type UserTeam,
} from "@/lib/auth/roles";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { getSupabaseClient } from "@/lib/supabase/client";

type UserItem = {
  id: string;
  nome: string;
  role: UserRole;
  team: UserTeam | null;
  active: boolean;
  created_at: string;
};

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
  const { activeBaseId, accessibleBases } = useActiveBase();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [managerRole, setManagerRole] = useState<UserRole>("admin");
  const [managerTeam, setManagerTeam] = useState<UserTeam | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [editUser, setEditUser] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
  const formBaseIds =
    form.base_ids.length > 0 ? form.base_ids : selectedFormRole === "corporativo" ? defaultBaseIds : [];

  const callAdminApi = useCallback(async <T,>(url: string, init?: RequestInit) => {
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
  }, [supabase]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);

      const payload = await callAdminApi<{ users: UserItem[]; managerRole: UserRole; managerTeam: UserTeam | null }>(
        "/api/admin/usuarios",
      );
      setUsers(payload.users);
      setManagerRole(payload.managerRole);
      setManagerTeam(payload.managerTeam);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, [callAdminApi, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  function canActOn(user: UserItem): boolean {
    return canManageTarget(managerRole, user.role, managerTeam, user.team) && user.id !== currentUserId;
  }

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const base_ids =
      selectedFormRole === "corporativo"
        ? formBaseIds.length > 0
          ? formBaseIds
          : defaultBaseIds
        : undefined;

    if (selectedFormRole === "corporativo" && (!base_ids || base_ids.length === 0)) {
      setMessage("Selecione ao menos uma base para o usuário corporativo.");
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
      setMessage("Usuário criado com sucesso.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar usuário.");
    }
  }

  function openEdit(user: UserItem) {
    setEditUser({
      id: user.id,
      nome: user.nome,
      role: user.role,
      team: user.team,
      active: user.active,
      password: "",
      base_ids: user.role === "corporativo" ? defaultBaseIds : [],
    });
  }

  async function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editUser) return;
    setMessage("");

    const base_ids =
      editUser.role === "corporativo"
        ? editUser.base_ids.length > 0
          ? editUser.base_ids
          : defaultBaseIds
        : undefined;

    if (editUser.role === "corporativo" && (!base_ids || base_ids.length === 0)) {
      setMessage("Selecione ao menos uma base para o usuário corporativo.");
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
        <div className="page-hero-content">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-red-200">Acesso e governança</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Usuários e Permissões</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-300">
            {isLeadership
              ? `Cadastre, edite ou exclua usuários comuns da equipe ${managerTeam ?? "não definida"}.`
              : "Gerencie todos os perfis: Administrador, Liderança e Usuário comum, organizados por equipe."}
          </p>
        </div>
      </div>

      <form onSubmit={handleCreateUser} className="section-card p-5">
        <h3 className="mb-3 text-lg font-black text-slate-950">Novo usuário</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            type="text"
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
                  return {
                    ...prev,
                    role: nextRole,
                    team: isTeamRequired(nextRole) ? prev.team || USER_TEAMS[0] : "",
                    base_ids: nextRole === "corporativo" ? (prev.base_ids.length ? prev.base_ids : defaultBaseIds) : [],
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
          ) : selectedFormRole === "corporativo" ? (
            <div className="sm:col-span-2 lg:col-span-1">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Bases</p>
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
                              const current = prev.base_ids.length > 0 ? prev.base_ids : defaultBaseIds;
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
            </div>
          ) : (
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
        </div>

        <button
          type="submit"
          className="btn-primary mt-4"
        >
          Criar usuário
        </button>
      </form>

      {message && (
        <p className="surface-muted rounded-2xl p-3 text-sm font-medium text-slate-700">{message}</p>
      )}

      <div className="section-card p-5">
        <h3 className="mb-4 text-lg font-black text-slate-950">Usuários cadastrados</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum usuário cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => {
              const manageable = canActOn(user);
              return (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-slate-950">{user.nome}</p>
                    <p className="text-xs text-slate-500">
                      {ROLE_LABELS[user.role]}
                      {user.team ? ` · Equipe ${TEAM_LABELS[user.team]}` : " · Sem equipe"}
                      {!user.active && " · Inativo"}
                      {user.id === currentUserId && " · Você"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        user.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {user.active ? "Ativo" : "Inativo"}
                    </span>
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {user.team ? `Equipe ${TEAM_LABELS[user.team]}` : "Sem equipe"}
                    </span>
                    {manageable ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          Excluir
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Sem permissão</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="section-card w-full max-w-md space-y-3 p-5 shadow-2xl shadow-slate-950/30"
          >
            <h3 className="text-lg font-black text-slate-950">Editar usuário</h3>
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
                    return {
                      ...prev,
                      role: nextRole,
                      team: isTeamRequired(nextRole) ? prev.team ?? USER_TEAMS[0] : null,
                      base_ids:
                        nextRole === "corporativo"
                          ? prev.base_ids.length > 0
                            ? prev.base_ids
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
            ) : editUser.role === "corporativo" ? (
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Bases</p>
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
                                const current = prev.base_ids.length > 0 ? prev.base_ids : defaultBaseIds;
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
              </div>
            ) : (
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
              type="text"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="section-card w-full max-w-sm space-y-4 p-5 shadow-2xl shadow-slate-950/30">
            <h3 className="text-lg font-black text-slate-950">Excluir usuário</h3>
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
