export type UserRole =
  | "admin"
  | "admin_corporativo"
  | "leadership"
  | "user"
  | "cliente"
  | "corporativo";
export type UserTeam = "ALFA" | "BRAVO" | "CHARLIE" | "DELTA";

export const USER_TEAMS: UserTeam[] = ["ALFA", "BRAVO", "CHARLIE", "DELTA"];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  admin_corporativo: "Administrador Corporativo",
  leadership: "Liderança",
  user: "Bombeiro",
  cliente: "Cliente",
  corporativo: "Corporativo",
};

export const TEAM_LABELS: Record<UserTeam, string> = {
  ALFA: "ALFA",
  BRAVO: "BRAVO",
  CHARLIE: "CHARLIE",
  DELTA: "DELTA",
};

export const MANAGER_ROLES: UserRole[] = ["admin", "admin_corporativo", "leadership"];

/** Roles multi-base: acesso via base_memberships (profiles.base_id pode ser null). */
export function isMultiBaseRole(role: UserRole): boolean {
  return role === "corporativo" || role === "admin_corporativo";
}

export function isAdminLikeRole(role: UserRole): boolean {
  return role === "admin" || role === "admin_corporativo";
}

export function isUserManager(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

export function isReadOnlyCorporateRole(role: UserRole): boolean {
  return role === "cliente" || role === "corporativo";
}

/** Quem pode acessar a gestão de usuários (criar/editar/excluir conforme regras abaixo). */
export function canManageTarget(
  actorRole: UserRole,
  targetRole: UserRole,
  actorTeam?: UserTeam | null,
  targetTeam?: UserTeam | null,
): boolean {
  if (actorRole === "admin_corporativo") return true;
  if (actorRole === "admin") {
    // Admin de base: só staff da base — nunca perfis corporativos
    return (
      targetRole === "admin" ||
      targetRole === "leadership" ||
      targetRole === "user" ||
      targetRole === "cliente"
    );
  }
  if (actorRole === "leadership") {
    return targetRole === "user" && Boolean(actorTeam) && actorTeam === targetTeam;
  }
  return false;
}

/** Papel que o ator pode atribuir ao criar ou editar. */
export function canAssignRole(actorRole: UserRole, newRole: UserRole): boolean {
  if (actorRole === "admin_corporativo") {
    // Só o corporativo cria admin_corporativo + staff de base
    return (
      newRole === "admin_corporativo" ||
      newRole === "admin" ||
      newRole === "leadership" ||
      newRole === "user" ||
      newRole === "cliente"
    );
  }
  if (actorRole === "admin") {
    // Base: nunca corporativo / admin_corporativo
    return newRole === "admin" || newRole === "leadership" || newRole === "user" || newRole === "cliente";
  }
  if (actorRole === "leadership") return newRole === "user";
  return false;
}

export function assignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === "admin_corporativo") {
    return ["admin_corporativo", "admin", "leadership", "user", "cliente"];
  }
  if (actorRole === "admin") return ["admin", "leadership", "user", "cliente"];
  if (actorRole === "leadership") return ["user"];
  return [];
}

export function isTeamRequiredForRole(role: UserRole): boolean {
  return role === "leadership" || role === "user";
}

export function isBaseRequiredForRole(role: UserRole): boolean {
  return !isMultiBaseRole(role);
}

export function isValidUserTeam(value: unknown): value is UserTeam {
  return typeof value === "string" && USER_TEAMS.includes(value as UserTeam);
}

export function normalizeUserTeam(value: unknown): UserTeam | null {
  return isValidUserTeam(value) ? value : null;
}

/** Rotas do painel admin permitidas ao perfil cliente/corporativo (somente consulta). */
export const CLIENT_ALLOWED_ADMIN_PATHS = [
  "/admin/dashboard",
  "/admin/extintores",
  "/admin/mapeamento",
  "/admin/conta",
] as const;

export function isClientAllowedAdminPath(pathname: string): boolean {
  return CLIENT_ALLOWED_ADMIN_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  );
}

export function isClientBlockedAdminPath(pathname: string): boolean {
  return !isClientAllowedAdminPath(pathname);
}

export function canUseMapEditing(role: UserRole): boolean {
  return role === "admin" || role === "admin_corporativo";
}

export function canUseMapInspection(role: UserRole): boolean {
  return role === "admin" || role === "admin_corporativo" || role === "leadership" || role === "user";
}

/** Mapa sempre em modo inspeção (sem alternância edição/inspeção). */
export function isMapInspectionOnlyRole(role: UserRole): boolean {
  return role === "admin" || role === "admin_corporativo" || role === "leadership";
}

export function isInventoryReadOnlyRole(role: UserRole): boolean {
  return role === "cliente" || role === "corporativo";
}

/** Gestão de inventário, estoque e substituição (admin / corporativo / liderança). */
export function canManageInventory(role: UserRole): boolean {
  return role === "admin" || role === "admin_corporativo" || role === "leadership";
}

/** Rotas do painel admin bloqueadas para o perfil liderança. */
export const LEADERSHIP_BLOCKED_ADMIN_PATHS = ["/admin/importacao"] as const;

export function isLeadershipBlockedAdminPath(pathname: string): boolean {
  return LEADERSHIP_BLOCKED_ADMIN_PATHS.some(
    (blocked) => pathname === blocked || pathname.startsWith(`${blocked}/`),
  );
}

/** Normaliza role vinda do banco (espaços / casing) para comparação segura. */
export function normalizeUserRole(role: unknown): UserRole | null {
  if (typeof role !== "string") return null;
  const value = role.trim().toLowerCase();
  if (
    value === "admin" ||
    value === "admin_corporativo" ||
    value === "leadership" ||
    value === "user" ||
    value === "cliente" ||
    value === "corporativo"
  ) {
    return value;
  }
  return null;
}

export function getHomePathForRole(role: UserRole | string | null | undefined): string {
  const normalized = normalizeUserRole(role);
  if (
    normalized === "admin" ||
    normalized === "admin_corporativo" ||
    normalized === "leadership" ||
    normalized === "cliente" ||
    normalized === "corporativo"
  ) {
    return "/admin/dashboard";
  }
  return "/mobile/conferencia";
}
