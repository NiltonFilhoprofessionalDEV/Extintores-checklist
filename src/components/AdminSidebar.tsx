"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentSession, getProfileBySession, type UserRole } from "@/lib/auth/profile";
import { isAdminLikeRole, ROLE_LABELS } from "@/lib/auth/roles";
import { signOutCurrentUser } from "@/lib/auth/session-client";
import AdminNavIcon from "./admin/AdminNavIcon";
import { getNavInitials, getVisibleNavGroups } from "./admin/admin-nav";
import BaseSwitcher from "./BaseSwitcher";
import BrandLogo from "./BrandLogo";

type AdminSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

export default function AdminSidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [actorRole, setActorRole] = useState<UserRole>("admin");
  const [actorName, setActorName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const menuRef = useRef<HTMLDivElement>(null);

  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => setDesktop(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

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

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const groups = useMemo(() => getVisibleNavGroups(actorRole), [actorRole]);
  const canOpenSettings = isAdminLikeRole(actorRole);
  const iconOnly = collapsed && desktop;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleSignOut() {
    await signOutCurrentUser();
    router.replace("/login");
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="admin-sidebar-backdrop lg:hidden"
          aria-label="Fechar menu"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={`admin-sidebar${iconOnly ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
        aria-label="Barra lateral"
      >
        <div className="admin-sidebar__inner">
          <div className="admin-sidebar__brand">
            <BrandLogo height={iconOnly ? 28 : 36} className="admin-sidebar__logo" />
            <button
              type="button"
              className="admin-sidebar__collapse"
              onClick={onToggleCollapsed}
              aria-label={iconOnly ? "Expandir menu" : "Recolher menu"}
              title={iconOnly ? "Expandir" : "Recolher"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                {collapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                )}
              </svg>
            </button>
          </div>

          <div className="admin-sidebar__base" title={iconOnly ? "Base ativa" : undefined}>
            <BaseSwitcher compact={iconOnly} tone="dark" />
          </div>

          <nav className="admin-sidebar__nav" aria-label="Navegação principal">
            {groups.map((group) => (
              <div key={group.id} className="admin-sidebar__group">
                <p className="admin-sidebar__section-label">{group.label}</p>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={iconOnly ? item.label : undefined}
                      onClick={onCloseMobile}
                      className={`admin-sidebar__link${active ? " is-active" : ""}`}
                    >
                      <span className="admin-sidebar__link-icon">
                        <AdminNavIcon name={item.icon} size={18} />
                      </span>
                      <span className="admin-sidebar__link-text">{item.label}</span>
                      {active ? <span className="admin-sidebar__dot" aria-hidden /> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="admin-sidebar__footer" ref={menuRef}>
            <button
              type="button"
              className="admin-sidebar__profile"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              title={iconOnly ? actorName || "Conta" : undefined}
            >
              <span className="admin-sidebar__avatar">{getNavInitials(actorName || "U")}</span>
              <span className="admin-sidebar__profile-copy">
                <span className="admin-sidebar__profile-name">{actorName || "Usuário"}</span>
                <span className="admin-sidebar__profile-role">{ROLE_LABELS[actorRole]}</span>
              </span>
            </button>

            {menuOpen ? (
              <div className="admin-sidebar__menu" role="menu">
                <Link href="/admin/conta" role="menuitem" onClick={onCloseMobile}>
                  Minha conta
                </Link>
                {canOpenSettings ? (
                  <Link href="/admin/configuracoes" role="menuitem" onClick={onCloseMobile}>
                    Configurações
                  </Link>
                ) : null}
                <button type="button" role="menuitem" onClick={handleSignOut}>
                  Sair
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
