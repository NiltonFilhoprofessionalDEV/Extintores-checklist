import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLocalCalendarDayUtcIsoRange,
  getLocalCalendarMonthUtcIsoRange,
} from "@/lib/date/local-month-range";

export type ProfileActivityStats = {
  today: number | null;
  month: number | null;
  total: number | null;
  lastAt: string | null;
};

type CountRange = {
  startIso?: string;
  endInclusiveIso?: string;
};

async function countByConferente(
  supabase: SupabaseClient,
  table: "checklists" | "checklists_hidrantes",
  conferente: string,
  baseId: string | null,
  range?: CountRange,
): Promise<number> {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("conferente", conferente);

  if (baseId) query = query.eq("base_id", baseId);
  if (range?.startIso) query = query.gte("data_conferencia", range.startIso);
  if (range?.endInclusiveIso) query = query.lte("data_conferencia", range.endInclusiveIso);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function latestByConferente(
  supabase: SupabaseClient,
  table: "checklists" | "checklists_hidrantes",
  conferente: string,
  baseId: string | null,
): Promise<string | null> {
  let query = supabase
    .from(table)
    .select("data_conferencia")
    .eq("conferente", conferente)
    .order("data_conferencia", { ascending: false })
    .limit(1);

  if (baseId) query = query.eq("base_id", baseId);

  const { data, error } = await query;
  if (error) throw error;
  const value = data?.[0]?.data_conferencia;
  return typeof value === "string" ? value : null;
}

function sumSettled(results: PromiseSettledResult<number>[]): number | null {
  const values = results
    .filter((result): result is PromiseFulfilledResult<number> => result.status === "fulfilled")
    .map((result) => result.value);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function latestSettled(results: PromiseSettledResult<string | null>[]): string | null {
  const dates = results
    .filter((result): result is PromiseFulfilledResult<string | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((value): value is string => Boolean(value));
  if (dates.length === 0) return null;
  return dates.reduce((latest, current) => (current > latest ? current : latest));
}

/**
 * Contagens de inspeções do conferente (extintor + hidrante) via count no servidor.
 * Falha em uma tabela não zera as demais.
 */
export async function fetchProfileActivityStats(
  supabase: SupabaseClient,
  conferente: string,
  baseId: string | null,
  reference = new Date(),
): Promise<ProfileActivityStats> {
  const nome = conferente.trim();
  if (!nome) {
    return { today: 0, month: 0, total: 0, lastAt: null };
  }

  const day = getLocalCalendarDayUtcIsoRange(reference);
  const month = getLocalCalendarMonthUtcIsoRange(reference);
  const tables = ["checklists", "checklists_hidrantes"] as const;

  const [todayParts, monthParts, totalParts, lastParts] = await Promise.all([
    Promise.allSettled(tables.map((table) => countByConferente(supabase, table, nome, baseId, day))),
    Promise.allSettled(tables.map((table) => countByConferente(supabase, table, nome, baseId, month))),
    Promise.allSettled(tables.map((table) => countByConferente(supabase, table, nome, baseId))),
    Promise.allSettled(tables.map((table) => latestByConferente(supabase, table, nome, baseId))),
  ]);

  return {
    today: sumSettled(todayParts),
    month: sumSettled(monthParts),
    total: sumSettled(totalParts),
    lastAt: latestSettled(lastParts),
  };
}
