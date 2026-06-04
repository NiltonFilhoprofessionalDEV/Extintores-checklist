"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getProfileBySession, type Profile, type UserRole } from "@/lib/auth/profile";
import { getHomePathForRole } from "@/lib/auth/roles";
import { getSupabaseClient } from "@/lib/supabase/client";
import { waitForAuthReady } from "@/lib/auth/session-client";

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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const applySession = async (session: Session | null) => {
      if (!mounted) return;

      if (!session) {
        router.replace(redirectTo);
        setLoading(false);
        return;
      }

      try {
        const fetchedProfile = await getProfileBySession(session);
        if (!fetchedProfile) {
          setLoadError("Não foi possível carregar seu perfil. Tente novamente.");
          setLoading(false);
          return;
        }

        if (!fetchedProfile.active) {
          router.replace(redirectTo);
          return;
        }

        if (!allowedRoles.includes(fetchedProfile.role)) {
          router.replace(getHomePathForRole(fetchedProfile.role));
          return;
        }

        setProfile(fetchedProfile);
        setLoadError(null);
      } catch {
        setLoadError("Erro de conexão ao validar seu acesso. Tente novamente.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const bootstrap = async () => {
      await waitForAuthReady();
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      await applySession(data.session);
    };

    void bootstrap();

    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
        return;
      }
      if (event === "SIGNED_IN" && session) {
        setLoading(true);
        void applySession(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f7fb] px-6 text-center">
        <p className="text-sm font-medium text-slate-600">{loadError}</p>
        <button
          type="button"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </main>
    );
  }

  if (!profile) return null;

  return <>{children}</>;
}
