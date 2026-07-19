import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export type EqFilter = { column: string; value: string };

/**
 * Busca todas as linhas de uma query Supabase paginando em lotes de 1000.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) return { data: all, error: error.message };

    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { data: all, error: null };
}

export async function fetchAllFromTable<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  order?: { column: string; ascending?: boolean },
  eqFilter?: EqFilter,
): Promise<{ data: T[]; error: string | null }> {
  return fetchAllPages<T>((from, to) => {
    let query = supabase.from(table).select(select).range(from, to);
    if (eqFilter) {
      query = query.eq(eqFilter.column, eqFilter.value);
    }
    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }
    return query as unknown as Promise<PageResult<T>>;
  });
}
