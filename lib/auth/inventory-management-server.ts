import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole } from "@/lib/auth/roles";

const INVENTORY_MANAGER_ROLES: UserRole[] = ["admin", "leadership"];

export type InventoryManager = {
  id: string;
  role: UserRole;
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
    .select("role,active")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: UserRole; active: boolean }>();

  if (
    profileError ||
    !profile ||
    !profile.active ||
    !INVENTORY_MANAGER_ROLES.includes(profile.role)
  ) {
    return null;
  }

  return { id: authData.user.id, role: profile.role };
}
