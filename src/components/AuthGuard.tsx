"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentSession, getProfileBySession, type Profile, type UserRole } from "@/lib/auth/profile";
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
          router.replace(fetchedProfile?.role === "admin" ? "/admin/dashboard" : "/mobile/conferencia");
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
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [allowedRoles, redirectTo, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-zinc-600">
        Verificando acesso...
      </main>
    );
  }

  if (!profile) return null;

  return <>{children}</>;
}
