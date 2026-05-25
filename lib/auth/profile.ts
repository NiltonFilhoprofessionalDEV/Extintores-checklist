import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { UserRole, UserTeam } from "@/lib/auth/roles";

export type { UserRole } from "@/lib/auth/roles";

export type Profile = {
  id: string;
  nome: string;
  role: UserRole;
  team: UserTeam | null;
  active: boolean;
};

function isMissingTeamColumnError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42703" && error.message?.includes("profiles.team") === true;
}

async function getProfileWithoutTeam(session: Session): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nome,role,active")
    .eq("id", session.user.id)
    .maybeSingle<Omit<Profile, "team">>();

  if (error) throw error;
  return data ? { ...data, team: null } : null;
}

/** Evita chamadas paralelas a `getUser()` no mesmo instante (disputa o lock do Supabase Auth). */
let sessionRequestInFlight: Promise<Session | null> | null = null;

async function fetchCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!sessionRequestInFlight) {
    sessionRequestInFlight = fetchCurrentSession().finally(() => {
      sessionRequestInFlight = null;
    });
  }
  return sessionRequestInFlight;
}

export async function getProfileBySession(session: Session) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nome,role,team,active")
    .eq("id", session.user.id)
    .maybeSingle<Profile>();

  if (isMissingTeamColumnError(error)) {
    return getProfileWithoutTeam(session);
  }

  if (error) throw error;
  return data;
}
