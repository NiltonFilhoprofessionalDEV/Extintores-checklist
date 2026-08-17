"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ActiveBaseProvider } from "@/lib/auth/active-base-context";
import { readSidebarCollapsed, storeSidebarCollapsed } from "@/lib/admin/sidebar-collapsed";
import AuthGuard from "@/src/components/AuthGuard";
import AdminAreaGuard from "@/src/components/AdminAreaGuard";
import AdminSidebar from "@/src/components/AdminSidebar";
import BrandLogo from "@/src/components/BrandLogo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapFullBleed =
    pathname?.includes("/mapeamento") || pathname?.includes("/posicionamento");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  useEffect(() => {
    const stored = readSidebarCollapsed();
    const frame = window.requestAnimationFrame(() => setCollapsed(stored));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      storeSidebarCollapsed(next);
      return next;
    });
  }

  return (
    <AuthGuard allowedRoles={["admin", "admin_corporativo", "leadership", "cliente", "corporativo"]}>
      <ActiveBaseProvider>
        <AdminAreaGuard>
          <div
            className={`app-shell-bg admin-shell${collapsed ? " is-sidebar-collapsed" : ""}${
              isMapFullBleed ? " admin-shell--map" : ""
            }`}
          >
            <header className="admin-mobile-bar lg:hidden">
              <button
                type="button"
                className="admin-mobile-bar__menu"
                aria-label="Abrir menu"
                onClick={() => setMobileOpen(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <BrandLogo height={28} />
            </header>

            <AdminSidebar
              collapsed={collapsed}
              mobileOpen={mobileOpen}
              onToggleCollapsed={toggleCollapsed}
              onCloseMobile={() => setMobileOpen(false)}
            />

            <div className={`admin-shell__content ${isMapFullBleed ? "admin-shell__content--map" : ""}`}>
              {isMapFullBleed ? (
                <div className="admin-shell__map">{children}</div>
              ) : (
                <main className="admin-shell__main">{children}</main>
              )}
            </div>
          </div>
        </AdminAreaGuard>
      </ActiveBaseProvider>
    </AuthGuard>
  );
}
