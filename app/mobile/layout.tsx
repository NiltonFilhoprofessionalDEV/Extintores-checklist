"use client";

import AuthGuard from "@/src/components/AuthGuard";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ActiveBaseProvider } from "@/lib/auth/active-base-context";
import FlaticonCredits from "@/src/components/FlaticonCredits";
import MobileBottomNav from "@/src/components/mobile/MobileBottomNav";
import MobileNavRail from "@/src/components/mobile/MobileNavRail";
import { useMobileNavCollapse } from "@/src/components/mobile/useMobileNavCollapse";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMapaRoute = pathname?.startsWith("/mobile/mapa") ?? false;
  const mainScrollRef = useRef<HTMLElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setScrollElement(mainScrollRef.current);
  }, [isMapaRoute]);

  const navCollapsed = useMobileNavCollapse(isMapaRoute ? null : scrollElement);

  function handleBackFromMap() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/mobile/conferencia");
  }

  return (
    <AuthGuard allowedRoles={["user", "admin", "leadership"]}>
      <ActiveBaseProvider>
        <div className="mobile-shell">
          <MobileNavRail />
          <div className="mobile-shell__content">
            {isMapaRoute ? (
              <header className="flex shrink-0 items-center justify-between border-b border-[var(--fc-border)] bg-[var(--fc-surface)] px-4 py-2.5">
                <button
                  type="button"
                  onClick={handleBackFromMap}
                  className="inline-flex items-center gap-1.5 rounded-[var(--fc-radius-md)] px-2 py-1.5 text-xs font-bold text-[var(--fc-text-primary)] hover:bg-[var(--muted)]"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar
                </button>
                <p className="text-sm font-extrabold text-[var(--fc-text-primary)]">Mapa</p>
                <span className="w-14" aria-hidden />
              </header>
            ) : null}

            <main
              ref={mainScrollRef}
              className={`mobile-shell__main ${isMapaRoute ? "mobile-shell__main--map" : ""}`}
              style={
                isMapaRoute
                  ? { paddingBottom: "var(--mobile-bottom-nav-clearance)" }
                  : {
                      paddingBottom: "var(--mobile-bottom-nav-clearance)",
                      paddingTop: "max(env(safe-area-inset-top, 0px), 0.5rem)",
                    }
              }
            >
              <div
                className={
                  isMapaRoute
                    ? "mobile-map-page flex min-h-0 flex-1 flex-col"
                    : "mx-auto w-full max-w-2xl px-3 py-3 md:max-w-4xl lg:max-w-5xl xl:max-w-6xl lg:px-6 lg:py-5"
                }
              >
                {children}
                {!isMapaRoute ? <FlaticonCredits className="mt-6 pb-2" /> : null}
              </div>
            </main>
          </div>
          <MobileBottomNav collapsed={navCollapsed} />
        </div>
      </ActiveBaseProvider>
    </AuthGuard>
  );
}
