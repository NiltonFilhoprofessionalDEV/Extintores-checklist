"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentSession, getProfileBySession, type UserRole } from "@/lib/auth/profile";
import { isReadOnlyCorporateRole } from "@/lib/auth/roles";
import { signOutCurrentUser } from "@/lib/auth/session-client";
import AdminNavIcon from "./admin/AdminNavIcon";
import {
  ALL_NAV_ITEMS,
  getNavInitials,
  getVisibleNavItems,
} from "./admin/admin-nav";
import BaseSwitcher from "./BaseSwitcher";
import BrandLogo from "./BrandLogo";

function SidebarContent({
  actorRole,
  actorName,
}: {
  actorRole: UserRole;
  actorName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = useMemo(
    () => getVisibleNavItems(ALL_NAV_ITEMS, actorRole),
    [actorRole],
  );

  async function handleSignOut() {
    await signOutCurrentUser();
    router.replace("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const configActive = isActive("/admin/configuracoes");

  return (
    <div className="admin-sidebar__inner">
      <div className="admin-sidebar__glow admin-sidebar__glow--top" />
      <div className="admin-sidebar__glow admin-sidebar__glow--bottom" />

      <div className="admin-sidebar__brand">
        <BrandLogo height={42} fluid className="drop-shadow-lg" />
      </div>

      <div className="admin-sidebar__divider" />

      <div className="admin-sidebar__base">
        <BaseSwitcher />
      </div>

      <p className="admin-sidebar__section-label">Menu</p>

      <nav className="admin-sidebar__nav" aria-label="Navegação principal">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-sidebar__link ${active ? "is-active" : ""}`}
            >
              <span className="admin-sidebar__link-icon">
                <AdminNavIcon name={item.icon} size={18} />
              </span>
              <span className="truncate">{item.label}</span>
              {active ? <span className="admin-sidebar__link-dot" aria-hidden /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar__footer">
        <div className="admin-sidebar__profile">
          <div className="admin-sidebar__avatar" aria-hidden>
            {getNavInitials(actorName || "U")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight text-white">
              {actorName || "Usuário"}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-white/45">Minha conta</p>
          </div>
        </div>

        <div className="admin-sidebar__actions">
          {!isReadOnlyCorporateRole(actorRole) ? (
            <Link
              href="/admin/configuracoes"
              className={`admin-sidebar__action ${configActive ? "is-active" : ""}`}
            >
              <AdminNavIcon name="settings" size={17} />
              <span>Configurações</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={handleSignOut}
            className={`admin-sidebar__action admin-sidebar__action--logout ${
              isReadOnlyCorporateRole(actorRole) ? "is-wide" : ""
            }`}
          >
            <AdminNavIcon name="logout" size={17} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSidebar() {
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

  return (
    <aside className="admin-sidebar" aria-label="Barra lateral">
      <SidebarContent actorRole={actorRole} actorName={actorName} />
    </aside>
  );
}
