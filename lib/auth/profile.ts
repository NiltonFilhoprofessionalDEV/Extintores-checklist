import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/auth/roles";

export type { UserRole } from "@/lib/auth/roles";

export type Profile = {
  id: string;
  nome: string;
  role: UserRole;
  active: boolean;
};

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfileBySession(session: Session) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nome,role,active")
    .eq("id", session.user.id)
    .maybeSingle<Profile>();

  if (error) throw error;
  return data;
}
