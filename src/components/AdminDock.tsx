"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentSession, getProfileBySession, type UserRole } from "@/lib/auth/profile";
import {
  CLIENT_ALLOWED_ADMIN_PATHS,
  isAdminLikeRole,
  isLeadershipBlockedAdminPath,
  isReadOnlyCorporateRole,
} from "@/lib/auth/roles";
import { signOutCurrentUser } from "@/lib/auth/session-client";
import BaseSwitcher from "./BaseSwitcher";
import BrandLogo from "./BrandLogo";
import { EquipmentPairIcon } from "./EquipmentIcons";

type IconName =
  | "dashboard"
  | "inventory"
  | "map"
  | "checks"
  | "users"
  | "bases"
  | "import"
  | "settings"
  | "menu"
  | "logout";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  adminCorporativoOnly?: boolean;
  adminLikeOnly?: boolean;
};

const PRIMARY_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", label: "Início", icon: "dashboard" },
  { href: "/admin/extintores", label: "Inventário", icon: "inventory" },
  { href: "/admin/mapeamento", label: "Mapa", icon: "map" },
  { href: "/admin/inspecoes-lista", label: "Checklist", icon: "checks" },
];

const SECONDARY_ITEMS: NavItem[] = [
  { href: "/admin/conferencias", label: "Conferências", icon: "checks" },
  { href: "/admin/usuarios", label: "Usuários", icon: "users" },
  { href: "/admin/bases", label: "Bases", icon: "bases", adminCorporativoOnly: true },
  { href: "/admin/importacao", label: "Importar dados", icon: "import" },
  {
    href: "/admin/configuracoes",
    label: "Configurações da base",
    icon: "settings",
    adminLikeOnly: true,
  },
];

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "dashboard") {
    return <svg {...common}><path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z" /></svg>;
  }
  if (name === "inventory") {
    return <EquipmentPairIcon size={size + 4} />;
  }
  if (name === "map") {
    return <svg {...common}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" /></svg>;
  }
  if (name === "checks") {
    return <svg {...common}><path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3M9 5a3 3 0 0 1 6 0M9 5h6m-7 8 2.5 2.5L16 10" /></svg>;
  }
  if (name === "users") {
    return <svg {...common}><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75" /></svg>;
  }
  if (name === "bases") {
    return <svg {...common}><path d="M4 21V4h12v17M8 8h4m-4 4h4m-4 4h4m4-8h4v13M2 21h20" /></svg>;
  }
  if (name === "import") {
    return <svg {...common}><path d="M12 3v12m0-12L7 8m5-5 5 5M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /></svg>;
  }
  if (name === "settings") {
    return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08a1.7 1.7 0 0 0-1.52 1Z" /></svg>;
  }
  if (name === "logout") {
    return <svg {...common}><path d="M10 17l5-5-5-5m5 5H3m12-8h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></svg>;
  }
  return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
}

function canShow(item: NavItem, role: UserRole): boolean {
  if (item.adminCorporativoOnly && role !== "admin_corporativo") return false;
  if (item.adminLikeOnly && !isAdminLikeRole(role)) return false;
  if (isReadOnlyCorporateRole(role)) {
    return CLIENT_ALLOWED_ADMIN_PATHS.some(
      (allowed) => item.href === allowed || item.href.startsWith(`${allowed}/`),
    );
  }
  return role !== "leadership" || !isLeadershipBlockedAdminPath(item.href);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.slice(0, 2).toUpperCase() || "?";
  return `${parts[0][0]}${parts.at(-1)?.[0]}`.toUpperCase();
}

export default function AdminDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [actorRole, setActorRole] = useState<UserRole>("admin");
  const [actorName, setActorName] = useState("");

  useEffect(() => {
    void (async () => {
      const session = await getCurrentSession();
      if (!session) return;
      const profile = await getProfileBySession(session);
      if (!profile) return;
      setActorRole(profile.role);
      setActorName(profile.nome);
    })();
  }, []);

  const primaryItems = useMemo(
    () => PRIMARY_ITEMS.filter((item) => canShow(item, actorRole)),
    [actorRole],
  );
  const secondaryItems = useMemo(
    () => SECONDARY_ITEMS.filter((item) => canShow(item, actorRole)),
    [actorRole],
  );
  const secondaryActive = secondaryItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  async function handleSignOut() {
    await signOutCurrentUser();
    router.replace("/login");
  }

  return (
    <>
      <nav className="admin-dock" aria-label="Navegação principal">
        {primaryItems.map((item) => {
          const active =
            !menuOpen && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`admin-dock__item ${item.icon === "map" ? "is-map" : ""} ${active ? "is-active" : ""}`}
              aria-label={item.label}
            >
              <Icon name={item.icon} size={item.icon === "map" ? 26 : 20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`admin-dock__item ${menuOpen || secondaryActive ? "is-active" : ""}`}
          onClick={() => setMenuOpen((current) => !current)}
          aria-expanded={menuOpen}
          aria-controls="admin-menu-drawer"
        >
          <Icon name="menu" />
          <span>Menu</span>
        </button>
      </nav>

      {menuOpen && (
        <div className="admin-menu-layer fixed inset-x-0 top-0" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          />
          <aside
            id="admin-menu-drawer"
            className="absolute inset-y-0 right-0 flex w-[min(90vw,390px)] flex-col rounded-l-[1.75rem] bg-white shadow-2xl"
            aria-label="Menu completo"
          >
            <div className="border-b border-[var(--border)] px-6 pb-5 pt-6">
              <div className="flex items-center justify-between gap-4">
                <BrandLogo height={34} />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[var(--muted)] text-[var(--ink)]"
                  aria-label="Fechar menu"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--orange-soft)] text-sm font-extrabold text-[var(--orange-deep)]">
                  {initials(actorName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-[var(--ink)]">{actorName || "Usuário"}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Conta ativa</p>
                </div>
              </div>
              <div className="mt-4"><BaseSwitcher tone="light" /></div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              <p className="px-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Mais opções
              </p>
              <div className="mt-2 space-y-1">
                {secondaryItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                        active
                          ? "bg-[var(--orange-soft)] text-[var(--orange-deep)]"
                          : "text-[var(--ink)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-[var(--border)]">
                        <Icon name={item.icon} />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[var(--border)] p-4">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
              >
                <Icon name="logout" />
                Sair da conta
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
