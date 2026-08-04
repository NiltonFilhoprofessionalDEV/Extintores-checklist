/**
 * Valida se a chave JWT do Supabase é service_role (bypass RLS).
 * Erro comum: usar NEXT_PUBLIC_SUPABASE_ANON_KEY no lugar de SUPABASE_SERVICE_ROLE_KEY.
 */
export function assertSupabaseServiceRoleKey(key: string): void {
  const parts = key.trim().split(".");
  if (parts.length < 2) return;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      role?: string;
    };

    if (payload.role && payload.role !== "service_role") {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY inválida: a chave configurada não é service_role. " +
          "No Supabase → Settings → API, copie a chave «service_role» (secret), não a «anon».",
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      throw error;
    }
    // JWT malformado: deixa o Supabase falhar depois.
  }
}

export function isRlsViolation(message: string | undefined): boolean {
  if (!message) return false;
  return /row-level security|rls policy/i.test(message);
}
