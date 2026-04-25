"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
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

      router.replace(profile.role === "admin" ? "/admin/dashboard" : "/mobile/conferencia");
    };

    void bootstrap();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-zinc-600">
      Redirecionando...
    </main>
  );
}
