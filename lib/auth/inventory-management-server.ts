import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole } from "@/lib/auth/roles";

const INVENTORY_MANAGER_ROLES: UserRole[] = ["admin", "admin_corporativo", "leadership"];

export type InventoryManager = {
  id: string;
  role: UserRole;
  base_id: string;
};

async function userHasBaseAccess(
  userId: string,
  baseId: string,
): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("base_memberships")
    .select("base_id")
    .eq("user_id", userId)
    .eq("base_id", baseId)
    .maybeSingle<{ base_id: string }>();

  return !error && Boolean(data);
}

async function resolveManagerBaseId(
  request: Request,
  userId: string,
  profile: { role: UserRole; base_id: string | null },
): Promise<string | null> {
  const headerBaseId = request.headers.get("x-active-base-id")?.trim() || null;

  if (profile.role === "admin_corporativo") {
    if (!headerBaseId) return null;
    return (await userHasBaseAccess(userId, headerBaseId)) ? headerBaseId : null;
  }

  if (headerBaseId) {
    if (profile.base_id && headerBaseId === profile.base_id) {
      return headerBaseId;
    }
    if (await userHasBaseAccess(userId, headerBaseId)) {
      return headerBaseId;
    }
  }

  return profile.base_id ?? null;
}

export async function getInventoryManagerFromRequest(request: Request): Promise<InventoryManager | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role,active,base_id")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: UserRole; active: boolean; base_id: string | null }>();

  if (profileError || !profile || !profile.active || !INVENTORY_MANAGER_ROLES.includes(profile.role)) {
    return null;
  }

  const baseId = await resolveManagerBaseId(request, authData.user.id, profile);
  if (!baseId) return null;

  return { id: authData.user.id, role: profile.role, base_id: baseId };
}

export async function assertInventoryRowInManagerBase(
  table: "extintores" | "hidrantes",
  rowId: string,
  baseId: string,
): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id,base_id")
    .eq("id", rowId)
    .maybeSingle<{ id: string; base_id: string }>();

  if (error) return error.message;
  if (!data) return "Registro não encontrado.";
  if (data.base_id !== baseId) return "Registro fora da base ativa.";
  return null;
}
