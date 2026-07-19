"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";
import { getHomePathForRole, isClientBlockedAdminPath, isLeadershipBlockedAdminPath } from "@/lib/auth/roles";
import { waitForAuthReady } from "@/lib/auth/session-client";

export default function AdminAreaGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        await waitForAuthReady();
        const session = await getCurrentSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        const profile = await getProfileBySession(session);
        if (!profile?.active) {
          router.replace("/login");
          return;
        }

        if (
          profile.role === "leadership" &&
          pathname &&
          isLeadershipBlockedAdminPath(pathname)
        ) {
          router.replace(getHomePathForRole("leadership"));
          return;
        }

        if (
          (profile.role === "cliente" || profile.role === "corporativo") &&
          pathname &&
          isClientBlockedAdminPath(pathname)
        ) {
          router.replace(getHomePathForRole(profile.role));
          return;
        }

        if (pathname?.startsWith("/admin/bases") && profile.role !== "admin_corporativo") {
          router.replace(getHomePathForRole(profile.role));
          return;
        }
      } finally {
        if (mounted) setReady(true);
      }
    };

    void check();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f6f7fb]">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#e02020]" />
        <p className="text-sm font-medium text-slate-400">Verificando acesso…</p>
      </main>
    );
  }

  return <>{children}</>;
}
