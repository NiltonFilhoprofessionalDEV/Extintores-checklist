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
      <main className="flex min-h-screen items-center justify-center bg-[var(--forest)] text-sm font-medium text-emerald-100/70">
        Verificando sessão…
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[var(--forest)]">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--neon)]/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-10 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl flex-1 items-center gap-8 px-5 py-10 lg:grid-cols-[minmax(0,560px)_420px] lg:gap-12 lg:px-8">
        <div className="hidden max-w-2xl lg:block reveal-up">
          <div className="mb-6 inline-flex rounded-full bg-[var(--neon)]/15 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-[var(--neon)] ring-1 ring-[var(--neon)]/25">
            FireCheck
          </div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight text-white">
            Inspeções claras. Conformidade em campo.
          </h1>
          <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-emerald-100/70">
            Extintores, hidrantes, planta técnica e histórico de conferências — tudo no mesmo fluxo operacional.
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col reveal-up-delay lg:justify-self-start">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5 flex justify-center px-6 py-4">
              <BrandLogo height={56} priority className="object-center drop-shadow-lg" />
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-emerald-100/65">
              Entre para continuar as inspeções da sua base.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/70 bg-white p-6 text-center shadow-2xl shadow-black/30">
            <div className="mx-auto mb-6 max-w-sm text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--forest-soft)]">Acesso</p>
              <h2 className="font-display mt-1 text-xl font-extrabold text-[var(--ink)]">Entrar</h2>
              <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">
                Use o e-mail e a senha fornecidos pelo administrador.
              </p>
            </div>

            <form className="mx-auto w-full max-w-sm space-y-5" onSubmit={handleLogin}>
              <div className="space-y-2.5">
                <label htmlFor="email" className="block text-center text-sm font-semibold text-slate-700">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="nome@empresa.com"
                  className="field-control rounded-full px-5 py-3 text-center text-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2.5">
                <label htmlFor="password" className="block text-center text-sm font-semibold text-slate-700">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="field-control rounded-full px-5 py-3 pr-16 text-center text-base"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 inline-flex h-9 w-12 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--neon)]/50"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 3l18 18" />
                        <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                        <path d="M9.88 5.09A10.73 10.73 0 0112 5c5 0 9 4.5 10 7a13.05 13.05 0 01-3.02 4.35" />
                        <path d="M6.61 6.61A13.11 13.11 0 002 12c1 2.5 5 7 10 7a10.9 10.9 0 004.39-.91" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {message && (
                <div
                  role="alert"
                  className="flex gap-2 rounded-xl border border-rose-100 bg-rose-50/90 px-4 py-3 text-sm text-rose-800"
                >
                  <span className="shrink-0 font-medium">Erro</span>
                  <span>{message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex w-full rounded-full py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-slate-400">Versão 1.0.0</p>
          </div>
        </div>
      </div>
    </main>
  );
}
