"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentSession, getProfileBySession, type UserRole } from "@/lib/auth/profile";
import { signOutCurrentUser } from "@/lib/auth/session-client";
import AdminNavIcon from "./admin/AdminNavIcon";
import {
  getNavInitials,
  getVisibleNavItems,
  PRIMARY_NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
} from "./admin/admin-nav";
import BaseSwitcher from "./BaseSwitcher";
import BrandLogo from "./BrandLogo";

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
    () => getVisibleNavItems(PRIMARY_NAV_ITEMS, actorRole),
    [actorRole],
  );
  const secondaryItems = useMemo(
    () => getVisibleNavItems(SECONDARY_NAV_ITEMS, actorRole),
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
    <div className="admin-dock-shell">
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
              <AdminNavIcon name={item.icon} size={item.icon === "map" ? 26 : 20} />
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
          <AdminNavIcon name="menu" />
          <span>Menu</span>
        </button>
      </nav>

      {menuOpen ? (
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
                  {getNavInitials(actorName)}
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
                        <AdminNavIcon name={item.icon} />
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
                <AdminNavIcon name="logout" />
                Sair da conta
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
