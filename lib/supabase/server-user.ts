import { createClient } from "@supabase/supabase-js";
import type { SupabaseDatabase } from "@/lib/supabase/types";

function normalizeUrl(rawUrl: string) {
  return rawUrl.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/g, "");
}

/** Cliente Supabase autenticado como o usuário (sujeito a RLS). Uso server-side. */
export function getSupabaseUserClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.",
    );
  }

  return createClient<SupabaseDatabase>(
    normalizeUrl(supabaseUrl),
    supabaseAnonKey.trim(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
        },
      },
    },
  );
}
