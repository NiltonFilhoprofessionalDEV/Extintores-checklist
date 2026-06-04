"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { signOutCurrentUser } from "@/lib/auth/session-client";
import { getCurrentSession, getProfileBySession, type Profile } from "@/lib/auth/profile";

type Stats = {
  totalInspecoes: number;
  ultimaInspecao: string | null;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export default function MobilePerfilPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [stats, setStats] = useState<Stats>({ totalInspecoes: 0, ultimaInspecao: null });
  const [loading, setLoading] = useState(true);
  const [showConfirmSignOut, setShowConfirmSignOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const session = await getCurrentSession();
        if (!session) { router.replace("/login"); return; }

        setEmail(session.user.email ?? "");
        const prof = await getProfileBySession(session);
        setProfile(prof);

        // Fetch inspection stats for this user
        const { data: checklists } = await supabase
          .from("checklists")
          .select("id, data_conferencia")
          .order("data_conferencia", { ascending: false });

        const list = checklists ?? [];
        setStats({
          totalInspecoes: list.length,
          ultimaInspecao: (list[0]?.data_conferencia as string | undefined) ?? null,
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [supabase, router]);

  async function handleSignOut() {
    await signOutCurrentUser();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E02020] border-t-transparent" />
      </div>
    );
  }

  const roleLabel =
    profile?.role === "admin"
      ? "Administrador"
      : profile?.role === "leadership"
        ? "Liderança"
        : "Conferente";
  const roleBg =
    profile?.role === "admin" ? "#fef3c7" : profile?.role === "leadership" ? "#ede9fe" : "#dbeafe";
  const roleColor =
    profile?.role === "admin" ? "#92400e" : profile?.role === "leadership" ? "#5b21b6" : "#1e40af";

  const formattedLastInspection = stats.ultimaInspecao
    ? new Date(stats.ultimaInspecao).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Nenhuma ainda";

  return (
    <div className="space-y-4">
      {/* Avatar + name card */}
      <div className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl shadow-slate-300/60">
        <div className="px-5 py-6 flex flex-col items-center gap-3">
          {/* Avatar circle with initials */}
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 ring-4 ring-white/20">
            <span className="text-3xl font-extrabold text-white">
              {(profile?.nome ?? email).charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="text-center">
            <h2 className="text-xl font-extrabold leading-tight">
              {profile?.nome ?? "Usuário"}
            </h2>
            <p className="mt-0.5 text-sm text-white/70">{email}</p>
          </div>

          {/* Role badge */}
          <span
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: roleBg, color: roleColor }}
          >
            {roleLabel}
          </span>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 divide-x divide-white/20 border-t border-white/20 bg-black/10">
          <div className="flex flex-col items-center py-3.5">
            <p className="text-2xl font-extrabold text-white">{stats.totalInspecoes}</p>
            <p className="text-[11px] font-medium text-white/60 uppercase tracking-wider">Inspeções</p>
          </div>
          <div className="flex flex-col items-center py-3.5">
            <p className="text-sm font-bold text-white leading-tight text-center px-2">
              {formattedLastInspection}
            </p>
            <p className="text-[11px] font-medium text-white/60 uppercase tracking-wider">Última inspeção</p>
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="section-card px-5">
        <p className="pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Dados da conta
        </p>
        <div className="divide-y divide-slate-100">
          <InfoRow label="Nome" value={profile?.nome ?? "—"} />
          <InfoRow label="E-mail" value={email || "—"} />
          <InfoRow label="Função" value={roleLabel} />
          <InfoRow
            label="Status"
            value={profile?.active ? "Ativo" : "Inativo"}
          />
        </div>
        <div className="pb-2" />
      </div>

      {/* Activity */}
      <div className="section-card px-5">
        <p className="pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Atividade
        </p>
        <div className="divide-y divide-slate-100">
          <InfoRow label="Total de inspeções registradas" value={String(stats.totalInspecoes)} />
          <InfoRow label="Última conferência" value={formattedLastInspection} />
        </div>
        <div className="pb-2" />
      </div>

      {/* Actions */}
      <div className="section-card px-5">
        <p className="pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Ações
        </p>

        <Link
          href="/mobile/configuracoes"
          className="flex w-full items-center justify-between border-b border-slate-100 py-3.5 text-sm font-semibold text-slate-800"
        >
          <span className="flex items-center gap-3">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configurações da conta
          </span>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <button
          type="button"
          onClick={() => setShowConfirmSignOut(true)}
          className="flex w-full items-center justify-between py-3.5 text-sm font-semibold text-red-600"
        >
          <span className="flex items-center gap-3">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair do sistema
          </span>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="pb-2" />
      </div>

      {/* App info */}
      <div className="pb-4 text-center">
        <p className="text-xs text-slate-400">FireCheck · Versão 1.0.0</p>
        <p className="mt-0.5 text-[10px] text-slate-300">Segurança que se confere</p>
      </div>

      {/* Confirm sign out modal */}
      {showConfirmSignOut && (
        <div className="fixed inset-0 z-[1000] flex items-end bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl shadow-slate-950/30">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200" />

            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#E02020" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">Sair do sistema?</p>
                <p className="text-xs text-gray-500">Você precisará fazer login novamente.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="btn-primary w-full py-3.5"
              >
                Sim, sair agora
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmSignOut(false)}
                className="w-full rounded-xl border border-gray-200 py-3.5 text-sm font-semibold text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
