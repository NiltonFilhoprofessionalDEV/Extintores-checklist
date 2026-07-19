"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";
import { getHomePathForRole } from "@/lib/auth/roles";
import { waitForAuthReady } from "@/lib/auth/session-client";
import BrandLogo from "@/src/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        await waitForAuthReady();
        const session = await getCurrentSession();
        if (!session) return;

        const profile = await getProfileBySession(session);
        if (profile?.active && mounted) {
          router.replace(getHomePathForRole(profile.role));
        }
      } catch {
        // Mantém na tela de login se não conseguir validar perfil
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.session) {
        setMessage(error?.message ?? "E-mail ou senha incorretos.");
        setLoading(false);
        return;
      }

      const profile = await getProfileBySession(data.session);
      if (!profile?.active) {
        await supabase.auth.signOut();
        setMessage("Usuário desativado. Contate o administrador.");
        setLoading(false);
        return;
      }

      router.replace(getHomePathForRole(profile.role));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível concluir o login.");
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--orange)] border-t-transparent" />
          Verificando sessão…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_30px_80px_-45px_rgba(28,31,35,.35)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-[var(--graphite)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--orange)]/25 blur-3xl" />
          <div className="relative"><BrandLogo height={44} priority /></div>
          <div className="relative max-w-xl reveal-up">
            <p className="page-eyebrow !text-orange-300">Gestão de segurança</p>
            <h1 className="mt-4 text-5xl font-extrabold leading-[1.06] xl:text-6xl">
              Inspecionar ficou mais simples.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300">
              Inventário, mapas técnicos e conformidade em um fluxo claro para quem administra e para quem está em campo.
            </p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {["Inventário", "Mapeamento", "Inspeções"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 text-xs font-bold text-slate-200">
                <span className="mb-2 block h-1.5 w-6 rounded-full bg-[var(--orange)]" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-md reveal-up-delay">
            <div className="mb-10 lg:hidden"><BrandLogo height={44} priority /></div>
            <p className="page-eyebrow">Acesso seguro</p>
            <h2 className="mt-2 text-3xl font-extrabold text-[var(--ink)]">Bem-vindo de volta</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              Entre com as credenciais fornecidas pelo administrador da sua base.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleLogin}>
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-bold text-[var(--ink)]">E-mail</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="nome@empresa.com"
                  className="field-control !rounded-2xl !px-4 !py-3.5"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-bold text-[var(--ink)]">Senha</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    className="field-control !rounded-2xl !px-4 !py-3.5 !pr-14"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {showPassword ? <><path d="M3 3l18 18" /><path d="M10.6 10.6A2 2 0 0 0 13.4 13.4M9.9 5.1A11 11 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.4M6.6 6.6A13 13 0 0 0 2 12c1 2.5 5 7 10 7a11 11 0 0 0 4.4-.9" /></> : <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>}
                    </svg>
                  </button>
                </div>
              </div>

              {message && (
                <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full !rounded-2xl !py-3.5">
                {loading ? "Entrando…" : "Entrar no FireCheck"}
              </button>
            </form>
            <p className="mt-8 text-xs text-slate-400">FireCheck · Versão 1.0.0</p>
          </div>
        </section>
      </div>
    </main>
  );
}
