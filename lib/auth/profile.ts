import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentSession } from "@/lib/auth/session-client";
import type { UserRole, UserTeam } from "@/lib/auth/roles";

export type { UserRole } from "@/lib/auth/roles";
export { getCurrentSession, signOutCurrentUser } from "@/lib/auth/session-client";

export type Profile = {
  id: string;
  nome: string;
  role: UserRole;
  team: UserTeam | null;
  active: boolean;
  base_id: string | null;
};

function isMissingColumnError(
  error: { code?: string; message?: string } | null,
  column: string,
): boolean {
  return error?.code === "42703" && error.message?.includes(`profiles.${column}`) === true;
}

async function getProfileLegacy(session: Session): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nome,role,team,active")
    .eq("id", session.user.id)
    .maybeSingle<Omit<Profile, "base_id">>();

  if (isMissingColumnError(error, "team")) {
    const { data: withoutTeam, error: withoutTeamError } = await supabase
      .from("profiles")
      .select("id,nome,role,active")
      .eq("id", session.user.id)
      .maybeSingle<Omit<Profile, "team" | "base_id">>();
    if (withoutTeamError) throw withoutTeamError;
    return withoutTeam ? { ...withoutTeam, team: null, base_id: null } : null;
  }

  if (error) throw error;
  return data ? { ...data, base_id: null } : null;
}

export async function getProfileBySession(session: Session) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nome,role,team,active,base_id")
    .eq("id", session.user.id)
    .maybeSingle<Profile>();

  if (isMissingColumnError(error, "base_id")) {
    return getProfileLegacy(session);
  }

  if (isMissingColumnError(error, "team")) {
    return getProfileLegacy(session);
  }

  if (error) throw error;
  return data;
}
