"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isMobileNavActive, MOBILE_NAV_ITEMS } from "./mobile-nav-config";

export default function MobileNavRail() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="mobile-nav-rail" aria-label="Navegação principal">
      {MOBILE_NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isMobileNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`mobile-nav-rail__item pressable ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {icon(active)}
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
