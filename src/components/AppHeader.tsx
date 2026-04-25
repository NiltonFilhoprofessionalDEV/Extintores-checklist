"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import BrandLogo from "@/src/components/BrandLogo";

type AppHeaderProps = {
  title: string;
  links: Array<{ href: string; label: string }>;
};

export default function AppHeader({ title, links }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header
      className="sticky top-0 z-40 shadow-md"
      style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={34} />
          <div>
            <p className="text-xs font-bold leading-none text-white">Extintor Conferência</p>
            <p className="text-[10px] font-medium text-white/70">{title}</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
                  color: "white",
                  border: active ? "1px solid rgba(255,255,255,0.4)" : "1px solid transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
          >
            Sair
          </button>
        </nav>
      </div>
    </header>
  );
}
