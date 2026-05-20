export type UserRole = "admin" | "leadership" | "user";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  leadership: "Liderança",
  user: "Usuário comum",
};

export const MANAGER_ROLES: UserRole[] = ["admin", "leadership"];

export function isUserManager(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

/** Quem pode acessar a gestão de usuários (criar/editar/excluir conforme regras abaixo). */
export function canManageTarget(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "admin") return true;
  if (actorRole === "leadership") return targetRole === "user";
  return false;
}

/** Papel que o ator pode atribuir ao criar ou editar. */
export function canAssignRole(actorRole: UserRole, newRole: UserRole): boolean {
  if (actorRole === "admin") return true;
  if (actorRole === "leadership") return newRole === "user";
  return false;
}

export function assignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === "admin") return ["admin", "leadership", "user"];
  if (actorRole === "leadership") return ["user"];
  return [];
}

/** Rotas do painel admin bloqueadas para o perfil liderança. */
export const LEADERSHIP_BLOCKED_ADMIN_PATHS = ["/admin/importacao"] as const;

export function isLeadershipBlockedAdminPath(pathname: string): boolean {
  return LEADERSHIP_BLOCKED_ADMIN_PATHS.some(
    (blocked) => pathname === blocked || pathname.startsWith(`${blocked}/`),
  );
}

export function getHomePathForRole(role: UserRole): string {
  if (role === "admin" || role === "leadership") return "/admin/dashboard";
  return "/mobile/conferencia";
}
