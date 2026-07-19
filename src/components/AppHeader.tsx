"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutCurrentUser } from "@/lib/auth/session-client";
import BrandLogo from "@/src/components/BrandLogo";

type AppHeaderProps = {
  title: string;
  links: Array<{ href: string; label: string }>;
};

export default function AppHeader({ title, links }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await signOutCurrentUser();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <BrandLogo height={36} />
          <p className="text-[10px] font-medium text-[var(--muted-foreground)]">{title}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: active ? "var(--neon)" : "transparent",
                  color: active ? "var(--neon-ink)" : "#4b5c54",
                  border: active ? "1px solid transparent" : "1px solid transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--muted)]"
          >
            Sair
          </button>
        </nav>
      </div>
    </header>
  );
}
