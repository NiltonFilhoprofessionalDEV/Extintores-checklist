import { createClient } from "@supabase/supabase-js";
import type { SupabaseDatabase } from "@/lib/supabase/types";

let browserClient: ReturnType<typeof createClient<SupabaseDatabase>> | null = null;

function getNormalizedUrl(rawUrl: string) {
  return rawUrl.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/g, "");
}

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.",
    );
  }

  if (!browserClient) {
    browserClient = createClient<SupabaseDatabase>(
      getNormalizedUrl(supabaseUrl),
      supabaseAnonKey.trim(),
      {
        auth: {
          // Garante que a sessão persista em localStorage entre abas e recargas
          persistSession: true,
          // Renova o token automaticamente antes de expirar
          autoRefreshToken: true,
          // Chave específica do app evita conflitos com outros projetos Supabase
          storageKey: "extintor-app-v1",
          // PWA não precisa ler tokens da URL
          detectSessionInUrl: false,
        },
      },
    );
  }

  return browserClient;
}
