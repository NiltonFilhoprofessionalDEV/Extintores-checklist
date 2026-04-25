"use client";

import AuthGuard from "@/src/components/AuthGuard";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import BrandLogo from "@/src/components/BrandLogo";

function MobileNav() {
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
      {/* Top header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 shadow-sm"
        style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
      >
        <div className="flex items-center gap-2">
          <BrandLogo size={32} />
          <div>
            <p className="text-xs font-bold leading-none text-white">Extintor</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Conferência</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Sair
        </button>
      </header>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white pb-safe">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1">
          <Link href="/mobile/conferencia" className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isActive("/mobile/conferencia") ? "text-[#E02020]" : "text-gray-400"}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Inspeções
          </Link>

          <Link href="/mobile/mapa" className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isActive("/mobile/mapa") ? "text-[#E02020]" : "text-gray-400"}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
            </svg>
            Mapa
          </Link>

          <Link href="/mobile/perfil" className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isActive("/mobile/perfil") ? "text-[#E02020]" : "text-gray-400"}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Perfil
          </Link>
        </div>
      </nav>
    </>
  );
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapaRoute = pathname.startsWith("/mobile/mapa");

  return (
    <AuthGuard allowedRoles={["user", "admin"]}>
      <div className="flex min-h-screen flex-col bg-[#F5F5F5]">
        <MobileNav />
        <main
          className={
            isMapaRoute
              ? "w-full flex-1 min-h-0 pb-24"
              : "mx-auto w-full max-w-2xl flex-1 px-3 py-4 pb-24"
          }
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
