"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";
import { getHomePathForRole } from "@/lib/auth/roles";
import { waitForAuthReady } from "@/lib/auth/session-client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
      await waitForAuthReady();
      const session = await getCurrentSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      try {
        const profile = await getProfileBySession(session);
        if (!profile?.active) {
          router.replace("/login");
          return;
        }

        router.replace(getHomePathForRole(profile.role));
      } catch {
        router.replace("/login");
      }
    };

    void bootstrap();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-zinc-600">
      Redirecionando...
    </main>
  );
}
