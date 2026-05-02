"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getProfileBySession } from "@/lib/auth/profile";
import BrandLogo from "@/src/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = getSupabaseClient();
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

    router.replace(profile.role === "admin" ? "/admin/dashboard" : "/mobile/conferencia");
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col bg-slate-50">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-slate-900 via-slate-800/95 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col px-5 pb-10 pt-14 sm:mx-auto sm:w-full sm:max-w-md sm:px-6 sm:pt-20">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-900/20 backdrop-blur-sm">
            <BrandLogo size={72} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Extintor Conferência</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-300">
            Gestão de inspeções e conformidade em um só lugar.
          </p>
        </div>

        <div className="mt-auto rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/5 sm:mt-0">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Acesso</h2>
            <p className="mt-1 text-sm text-slate-500">Entre com o e-mail e a senha fornecidos pelo administrador.</p>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="nome@empresa.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {message && (
              <div
                role="alert"
                className="flex gap-2 rounded-xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-800"
              >
                <span className="shrink-0 font-medium">Erro</span>
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">Versão 1.0.0</p>
        </div>
      </div>
    </main>
  );
}
