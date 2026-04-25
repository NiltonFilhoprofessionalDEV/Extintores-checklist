"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import BrandLogo from "./BrandLogo";

const NAV_ITEMS = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/admin/extintores",
    label: "Extintores",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="9" y="5" width="6" height="14" rx="3" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h4l1 2.5h-5M8 4h8M12 3v2" />
      </svg>
    ),
  },
  {
    href: "/admin/usuarios",
    label: "Usuários",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/importacao",
    label: "Importação",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    href: "/admin/mapeamento",
    label: "Mapeamento",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: "/admin/conferencias",
    label: "Conferências",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/admin/exportacao",
    label: "Exportação",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col" style={{ background: "linear-gradient(180deg, #1a1a1a 0%, #111111 100%)" }}>
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <BrandLogo size={36} />
        <div>
          <p className="text-sm font-bold leading-tight text-white">Extintor</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
            Conferência
          </p>
        </div>
      </div>

      {/* Label */}
      <p className="mt-4 px-5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
        Menu
      </p>

      {/* Nav items */}
      <nav className="mt-1 flex-1 space-y-0.5 px-3 pb-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: active ? "#E02020" : "transparent",
                color: active ? "white" : "rgba(255,255,255,0.65)",
              }}
            >
              <span className={active ? "text-white" : "text-white/50"}>
                {item.icon}
              </span>
              {item.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-4">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sair
        </button>
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden"
        style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
      >
        <div className="flex items-center gap-2">
          <BrandLogo size={28} />
          <p className="text-sm font-bold text-white">Extintor Conferência</p>
        </div>
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-white/30 p-1.5 text-white"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 shrink-0">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:flex lg:flex-col">
        <SidebarContent />
      </aside>
    </>
  );
}
