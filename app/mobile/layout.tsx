"use client";

import AuthGuard from "@/src/components/AuthGuard";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";
import { ActiveBaseProvider } from "@/lib/auth/active-base-context";
import BrandLogo from "@/src/components/BrandLogo";

const NAV_LINKS = [
  {
    href: "/mobile/conferencia",
    label: "Inspeções",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.75}>
        {active ? (
          <>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </>
        )}
      </svg>
    ),
  },
  {
    href: "/mobile/mapa",
    label: "Mapa",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: "/mobile/perfil",
    label: "Perfil",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke={active ? "none" : "currentColor"} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        {active ? (
          <>
            <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
            <path d="M5.5 21a6.5 6.5 0 0113 0H5.5z" />
          </>
        ) : (
          <>
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </>
        )}
      </svg>
    ),
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function MobileNav({ isMapaRoute }: { isMapaRoute: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userInitials, setUserInitials] = useState("?");

  useEffect(() => {
    let mounted = true;

    const loadUserInitials = async () => {
      const session = await getCurrentSession();
      if (!session) return;

      const profile = await getProfileBySession(session).catch(() => null);
      if (!mounted) return;

      setUserInitials(getInitials(profile?.nome || session.user.email || "Usuário"));
    };

    void loadUserInitials();

    return () => {
      mounted = false;
    };
  }, []);

  function handleBackFromMap() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.replace("/mobile/conferencia");
  }

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-40 flex shrink-0 items-center justify-between bg-[var(--forest)] px-4 py-3 shadow-lg shadow-[var(--forest)]/30">
        <div className="px-2.5 py-1.5">
          <BrandLogo height={26} className="drop-shadow-md" />
        </div>
        <div className="flex items-center gap-2">
          <div
            className="grid h-9 min-w-9 place-items-center rounded-full bg-[var(--neon)] px-2 text-xs font-black tracking-tight text-[var(--neon-ink)] shadow-inner"
            aria-label={`Usuário logado: ${userInitials}`}
          >
            {userInitials}
          </div>
          {isMapaRoute ? (
            <button
              type="button"
              onClick={handleBackFromMap}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-100 transition hover:border-white/20 hover:text-white"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>
          ) : null}
        </div>
      </header>

      <nav className="mobile-dock" aria-label="Navegação principal">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_LINKS.map(({ href, label, icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex min-w-[4.5rem] flex-col items-center gap-1 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                  active
                    ? "bg-[var(--neon)] text-[var(--neon-ink)] shadow-md shadow-black/20"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {icon(active)}
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapaRoute = pathname.startsWith("/mobile/mapa");

  return (
    <AuthGuard allowedRoles={["user", "admin", "leadership"]}>
      <ActiveBaseProvider>
        <div
          className="app-shell-bg flex flex-col"
          style={{ height: "100dvh", maxHeight: "100dvh", overflow: "hidden" }}
        >
          <MobileNav isMapaRoute={isMapaRoute} />
          <main
            className={
              isMapaRoute
                ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden"
                : "mx-auto w-full max-w-2xl overflow-y-auto px-3 py-4 pb-28"
            }
            style={
              isMapaRoute
                ? {
                    flex: "1 1 0",
                    minHeight: 0,
                    /* Reserva espaço para a dock fixa não cobrir controles/marcadores */
                    paddingBottom: "var(--mobile-dock-clearance)",
                  }
                : { flex: "1 1 auto" }
            }
          >
            {children}
          </main>
        </div>
      </ActiveBaseProvider>
    </AuthGuard>
  );
}
