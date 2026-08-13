"use client";

import { usePathname } from "next/navigation";
import { ActiveBaseProvider } from "@/lib/auth/active-base-context";
import AuthGuard from "@/src/components/AuthGuard";
import AdminAreaGuard from "@/src/components/AdminAreaGuard";
import AdminDock from "@/src/components/AdminDock";
import AdminSidebar from "@/src/components/AdminSidebar";
import FlaticonCredits from "@/src/components/FlaticonCredits";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapFullBleed =
    pathname?.includes("/mapeamento") || pathname?.includes("/posicionamento");

  return (
    <AuthGuard allowedRoles={["admin", "admin_corporativo", "leadership", "cliente", "corporativo"]}>
      <ActiveBaseProvider>
        <AdminAreaGuard>
          <div
            className={`app-shell-bg ${isMapFullBleed ? "admin-shell admin-shell--map" : "admin-shell"}`}
          >
            <AdminSidebar />
            <AdminDock />
            <div
              className={`admin-shell__content ${isMapFullBleed ? "admin-shell__content--map" : ""}`}
            >
              {isMapFullBleed ? (
                <div className="admin-shell__map">{children}</div>
              ) : (
                <main className="admin-shell__main">
                  {children}
                  <FlaticonCredits className="mt-8 px-1 pb-2" />
                </main>
              )}
            </div>
          </div>
        </AdminAreaGuard>
      </ActiveBaseProvider>
    </AuthGuard>
  );
}
