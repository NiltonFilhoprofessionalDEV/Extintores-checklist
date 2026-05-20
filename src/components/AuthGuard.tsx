"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentSession, getProfileBySession, type Profile, type UserRole } from "@/lib/auth/profile";
import { getHomePathForRole } from "@/lib/auth/roles";
import { getSupabaseClient } from "@/lib/supabase/client";

type AuthGuardProps = {
  allowedRoles: UserRole[];
  redirectTo?: string;
  children: React.ReactNode;
};

export default function AuthGuard({
  allowedRoles,
  redirectTo = "/login",
  children,
}: AuthGuardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        const session = await getCurrentSession();
        if (!session) {
          router.replace(redirectTo);
          return;
        }

        const fetchedProfile = await getProfileBySession(session);
        if (!fetchedProfile || !fetchedProfile.active || !allowedRoles.includes(fetchedProfile.role)) {
          router.replace(getHomePathForRole(fetchedProfile?.role ?? "user"));
          return;
        }

        if (mounted) setProfile(fetchedProfile);
      } catch {
        router.replace(redirectTo);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void checkAccess();

    const supabase = getSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Redireciona APENAS em logout explícito — não durante refresh de token
      // (TOKEN_REFRESHED e INITIAL_SESSION podem ter session=null brevemente)
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
      // Quando o token é renovado e o usuário estava em uma rota protegida,
      // não é necessário redirecionar — a sessão continua válida
      if (event === "SIGNED_IN" && session) {
        void checkAccess();
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [allowedRoles, redirectTo, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f6f7fb]">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#e02020]" />
        <p className="text-sm font-medium text-slate-400">Verificando acesso…</p>
      </main>
    );
  }

  if (!profile) return null;

  return <>{children}</>;
}
