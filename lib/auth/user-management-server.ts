import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole, UserTeam } from "@/lib/auth/roles";
import {
  canAssignRole,
  canManageTarget,
  isBaseRequiredForRole,
  isMultiBaseRole,
  isTeamRequiredForRole,
  isUserManager,
  normalizeUserTeam,
} from "@/lib/auth/roles";

export type UserManager = {
  id: string;
  role: UserRole;
  team: UserTeam | null;
  base_id: string | null;
};

export type ManagedProfile = {
  id: string;
  nome: string;
  role: UserRole;
  team: UserTeam | null;
  active: boolean;
  base_id: string | null;
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
    .select("role,team,active,base_id")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: UserRole; team: string | null; active: boolean; base_id: string | null }>();

  if (profileError || !profile || !profile.active || !isUserManager(profile.role)) return null;
  const team = normalizeUserTeam(profile.team);
  if (profile.role === "leadership" && !team) return null;
  if (profile.role === "leadership" && !profile.base_id) return null;
  if (profile.role === "admin" && !profile.base_id) return null;
  // admin_corporativo: base_id pode ser null (usa memberships)

  return { id: authData.user.id, role: profile.role, team, base_id: profile.base_id };
}

export async function getManagerAccessibleBaseIds(manager: UserManager): Promise<string[]> {
  if (manager.role === "admin" || manager.role === "leadership") {
    return manager.base_id ? [manager.base_id] : [];
  }

  if (manager.role === "admin_corporativo") {
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("base_memberships")
      .select("base_id")
      .eq("user_id", manager.id);
    if (error) throw error;
    return (data ?? []).map((row) => String(row.base_id));
  }

  return [];
}

export async function getTargetProfile(userId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,nome,role,team,active,base_id")
    .eq("id", userId)
    .maybeSingle<ManagedProfile>();

  if (error) throw error;
  return data;
}

export function assertCanManageTarget(manager: UserManager, target: ManagedProfile): string | null {
  if (!canManageTarget(manager.role, target.role, manager.team, target.team)) {
    return "Sem permissão para gerenciar este usuário.";
  }
  if (
    manager.role === "admin" &&
    manager.base_id &&
    !isMultiBaseRole(target.role) &&
    target.base_id &&
    target.base_id !== manager.base_id
  ) {
    return "Sem permissão para gerenciar usuários de outra base.";
  }
  if (
    manager.role === "leadership" &&
    manager.base_id &&
    target.base_id &&
    target.base_id !== manager.base_id
  ) {
    return "Sem permissão para gerenciar usuários de outra base.";
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

export function resolveBaseForWrite(
  manager: UserManager,
  role: UserRole,
  requestedBaseIds: unknown,
): { base_id: string | null; membershipBaseIds: string[]; error: string | null } {
  const ids = Array.isArray(requestedBaseIds)
    ? requestedBaseIds.map((id) => String(id)).filter(Boolean)
    : [];

  if (isMultiBaseRole(role)) {
    if (manager.role !== "admin_corporativo") {
      return {
        base_id: null,
        membershipBaseIds: [],
        error: "Apenas Administrador Corporativo pode criar este tipo de acesso.",
      };
    }
    if (role !== "admin_corporativo") {
      return {
        base_id: null,
        membershipBaseIds: [],
        error: "Perfil corporativo de consulta não é utilizado. Use Administrador Corporativo.",
      };
    }
    if (ids.length === 0) {
      return {
        base_id: null,
        membershipBaseIds: [],
        error: "Informe ao menos uma base para o usuário.",
      };
    }
    return { base_id: null, membershipBaseIds: ids, error: null };
  }

  if (!isBaseRequiredForRole(role)) {
    return { base_id: null, membershipBaseIds: [], error: null };
  }

  if (manager.role === "admin_corporativo") {
    const base_id = ids[0] ?? null;
    if (!base_id) {
      return {
        base_id: null,
        membershipBaseIds: [],
        error: "Informe a base do usuário.",
      };
    }
    return { base_id, membershipBaseIds: [], error: null };
  }

  if (!manager.base_id) {
    return { base_id: null, membershipBaseIds: [], error: "Administrador sem base definida." };
  }

  return { base_id: manager.base_id, membershipBaseIds: [], error: null };
}

export async function replaceBaseMemberships(userId: string, baseIds: string[]): Promise<void> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { error: deleteError } = await supabaseAdmin
    .from("base_memberships")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (baseIds.length === 0) return;

  const { error: insertError } = await supabaseAdmin.from("base_memberships").insert(
    baseIds.map((base_id) => ({ user_id: userId, base_id })),
  );
  if (insertError) throw insertError;
}
