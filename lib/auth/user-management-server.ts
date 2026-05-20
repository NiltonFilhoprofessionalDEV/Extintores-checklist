import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole, UserTeam } from "@/lib/auth/roles";
import {
  canAssignRole,
  canManageTarget,
  isTeamRequiredForRole,
  isUserManager,
  normalizeUserTeam,
} from "@/lib/auth/roles";

export type UserManager = {
  id: string;
  role: UserRole;
  team: UserTeam | null;
};

export type ManagedProfile = {
  id: string;
  nome: string;
  role: UserRole;
  team: UserTeam | null;
  active: boolean;
};

export async function getUserManagerFromRequest(request: Request): Promise<UserManager | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role,team,active")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: UserRole; team: string | null; active: boolean }>();

  if (profileError || !profile || !profile.active || !isUserManager(profile.role)) return null;
  const team = normalizeUserTeam(profile.team);
  if (profile.role === "leadership" && !team) return null;

  return { id: authData.user.id, role: profile.role, team };
}

export async function getTargetProfile(userId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,nome,role,team,active")
    .eq("id", userId)
    .maybeSingle<ManagedProfile>();

  if (error) throw error;
  return data;
}

export function assertCanManageTarget(manager: UserManager, target: ManagedProfile): string | null {
  if (!canManageTarget(manager.role, target.role, manager.team, target.team)) {
    return "Sem permissão para gerenciar este usuário.";
  }
  return null;
}

export function assertCanAssignRole(manager: UserManager, newRole: UserRole): string | null {
  if (!canAssignRole(manager.role, newRole)) {
    return "Sem permissão para atribuir este perfil.";
  }
  return null;
}

export function resolveTeamForWrite(
  manager: UserManager,
  role: UserRole,
  requestedTeam: unknown,
): { team: UserTeam | null; error: string | null } {
  if (manager.role === "leadership") {
    if (role !== "user") {
      return { team: null, error: "Líderes só podem gerenciar usuários comuns." };
    }
    if (!manager.team) {
      return { team: null, error: "Líder sem equipe definida não pode gerenciar usuários." };
    }

    const requested = normalizeUserTeam(requestedTeam);
    if (requested && requested !== manager.team) {
      return { team: null, error: "Sem permissão para gerenciar usuários de outra equipe." };
    }

    return { team: manager.team, error: null };
  }

  const team = normalizeUserTeam(requestedTeam);
  if (isTeamRequiredForRole(role) && !team) {
    return { team: null, error: "Equipe é obrigatória para liderança e usuários comuns." };
  }

  if (requestedTeam && !team) {
    return { team: null, error: "Equipe inválida." };
  }

  return { team, error: null };
}
