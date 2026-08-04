import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { getSupabaseUserClient } from "@/lib/supabase/server-user";
import { isRlsViolation } from "@/lib/supabase/service-role-key";

const RLS_HINT =
  "Se o erro persistir, confira SUPABASE_SERVICE_ROLE_KEY no deploy (deve ser a chave service_role do Supabase, não a anon) " +
  "e execute docs/migration_fix_import_extintores_rls.sql no SQL Editor do Supabase.";

export async function getImportSupabaseClient(accessToken: string): Promise<SupabaseClient> {
  try {
    return getSupabaseAdminClient();
  } catch (adminError) {
    const message =
      adminError instanceof Error ? adminError.message : "Falha ao inicializar cliente admin.";
    throw new Error(`${message} ${RLS_HINT}`);
  }
}

export async function runImportWithRlsFallback<T>(
  accessToken: string,
  operation: (client: SupabaseClient) => Promise<T>,
): Promise<T> {
  const adminClient = await getImportSupabaseClient(accessToken);

  try {
    return await operation(adminClient);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isRlsViolation(message)) throw error;

    const userClient = getSupabaseUserClient(accessToken);
    try {
      return await operation(userClient);
    } catch (userError) {
      const userMessage = userError instanceof Error ? userError.message : String(userError);
      if (isRlsViolation(userMessage)) {
        throw new Error(`${userMessage}\n\n${RLS_HINT}`);
      }
      throw userError;
    }
  }
}

export async function runImportSyncWithRlsFallback<T extends { error: string | null }>(
  accessToken: string,
  operation: (client: SupabaseClient) => Promise<T>,
): Promise<T> {
  const adminClient = await getImportSupabaseClient(accessToken);
  const adminResult = await operation(adminClient);
  if (!adminResult.error || !isRlsViolation(adminResult.error)) {
    return adminResult;
  }

  const userClient = getSupabaseUserClient(accessToken);
  const userResult = await operation(userClient);
  if (userResult.error && isRlsViolation(userResult.error)) {
    return {
      ...userResult,
      error: `${userResult.error}\n\n${RLS_HINT}`,
    };
  }
  return userResult;
}
