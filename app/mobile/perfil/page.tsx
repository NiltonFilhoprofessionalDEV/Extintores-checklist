"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { signOutCurrentUser } from "@/lib/auth/session-client";
import { getCurrentSession } from "@/lib/auth/profile";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { APP_NAME, APP_VERSION } from "@/lib/app-version";
import { fetchProfileActivityStats, type ProfileActivityStats } from "@/lib/inspecao/profile-activity";
import ModalCloseButton from "@/src/components/ModalCloseButton";
import ProfileSettingsRow from "@/src/components/mobile/profile/ProfileSettingsRow";

function formatLastInspectionShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit" });
  const month = date
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .toUpperCase();
  return `${day} ${month}`;
}

function formatMetric(value: number | null | undefined, loading: boolean): string {
  if (loading) return "—";
  if (value == null) return "—";
  return String(value);
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <circle cx="12" cy="8" r="3.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 19.25c.9-3.1 3.4-4.75 6.5-4.75s5.6 1.65 6.5 4.75" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path strokeLinecap="round" d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <circle cx="12" cy="12" r="8.25" />
      <path strokeLinecap="round" d="M12 11v5" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H4m0 0l3.5-3.5M4 12l3.5 3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 5h6a3 3 0 013 3v8a3 3 0 01-3 3h-6" />
    </svg>
  );
}

const EMPTY_STATS: ProfileActivityStats = {
  today: null,
  month: null,
  total: null,
  lastAt: null,
};

export default function MobilePerfilPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { ready, profile, activeBase, activeBaseId } = useActiveBase();

  const [activity, setActivity] = useState<{ key: string; stats: ProfileActivityStats } | null>(null);
  const [showConfirmSignOut, setShowConfirmSignOut] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const requestKey = ready && profile?.nome ? `${profile.nome}|${activeBaseId ?? ""}` : "";
  const stats = activity?.key === requestKey ? activity.stats : EMPTY_STATS;
  const statsLoading = Boolean(requestKey) && activity?.key !== requestKey;

  useEffect(() => {
    void getCurrentSession().then((session) => {
      if (!session) router.replace("/login");
    });
  }, [router]);

  useEffect(() => {
    if (!requestKey || !profile?.nome) return;
    const conferente = profile.nome;
    const baseId = activeBaseId;
    let cancelled = false;
    void fetchProfileActivityStats(supabase, conferente, baseId)
      .then((next) => {
        if (!cancelled) setActivity({ key: requestKey, stats: next });
      })
      .catch(() => {
        if (!cancelled) setActivity({ key: requestKey, stats: EMPTY_STATS });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, profile?.nome, activeBaseId, supabase]);

  async function handleSignOut() {
    await signOutCurrentUser();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="profile-page" aria-busy="true">
        <div className="profile-hero profile-skeleton" />
        <div className="profile-skeleton profile-skeleton--block" />
        <div className="profile-skeleton profile-skeleton--block" />
      </div>
    );
  }

  const displayName = profile?.nome?.trim() || "Usuário";
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = profile ? ROLE_LABELS[profile.role] : "—";
  const baseName = activeBase?.nome?.trim() || "Base não definida";
  const lastLabel = stats.lastAt ? formatLastInspectionShort(stats.lastAt) : "—";
  const lastTitle = stats.lastAt
    ? new Date(stats.lastAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Nenhuma inspeção ainda";

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-hero__identity">
          <div className="profile-hero__avatar" aria-hidden>
            {initial}
          </div>
          <h1 className="profile-hero__name">{displayName}</h1>
          <p className="profile-hero__meta">
            {roleLabel} · {baseName}
          </p>
        </div>
        <div className="profile-hero__stats">
          <div>
            <p className="profile-hero__stat-value">{formatMetric(stats.total, statsLoading)}</p>
            <p className="profile-hero__stat-label">Inspeções</p>
          </div>
          <div>
            <p className="profile-hero__stat-value" title={lastTitle}>
              {statsLoading ? "—" : lastLabel}
            </p>
            <p className="profile-hero__stat-label">Última inspeção</p>
          </div>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-activity-title">
        <h2 id="profile-activity-title" className="profile-section__title">
          Minha atividade
        </h2>
        <div className="profile-activity">
          <div>
            <p className="profile-activity__value">{formatMetric(stats.today, statsLoading)}</p>
            <p className="profile-activity__label">Hoje</p>
          </div>
          <div>
            <p className="profile-activity__value">{formatMetric(stats.month, statsLoading)}</p>
            <p className="profile-activity__label">Este mês</p>
          </div>
          <div>
            <p className="profile-activity__value">{formatMetric(stats.total, statsLoading)}</p>
            <p className="profile-activity__label">Total</p>
          </div>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-account-title">
        <h2 id="profile-account-title" className="profile-section__title">
          Minha conta
        </h2>
        <div className="profile-group">
          <ProfileSettingsRow
            href="/mobile/configuracoes#dados-pessoais"
            icon={<UserIcon />}
            label="Dados pessoais"
          />
          <ProfileSettingsRow
            href="/mobile/configuracoes#alterar-senha"
            icon={<LockIcon />}
            label="Alterar senha"
          />
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-base-title">
        <h2 id="profile-base-title" className="profile-section__title">
          Base de trabalho
        </h2>
        <div className="profile-base">
          <p className="profile-base__name">{baseName}</p>
          <p className="profile-base__role">{roleLabel}</p>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-app-title">
        <h2 id="profile-app-title" className="profile-section__title">
          Aplicativo
        </h2>
        <div className="profile-group">
          <ProfileSettingsRow
            onClick={() => setShowAbout(true)}
            icon={<InfoIcon />}
            label={`Sobre o ${APP_NAME}`}
          />
        </div>
      </section>

      <div className="profile-logout">
        <ProfileSettingsRow
          onClick={() => setShowConfirmSignOut(true)}
          icon={<LogoutIcon />}
          label="Sair do sistema"
          destructive
        />
      </div>

      {showAbout && (
        <div className="modal-layer fixed inset-0 flex items-end bg-[var(--forest)]/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <div
            role="dialog"
            aria-labelledby="profile-about-title"
            className="relative w-full rounded-t-3xl bg-white px-5 pb-8 pt-5 sm:max-w-sm sm:rounded-2xl"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
            <ModalCloseButton onClick={() => setShowAbout(false)} className="absolute right-4 top-4" />
            <h2 id="profile-about-title" className="text-lg font-bold text-[var(--fc-text-primary)]">
              {APP_NAME}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Versão {APP_VERSION}</p>
          </div>
        </div>
      )}

      {showConfirmSignOut && (
        <div className="modal-layer fixed inset-0 flex items-end bg-[var(--forest)]/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <div className="relative w-full rounded-t-3xl bg-white px-5 pb-8 pt-5 sm:max-w-sm sm:rounded-2xl">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
            <ModalCloseButton
              onClick={() => setShowConfirmSignOut(false)}
              className="absolute right-4 top-4"
            />
            <p className="text-base font-bold text-gray-900">Sair do sistema?</p>
            <p className="mt-1 text-xs text-gray-500">Você precisará fazer login novamente.</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={handleSignOut} className="btn-primary w-full py-3.5">
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
