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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={34} />
          <div>
            <p className="text-xs font-bold leading-none text-slate-900">Extintor Conferência</p>
            <p className="text-[10px] font-medium text-slate-500">{title}</p>
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
                  background: active ? "#fef2f2" : "transparent",
                  color: active ? "#B42318" : "#475467",
                  border: active ? "1px solid #fecdca" : "1px solid transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Sair
          </button>
        </nav>
      </div>
    </header>
  );
}
