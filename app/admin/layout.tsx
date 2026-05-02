"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "@/src/components/AuthGuard";
import AdminSidebar from "@/src/components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapeamento = pathname?.includes("/mapeamento");

  return (
    <AuthGuard allowedRoles={["admin"]}>
      <div
        className="bg-[#f6f7fb]"
        style={isMapeamento ? { height: "100dvh", display: "flex", flexDirection: "column" } : { minHeight: "100vh" }}
      >
        <AdminSidebar />
        <div
          className={isMapeamento ? "flex-1 min-h-0 lg:pl-60" : "lg:pl-60"}
          style={isMapeamento ? { display: "flex", flexDirection: "column" } : undefined}
        >
          {isMapeamento ? (
            /* Mapeamento precisa de altura total para o mapa Leaflet funcionar */
            <div className="flex min-h-0 flex-1 flex-col" style={{ flex: "1 1 0" }}>
              {children}
            </div>
          ) : (
            <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
