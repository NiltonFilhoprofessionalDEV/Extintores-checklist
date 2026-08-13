"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isMobileNavActive, MOBILE_NAV_ITEMS } from "./mobile-nav-config";

type MobileBottomNavProps = {
  collapsed: boolean;
};

export default function MobileBottomNav({ collapsed }: MobileBottomNavProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className={`mobile-bottom-nav lg:hidden ${collapsed ? "is-collapsed" : ""}`}
      aria-label="Navegação principal"
    >
      {MOBILE_NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isMobileNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`mobile-bottom-nav__item pressable ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {icon(active)}
            <span className="mobile-bottom-nav__label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
