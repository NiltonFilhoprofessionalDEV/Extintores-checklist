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
          persistSession: true,
          autoRefreshToken: true,
          storageKey: "extintor-app-v1",
          detectSessionInUrl: false,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      },
    );
  }

  return browserClient;
}
