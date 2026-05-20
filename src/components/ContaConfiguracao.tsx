"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentSession, getProfileBySession, type Profile } from "@/lib/auth/profile";
import { getHomePathForRole, ROLE_LABELS } from "@/lib/auth/roles";
import { getSupabaseClient } from "@/lib/supabase/client";

type ContaConfiguracaoProps = {
  backHref: string;
  backLabel: string;
};

export default function ContaConfiguracao({ backHref, backLabel }: ContaConfiguracaoProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await getCurrentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setEmail(session.user.email ?? "");
      const prof = await getProfileBySession(session);
      if (!prof?.active) {
        router.replace("/login");
        return;
      }
      setProfile(prof);
      setNome(prof.nome);
    } catch {
      setError("Não foi possível carregar seus dados.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function callContaApi(body: Record<string, unknown>) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Sessão expirada. Faça login novamente.");

    const response = await fetch("/api/conta/perfil", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let payload: { error?: string; profile?: Profile } | null = null;
    try {
      payload = text ? (JSON.parse(text) as { error?: string; profile?: Profile }) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(payload?.error ?? "Falha ao salvar dados.");
    }

    return payload;
  }

  async function handleSavePerfil(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPerfil(true);
    setMessage("");
    setError("");

    try {
      const result = await callContaApi({ nome: nome.trim() });
      if (result?.profile) setProfile(result.profile);
      setMessage("Dados salvos com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar nome.");
    } finally {
      setSavingPerfil(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSenha(true);
    setMessage("");
    setError("");

    if (novaSenha.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      setSavingSenha(false);
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError("A confirmação da senha não confere.");
      setSavingSenha(false);
      return;
    }

    try {
      if (senhaAtual.trim()) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: senhaAtual,
        });
        if (signInError) {
          setError("Senha atual incorreta.");
          setSavingSenha(false);
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: novaSenha });
      if (updateError) throw updateError;

      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setMessage("Senha alterada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar senha.");
    } finally {
      setSavingSenha(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E02020] border-t-transparent" />
      </div>
    );
  }

  const homeHref = profile ? getHomePathForRole(profile.role) : backHref;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel}
        </Link>
      </div>

      <div className="page-hero p-6">
        <div className="page-hero-content">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-red-200">Conta</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Configurações</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-300">
            Atualize seu nome e senha. E-mail e função são gerenciados pelo administrador.
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      <form className="section-card space-y-4 p-6" onSubmit={handleSavePerfil}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dados pessoais</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Informações do perfil</h2>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="nome" className="text-sm font-semibold text-slate-700">
            Nome completo *
          </label>
          <input
            id="nome"
            required
            type="text"
            autoComplete="name"
            className="field-control"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome para conferências e relatórios"
          />
          <p className="text-xs text-slate-500">
            Este nome aparece no campo &quot;Conferente&quot; das inspeções.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">E-mail</label>
            <input
              type="email"
              readOnly
              className="field-control cursor-not-allowed bg-slate-50 text-slate-500"
              value={email}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Função</label>
            <input
              type="text"
              readOnly
              className="field-control cursor-not-allowed bg-slate-50 text-slate-500"
              value={profile ? ROLE_LABELS[profile.role] : ""}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Status da conta</label>
          <input
            type="text"
            readOnly
            className="field-control cursor-not-allowed bg-slate-50 text-slate-500"
            value={profile?.active ? "Ativo" : "Inativo"}
          />
        </div>

        <button type="submit" disabled={savingPerfil} className="btn-primary w-full sm:w-auto">
          {savingPerfil ? "Salvando…" : "Salvar dados"}
        </button>
      </form>

      <form className="section-card space-y-4 p-6" onSubmit={handleChangePassword}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Segurança</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Alterar senha</h2>
          <p className="mt-1 text-sm text-slate-500">
            Por segurança, confirme sua senha atual antes de definir uma nova.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="senha-atual" className="text-sm font-semibold text-slate-700">
            Senha atual
          </label>
          <input
            id="senha-atual"
            type="password"
            autoComplete="current-password"
            className="field-control"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            placeholder="Obrigatória para alterar a senha"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="nova-senha" className="text-sm font-semibold text-slate-700">
              Nova senha
            </label>
            <input
              id="nova-senha"
              type="password"
              autoComplete="new-password"
              minLength={6}
              className="field-control"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmar-senha" className="text-sm font-semibold text-slate-700">
              Confirmar nova senha
            </label>
            <input
              id="confirmar-senha"
              type="password"
              autoComplete="new-password"
              minLength={6}
              className="field-control"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={savingSenha} className="btn-primary w-full sm:w-auto">
          {savingSenha ? "Alterando…" : "Alterar senha"}
        </button>
      </form>

      <p className="text-center text-xs text-slate-500">
        <Link href={homeHref} className="font-semibold text-slate-600 underline-offset-2 hover:underline">
          Voltar ao início
        </Link>
      </p>
    </div>
  );
}
