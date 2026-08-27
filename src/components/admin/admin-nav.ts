import type { UserRole } from "@/lib/auth/profile";
import {
  CLIENT_ALLOWED_ADMIN_PATHS,
  isAdminLikeRole,
  isLeadershipBlockedAdminPath,
  isReadOnlyCorporateRole,
} from "@/lib/auth/roles";

export type AdminIconName =
  | "dashboard"
  | "inventory"
  | "map"
  | "checks"
  | "users"
  | "bases"
  | "import"
  | "settings"
  | "audit"
  | "menu"
  | "logout"
  | "account"
  | "history"
  | "stock";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminIconName;
  adminCorporativoOnly?: boolean;
  adminLikeOnly?: boolean;
};

export type AdminNavGroup = {
  id: "operacao" | "gestao" | "sistema";
  label: string;
  items: AdminNavItem[];
};

export const NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/admin/extintores", label: "Inventário", icon: "inventory" },
      { href: "/admin/estoque", label: "Estoque", icon: "stock" },
      { href: "/admin/mapeamento", label: "Mapa", icon: "map" },
      { href: "/admin/inspecoes-lista", label: "Checklist", icon: "checks" },
      { href: "/admin/conferencias", label: "Conferências", icon: "history" },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    items: [
      { href: "/admin/usuarios", label: "Usuários", icon: "users" },
      { href: "/admin/bases", label: "Bases", icon: "bases", adminCorporativoOnly: true },
      { href: "/admin/importacao", label: "Importar dados", icon: "import" },
      {
        href: "/admin/posicionamento",
        label: "Posicionar equipamentos",
        icon: "map",
        adminLikeOnly: true,
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      {
        href: "/admin/auditoria",
        label: "Auditoria",
        icon: "audit",
        adminCorporativoOnly: true,
      },
      {
        href: "/admin/configuracoes",
        label: "Configurações",
        icon: "settings",
        adminLikeOnly: true,
      },
    ],
  },
];

export const PRIMARY_NAV_ITEMS: AdminNavItem[] = NAV_GROUPS[0].items.slice(0, 4);

export const SECONDARY_NAV_ITEMS: AdminNavItem[] = [
  ...NAV_GROUPS[0].items.slice(4),
  ...NAV_GROUPS[1].items,
  ...NAV_GROUPS[2].items,
];

export const ALL_NAV_ITEMS: AdminNavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function canShowNavItem(item: AdminNavItem, role: UserRole): boolean {
  if (item.adminCorporativoOnly && role !== "admin_corporativo") return false;
  if (item.adminLikeOnly && !isAdminLikeRole(role)) return false;
  if (isReadOnlyCorporateRole(role)) {
    return CLIENT_ALLOWED_ADMIN_PATHS.some(
      (allowed) => item.href === allowed || item.href.startsWith(`${allowed}/`),
    );
  }
  return role !== "leadership" || !isLeadershipBlockedAdminPath(item.href);
}

export function getVisibleNavItems(items: AdminNavItem[], role: UserRole): AdminNavItem[] {
  return items.filter((item) => canShowNavItem(item, role));
}

export function getVisibleNavGroups(role: UserRole): AdminNavGroup[] {
  return NAV_GROUPS
    .map((group) => ({ ...group, items: getVisibleNavItems(group.items, role) }))
    .filter((group) => group.items.length > 0);
}

export function getNavInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.slice(0, 2).toUpperCase() || "?";
  return `${parts[0][0]}${parts.at(-1)?.[0]}`.toUpperCase();
}
