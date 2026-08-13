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
  | "logout";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminIconName;
  adminCorporativoOnly?: boolean;
  adminLikeOnly?: boolean;
};

export const PRIMARY_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Início", icon: "dashboard" },
  { href: "/admin/extintores", label: "Inventário", icon: "inventory" },
  { href: "/admin/mapeamento", label: "Mapa", icon: "map" },
  { href: "/admin/inspecoes-lista", label: "Checklist", icon: "checks" },
];

export const SECONDARY_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/conferencias", label: "Conferências", icon: "checks" },
  { href: "/admin/usuarios", label: "Usuários", icon: "users" },
  { href: "/admin/bases", label: "Bases", icon: "bases", adminCorporativoOnly: true },
  { href: "/admin/importacao", label: "Importar dados", icon: "import" },
  {
    href: "/admin/auditoria",
    label: "Auditoria",
    icon: "audit",
    adminCorporativoOnly: true,
  },
  {
    href: "/admin/posicionamento",
    label: "Posicionar equipamentos",
    icon: "map",
    adminLikeOnly: true,
  },
  {
    href: "/admin/configuracoes",
    label: "Configurações da base",
    icon: "settings",
    adminLikeOnly: true,
  },
];

export const ALL_NAV_ITEMS: AdminNavItem[] = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

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

export function getNavInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.slice(0, 2).toUpperCase() || "?";
  return `${parts[0][0]}${parts.at(-1)?.[0]}`.toUpperCase();
}
