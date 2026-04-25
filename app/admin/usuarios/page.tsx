"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type UserItem = {
  id: string;
  nome: string;
  role: "admin" | "user";
  active: boolean;
  created_at: string;
};

type FormState = {
  email: string;
  password: string;
  nome: string;
  role: "admin" | "user";
};

const INITIAL_FORM: FormState = {
  email: "",
  password: "",
  nome: "",
  role: "user",
};

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => getSupabaseClient(), []);

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
      const payload = await callAdminApi<{ users: UserItem[] }>("/api/admin/usuarios");
      setUsers(payload.users);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, [callAdminApi]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      await callAdminApi("/api/admin/usuarios", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(INITIAL_FORM);
      setMessage("Usuário criado com sucesso.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar usuário.");
    }
  }

  async function toggleActive(user: UserItem) {
    setMessage("");
    try {
      await callAdminApi("/api/admin/usuarios", {
        method: "PATCH",
        body: JSON.stringify({
          id: user.id,
          nome: user.nome,
          role: user.role,
          active: !user.active,
        }),
      });
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar usuário.");
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Usuários e Permissões</h2>
        <p className="text-zinc-600">
          Crie logins com senha inicial e defina os perfis de Administrador ou Usuário comum.
        </p>
      </div>

      <form onSubmit={handleCreateUser} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-zinc-900">Novo usuário</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            required
            placeholder="Nome"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={form.nome}
            onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
          />
          <input
            type="email"
            required
            placeholder="E-mail"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            type="text"
            required
            minLength={6}
            placeholder="Senha inicial"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
          <select
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={form.role}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, role: event.target.value as "admin" | "user" }))
            }
          >
            <option value="user">Usuário comum</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <button
          type="submit"
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Criar usuário
        </button>
      </form>

      {message && <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">{message}</p>}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-zinc-900">Usuários cadastrados</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando...</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-zinc-900">{user.nome}</p>
                  <p className="text-xs text-zinc-500">
                    {user.role === "admin" ? "Administrador" : "Usuário comum"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(user)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    user.active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {user.active ? "Ativo" : "Inativo"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
