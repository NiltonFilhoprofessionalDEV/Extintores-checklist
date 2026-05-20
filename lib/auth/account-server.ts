import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { Profile } from "@/lib/auth/profile";

export type AuthenticatedAccount = {
  userId: string;
  email: string | null;
  profile: Profile;
};

export async function getAuthenticatedAccountFromRequest(
  request: Request,
): Promise<AuthenticatedAccount | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,nome,role,active")
    .eq("id", authData.user.id)
    .maybeSingle<Profile>();

  if (profileError || !profile || !profile.active) return null;

  return {
    userId: authData.user.id,
    email: authData.user.email ?? null,
    profile,
  };
}
