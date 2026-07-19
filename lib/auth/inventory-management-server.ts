import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole } from "@/lib/auth/roles";

const INVENTORY_MANAGER_ROLES: UserRole[] = ["admin", "leadership"];

export type InventoryManager = {
  id: string;
  role: UserRole;
  base_id: string;
};

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

  if (
    profileError ||
    !profile ||
    !profile.active ||
    !profile.base_id ||
    !INVENTORY_MANAGER_ROLES.includes(profile.role)
  ) {
    return null;
  }

  return { id: authData.user.id, role: profile.role, base_id: profile.base_id };
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
  if (data.base_id !== baseId) return "Sem permissão para alterar registros de outra base.";
  return null;
}
