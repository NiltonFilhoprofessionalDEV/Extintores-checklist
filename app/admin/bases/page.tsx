"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { getSupabaseClient } from "@/lib/supabase/client";

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

export default function AdminBasesPage() {
  const { refresh } = useActiveBase();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [bases, setBases] = useState<BaseItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateAdmin[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [empresaTabs, setEmpresaTabs] = useState(false);
  const [equipesConferencia, setEquipesConferencia] = useState(false);
  const [adminMode, setAdminMode] = useState<AdminMode>("create");
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUserId, setAdminUserId] = useState("");

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

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Bases</h2>
        <p className="mt-1 text-sm text-slate-500">
          Crie uma nova base (aeroporto/empresa) e defina o administrador que fará a gestão completa
          dela.
        </p>
      </div>

      <form onSubmit={handleCreate} className="section-card space-y-4 p-5">
        <h3 className="text-lg font-black text-slate-950">Nova base</h3>
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

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Administrador da base
          </p>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setAdminMode("create")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                adminMode === "create"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Criar novo
            </button>
            <button
              type="button"
              onClick={() => setAdminMode("existing")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                adminMode === "existing"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
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
                type="text"
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

      {message && (
        <p className="surface-muted rounded-2xl p-3 text-sm font-medium text-slate-700">{message}</p>
      )}

      <div className="section-card p-5">
        <h3 className="mb-4 text-lg font-black text-slate-950">Bases acessíveis</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : bases.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma base vinculada ainda.</p>
        ) : (
          <div className="space-y-2">
            {bases.map((base) => (
              <div
                key={base.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <p className="font-bold text-slate-950">{base.nome}</p>
                  <p className="text-xs text-slate-500">{base.slug}</p>
                </div>
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    base.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {base.active ? "Ativa" : "Inativa"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
