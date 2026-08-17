import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole, UserTeam } from "@/lib/auth/roles";
import {
  canAssignRole,
  canManageTarget,
  isBaseRequiredForRole,
  isMultiBaseRole,
  isTeamRequiredForRole,
  isUserManager,
  normalizeUserRole,
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
  const resolved = await resolveUserManagerFromRequest(request);
  return resolved.manager;
}

export async function resolveUserManagerFromRequest(
  request: Request,
): Promise<{ manager: UserManager; error: null; status: 200 } | { manager: null; error: string; status: 401 | 403 }> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { manager: null, error: "Sessão não encontrada.", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { manager: null, error: "Sessão não encontrada.", status: 401 };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    console.error("[auth] getUser falhou ao resolver manager", authError?.message ?? "user ausente");
    return { manager: null, error: "Sessão inválida ou expirada. Entre novamente.", status: 401 };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role,team,active,base_id")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: string; team: string | null; active: boolean; base_id: string | null }>();

  if (profileError) {
    console.error("[auth] falha ao ler profile do manager", profileError);
    return { manager: null, error: "Não foi possível validar o perfil.", status: 401 };
  }
  if (!profile) {
    return { manager: null, error: "Perfil não encontrado.", status: 401 };
  }
  if (!profile.active) {
    return { manager: null, error: "Conta inativa.", status: 403 };
  }

  const role = normalizeUserRole(profile.role);
  if (!role || !isUserManager(role)) {
    return { manager: null, error: "Sem permissão para gerenciar usuários.", status: 403 };
  }

  const team = normalizeUserTeam(profile.team);
  if (role === "leadership" && !team) {
    return { manager: null, error: "Líder sem equipe definida.", status: 403 };
  }
  if (role === "leadership" && !profile.base_id) {
    return { manager: null, error: "Líder sem base definida.", status: 403 };
  }
  if (role === "admin" && !profile.base_id) {
    return { manager: null, error: "Administrador sem base definida.", status: 403 };
  }

  return {
    manager: { id: authData.user.id, role, team, base_id: profile.base_id },
    error: null,
    status: 200,
  };
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

export function assertCanManageTarget(
  manager: UserManager,
  target: ManagedProfile,
  scopeBaseId?: string | null,
): string | null {
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
  // Admin corporativo: só gerencia staff da base ativa (nunca mistura Curitiba x Santa Genoveva).
  if (
    manager.role === "admin_corporativo" &&
    scopeBaseId &&
    !isMultiBaseRole(target.role) &&
    target.base_id &&
    target.base_id !== scopeBaseId
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
