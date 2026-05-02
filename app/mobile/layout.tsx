"use client";

import AuthGuard from "@/src/components/AuthGuard";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
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

function MobileNav({ isMapaRoute }: { isMapaRoute: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      {/* Top header — escuro, coerente com a tela de login */}
      <header
        className="sticky top-0 z-40 flex shrink-0 items-center justify-between px-4 py-3"
        style={{ background: "#0f172a" }}
      >
        <div className="flex items-center gap-2.5">
          <BrandLogo size={28} />
          <div>
            <p className="text-xs font-bold leading-none text-white">Extintor</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Conferência</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
        >
          Sair
        </button>
      </header>

      {/* Bottom navigation — só aparece fora do mapa */}
      {!isMapaRoute && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white/98 backdrop-blur-md"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", boxShadow: "0 -1px 0 0 #e4e7ec, 0 -4px 16px 0 rgb(15 23 42 / 0.05)" }}
        >
          <div className="mx-auto flex max-w-lg items-center justify-around px-2">
            {NAV_LINKS.map(({ href, label, icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex flex-col items-center gap-1 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    active ? "text-[#e02020]" : "text-slate-400"
                  }`}
                >
                  {active && (
                    <span
                      className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b-full"
                      style={{ background: "linear-gradient(90deg, #e02020, #b51313)" }}
                    />
                  )}
                  {icon(active)}
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapaRoute = pathname.startsWith("/mobile/mapa");

  return (
    <AuthGuard allowedRoles={["user", "admin"]}>
      <div
        className="flex flex-col bg-[#f6f7fb]"
        style={{ height: "100dvh", maxHeight: "100dvh", overflow: "hidden" }}
      >
        <MobileNav isMapaRoute={isMapaRoute} />
        <main
          className={
            isMapaRoute
              ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden"
              : "mx-auto w-full max-w-2xl overflow-y-auto px-3 py-4 pb-24"
          }
          style={isMapaRoute ? { flex: "1 1 0", minHeight: 0 } : { flex: "1 1 auto" }}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
