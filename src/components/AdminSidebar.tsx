"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentSession, getProfileBySession, type UserRole } from "@/lib/auth/profile";
import { CLIENT_ALLOWED_ADMIN_PATHS, isLeadershipBlockedAdminPath, isReadOnlyCorporateRole } from "@/lib/auth/roles";
import { signOutCurrentUser } from "@/lib/auth/session-client";
import BrandLogo from "./BrandLogo";
import BaseSwitcher from "./BaseSwitcher";

const NAV_ITEMS = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/admin/extintores",
    label: "Extintores e Hidrantes",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <rect x="9" y="5" width="6" height="14" rx="3" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h4l1 2.5h-5M8 4h8M12 3v2" />
      </svg>
    ),
  },
  {
    href: "/admin/usuarios",
    label: "Usuários",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/importacao",
    label: "Importação",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    href: "/admin/inspecoes-lista",
    label: "Inspeções (lista)",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/admin/mapeamento",
    label: "Mapeamento",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: "/admin/conferencias",
    label: "Conferências",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function SettingsGearIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

const SIDEBAR_ITEM_ACTIVE =
  "border-[#e02020]/60 bg-[#e02020]/15 text-white shadow-sm shadow-red-950/30";
const SIDEBAR_ITEM_IDLE =
  "border-transparent bg-white/5 text-slate-400 hover:border-white/15 hover:bg-white/10 hover:text-white";

function LogoutIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function SidebarContent({
  onClose,
  actorRole,
  actorNome,
}: {
  onClose?: () => void;
  actorRole: UserRole;
  actorNome: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems =
    isReadOnlyCorporateRole(actorRole)
      ? NAV_ITEMS.filter((item) =>
          CLIENT_ALLOWED_ADMIN_PATHS.some(
            (allowed) => item.href === allowed || item.href.startsWith(`${allowed}/`),
          ),
        )
      : actorRole === "leadership"
        ? NAV_ITEMS.filter((item) => !isLeadershipBlockedAdminPath(item.href))
        : NAV_ITEMS;

  async function handleSignOut() {
    await signOutCurrentUser();
    router.replace("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const configActive = isActive("/admin/configuracoes");

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-24 left-0 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />
      {/* Brand */}
      <div className="relative px-5 py-5">
        <div className="flex w-full px-3 py-2">
          <BrandLogo height={48} fluid className="drop-shadow-lg" />
        </div>
      </div>

      <div className="mx-5 border-t border-white/10" />

      <div className="relative mt-4 px-3">
        <BaseSwitcher />
      </div>

      {/* Label */}
      <p className="relative mt-5 px-5 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
        Menu
      </p>

      {/* Nav items */}
      <nav className="relative mt-2 flex-1 space-y-1 px-3 pb-4">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-bold transition-all duration-150 ${
                active ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE
              }`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                  active
                    ? "bg-[#e02020]/25 text-white"
                    : "bg-white/5 text-slate-500 group-hover:text-slate-300"
                }`}
              >
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

      {/* Footer — conta + ações */}
      <div className="relative border-t border-white/10 p-3">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02]">
          <div className="flex items-center gap-3 px-3.5 py-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e02020]/90 to-[#8b1010] text-sm font-black tracking-tight text-white shadow-inner shadow-black/20 ring-1 ring-white/20"
              aria-hidden
            >
              {getInitials(actorNome || "U")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight text-white">
                {actorNome || "Usuário"}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Minha conta</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-white/10 bg-black/20 p-2">
            {!isReadOnlyCorporateRole(actorRole) && (
              <Link
                href="/admin/configuracoes"
                onClick={onClose}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 transition-all ${
                  configActive ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE
                }`}
              >
                <SettingsGearIcon size={17} />
                <span className="text-[10px] font-bold leading-none">Configurações</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-transparent bg-white/5 px-2 py-2.5 text-slate-400 transition-all hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-200 ${
                isReadOnlyCorporateRole(actorRole) ? "col-span-2" : ""
              }`}
            >
              <LogoutIcon size={17} />
              <span className="text-[10px] font-bold leading-none">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [actorRole, setActorRole] = useState<UserRole>("admin");
  const [actorNome, setActorNome] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const session = await getCurrentSession();
      if (!session) return;
      const profile = await getProfileBySession(session);
      if (profile) {
        setActorRole(profile.role);
        setActorNome(profile.nome);
      }
    };
    void loadProfile();
  }, []);

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between bg-slate-950 px-4 py-3 shadow-lg shadow-slate-950/20 lg:hidden"
      >
        <div className="px-2.5 py-1.5">
          <BrandLogo height={26} className="drop-shadow-md" />
        </div>
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-white/20 hover:text-white"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[3000] flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 shrink-0 shadow-2xl">
            <SidebarContent
              onClose={() => setMobileOpen(false)}
              actorRole={actorRole}
              actorNome={actorNome}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:flex lg:flex-col">
        <SidebarContent actorRole={actorRole} actorNome={actorNome} />
      </aside>
    </>
  );
}
