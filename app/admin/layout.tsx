"use client";

import { usePathname } from "next/navigation";
import { ActiveBaseProvider } from "@/lib/auth/active-base-context";
import AuthGuard from "@/src/components/AuthGuard";
import AdminAreaGuard from "@/src/components/AdminAreaGuard";
import AdminDock from "@/src/components/AdminDock";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapeamento = pathname?.includes("/mapeamento");

  return (
    <AuthGuard allowedRoles={["admin", "admin_corporativo", "leadership", "cliente", "corporativo"]}>
      <ActiveBaseProvider>
        <AdminAreaGuard>
          <div
            className="app-shell-bg"
            style={
              isMapeamento
                ? { height: "100dvh", display: "flex", flexDirection: "column" }
                : { minHeight: "100vh" }
            }
          >
            <AdminDock />
            <div
              className={isMapeamento ? "min-h-0 flex-1 pb-24" : "pb-28"}
              style={isMapeamento ? { display: "flex", flexDirection: "column" } : undefined}
            >
              {isMapeamento ? (
                <div className="flex min-h-0 flex-1 flex-col" style={{ flex: "1 1 0" }}>
                  {children}
                </div>
              ) : (
                <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
                  {children}
                </main>
              )}
            </div>
          </div>
        </AdminAreaGuard>
      </ActiveBaseProvider>
    </AuthGuard>
  );
}
