export type UserRole = "admin" | "leadership" | "user" | "cliente";
export type UserTeam = "ALFA" | "BRAVO" | "CHARLIE" | "DELTA";

export const USER_TEAMS: UserTeam[] = ["ALFA", "BRAVO", "CHARLIE", "DELTA"];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  leadership: "Liderança",
  user: "Bombeiro",
  cliente: "Cliente",
};

export const TEAM_LABELS: Record<UserTeam, string> = {
  ALFA: "ALFA",
  BRAVO: "BRAVO",
  CHARLIE: "CHARLIE",
  DELTA: "DELTA",
};

export const MANAGER_ROLES: UserRole[] = ["admin", "leadership"];

export function isUserManager(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

/** Quem pode acessar a gestão de usuários (criar/editar/excluir conforme regras abaixo). */
export function canManageTarget(
  actorRole: UserRole,
  targetRole: UserRole,
  actorTeam?: UserTeam | null,
  targetTeam?: UserTeam | null,
): boolean {
  if (actorRole === "admin") return true;
  if (actorRole === "leadership") {
    return targetRole === "user" && Boolean(actorTeam) && actorTeam === targetTeam;
  }
  return false;
}

/** Papel que o ator pode atribuir ao criar ou editar. */
export function canAssignRole(actorRole: UserRole, newRole: UserRole): boolean {
  if (actorRole === "admin") return true;
  if (actorRole === "leadership") return newRole === "user";
  return false;
}

export function assignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === "admin") return ["admin", "leadership", "user", "cliente"];
  if (actorRole === "leadership") return ["user"];
  return [];
}

export function isTeamRequiredForRole(role: UserRole): boolean {
  return role === "leadership" || role === "user";
}

export function isValidUserTeam(value: unknown): value is UserTeam {
  return typeof value === "string" && USER_TEAMS.includes(value as UserTeam);
}

export function normalizeUserTeam(value: unknown): UserTeam | null {
  return isValidUserTeam(value) ? value : null;
}

/** Rotas do painel admin permitidas ao perfil cliente (somente consulta). */
export const CLIENT_ALLOWED_ADMIN_PATHS = [
  "/admin/dashboard",
  "/admin/extintores",
  "/admin/mapeamento",
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
  return role === "admin";
}

export function canUseMapInspection(role: UserRole): boolean {
  return role === "admin" || role === "leadership" || role === "user";
}

export function isInventoryReadOnlyRole(role: UserRole): boolean {
  return role === "cliente";
}

/** Rotas do painel admin bloqueadas para o perfil liderança. */
export const LEADERSHIP_BLOCKED_ADMIN_PATHS = ["/admin/importacao"] as const;

export function isLeadershipBlockedAdminPath(pathname: string): boolean {
  return LEADERSHIP_BLOCKED_ADMIN_PATHS.some(
    (blocked) => pathname === blocked || pathname.startsWith(`${blocked}/`),
  );
}

export function getHomePathForRole(role: UserRole): string {
  if (role === "admin" || role === "leadership" || role === "cliente") return "/admin/dashboard";
  return "/mobile/conferencia";
}
