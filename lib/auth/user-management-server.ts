import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole } from "@/lib/auth/roles";
import { canAssignRole, canManageTarget, isUserManager } from "@/lib/auth/roles";

export type UserManager = {
  id: string;
  role: UserRole;
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
    .select("role,active")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: UserRole; active: boolean }>();

  if (profileError || !profile || !profile.active || !isUserManager(profile.role)) return null;

  return { id: authData.user.id, role: profile.role };
}

export async function getTargetProfile(userId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,nome,role,active")
    .eq("id", userId)
    .maybeSingle<{ id: string; nome: string; role: UserRole; active: boolean }>();

  if (error) throw error;
  return data;
}

export function assertCanManageTarget(manager: UserManager, targetRole: UserRole): string | null {
  if (manager.id && !canManageTarget(manager.role, targetRole)) {
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
