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
    <main
      className="flex min-h-screen w-full flex-col"
      style={{ background: "linear-gradient(160deg, #E02020 0%, #B51313 55%, #7f0d0d 100%)" }}
    >
      {/* Top brand area */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo size={96} />
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-white leading-none">
              Extintor
            </h1>
            <p className="mt-0.5 text-base font-semibold uppercase tracking-[0.25em] text-white/80">
              Conferência
            </p>
            <p className="mt-3 text-sm font-medium text-white/60 uppercase tracking-widest">
              Segurança que se confere
            </p>
          </div>
        </div>
      </div>

      {/* Login card — slides up from bottom */}
      <div className="w-full rounded-t-3xl bg-white px-6 pb-10 pt-8 shadow-2xl">
        <h2 className="mb-1 text-xl font-bold text-gray-900">Entrar</h2>
        <p className="mb-6 text-sm text-gray-500">
          Use o acesso criado pelo administrador.
        </p>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-[#E02020] focus:outline-none focus:ring-2 focus:ring-[#E02020]/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-[#E02020] focus:outline-none focus:ring-2 focus:ring-[#E02020]/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {message && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <span>⚠</span>
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl py-4 text-base font-bold text-white disabled:opacity-60"
            style={{ background: loading ? "#B51313" : "linear-gradient(90deg, #E02020, #B51313)" }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-400">Versão 1.0.0</p>
      </div>
    </main>
  );
}
