import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

export type UserRole = "admin" | "user";

export type Profile = {
  id: string;
  nome: string;
  role: UserRole;
  active: boolean;
};

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  // getUser() faz uma chamada de rede que força a renovação do access token
  // quando ele está expirado mas o refresh token ainda é válido.
  // Isso evita que o app deslogue o usuário após inatividade.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  // Retorna a sessão já atualizada (com novo access token se foi renovado)
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
