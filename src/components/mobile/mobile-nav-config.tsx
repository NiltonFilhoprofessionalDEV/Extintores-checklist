import type { ReactNode } from "react";

export type MobileNavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => ReactNode;
};

function NavGlyph({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    href: "/mobile/conferencia",
    label: "Inspeções",
    icon: () => (
      <NavGlyph>
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        <path d="M9 12l2 2 4-4" />
      </NavGlyph>
    ),
  },
  {
    href: "/mobile/mapa",
    label: "Mapa",
    icon: () => (
      <NavGlyph>
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
      </NavGlyph>
    ),
  },
  {
    href: "/mobile/perfil",
    label: "Perfil",
    icon: () => (
      <NavGlyph>
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </NavGlyph>
    ),
  },
];

export function isMobileNavActive(pathname: string, href: string): boolean {
  return pathname.startsWith(href);
}
