import { createClient } from "@supabase/supabase-js";
import type { SupabaseDatabase } from "@/lib/supabase/types";
import { assertSupabaseServiceRoleKey } from "@/lib/supabase/service-role-key";

function normalizeUrl(rawUrl: string) {
  return rawUrl.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/g, "");
}

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.",
    );
  }

  assertSupabaseServiceRoleKey(serviceRoleKey);

  return createClient<SupabaseDatabase>(normalizeUrl(supabaseUrl), serviceRoleKey.trim(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
