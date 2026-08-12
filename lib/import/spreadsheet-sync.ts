import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExtintorImportRecord } from "@/lib/rf01/import-parser";
import type { HidranteImportRow } from "@/lib/rf01/hidrante-import-parser";
import { fetchAllFromTable } from "@/lib/supabase/fetch-all";

const CHUNK_SIZE = 200;
const UPDATE_CONCURRENCY = 25;

export type ImportMode = "cadastro" | "atualizacao";

export type ImportSyncResult = {
  inserted: number;
  updated: number;
  error: string | null;
  /** Linhas repetidas na planilha (mesmo código); manteve-se a última ocorrência. */
  duplicatesInSheet?: number;
};

function normalizeCodigo(codigo: string): string {
  return codigo.trim();
}

function isDuplicateKeyError(message: string | undefined): boolean {
  if (!message) return false;
  return /duplicate|unique|already exists|violates unique/i.test(message);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function dedupeByCodigo<T extends { codigo: string }>(
  rows: T[],
): { rows: T[]; duplicatesInSheet: number } {
  const map = new Map<string, T>();
  let duplicatesInSheet = 0;

  for (const row of rows) {
    const key = normalizeCodigo(row.codigo);
    if (!key) continue;
    if (map.has(key)) duplicatesInSheet++;
    map.set(key, row);
  }

  return { rows: Array.from(map.values()), duplicatesInSheet };
}

async function loadCodigoSet(
  supabase: SupabaseClient,
  table: "extintores" | "hidrantes",
  baseId: string,
): Promise<{ set: Set<string>; error: string | null }> {
  const { data, error } = await fetchAllFromTable<{ codigo: string }>(
    supabase,
    table,
    "codigo",
    undefined,
    { column: "base_id", value: baseId },
  );
  if (error) return { set: new Set(), error };
  return {
    set: new Set(data.map((r) => normalizeCodigo(r.codigo)).filter(Boolean)),
    error: null,
  };
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<{ error: { message: string } | null }>,
): Promise<string | null> {
  for (const batch of chunk(items, batchSize)) {
    const results = await Promise.all(batch.map(fn));
    const failed = results.find((r) => r.error);
    if (failed?.error) return failed.error.message;
  }
  return null;
}

function dateOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function extintorInsertPayload(row: ExtintorImportRecord) {
  return {
    codigo: normalizeCodigo(row.codigo),
    setor: row.setor,
    local_detalhado: row.local_detalhado,
    num_inmetro: row.num_inmetro,
    num_cilindro: row.num_cilindro?.trim() || null,
    tipo: row.tipo,
    tamanho: row.tamanho,
    capacidade_extintora: row.capacidade_extintora,
    manutencao_2_nivel: dateOrNull(row.manutencao_2_nivel),
    manutencao_3_nivel: dateOrNull(row.manutencao_3_nivel),
  };
}

function extintorUpdatePayload(row: ExtintorImportRecord) {
  const { codigo: _codigo, ...fields } = extintorInsertPayload(row);
  return fields;
}

function withBaseId<T extends Record<string, unknown>>(rows: T[], baseId: string) {
  return rows.map((row) => ({ ...row, base_id: baseId }));
}

async function updateExtintorFromPayload(
  supabase: SupabaseClient,
  row: ReturnType<typeof extintorInsertPayload> & { base_id: string },
) {
  const { codigo, base_id, ...fields } = row;
  return supabase.from("extintores").update(fields).eq("codigo", codigo).eq("base_id", base_id);
}

async function insertExtintorBatchOrUpdateOnConflict(
  supabase: SupabaseClient,
  batch: Array<ReturnType<typeof extintorInsertPayload> & { base_id: string }>,
): Promise<string | null> {
  const { error } = await supabase.from("extintores").insert(batch);
  if (!error) return null;
  if (!isDuplicateKeyError(error.message)) return error.message;

  for (const row of batch) {
    const { error: updateError } = await updateExtintorFromPayload(supabase, row);
    if (updateError) return updateError.message;
  }
  return null;
}

export async function syncExtintores(
  supabase: SupabaseClient,
  rows: ExtintorImportRecord[],
  mode: ImportMode,
  baseId: string,
): Promise<ImportSyncResult> {
  if (!baseId) return { inserted: 0, updated: 0, error: "Base ativa não definida." };
  if (rows.length === 0) return { inserted: 0, updated: 0, error: null };

  const { rows: uniqueRows, duplicatesInSheet } = dedupeByCodigo(rows);
  const withDupes = (result: Omit<ImportSyncResult, "duplicatesInSheet">): ImportSyncResult => ({
    ...result,
    duplicatesInSheet: duplicatesInSheet > 0 ? duplicatesInSheet : undefined,
  });

  if (uniqueRows.length === 0) {
    return withDupes({ inserted: 0, updated: 0, error: "Nenhuma linha com código preenchido." });
  }

  if (mode === "cadastro") {
    const payloads = uniqueRows.map(extintorInsertPayload);
    for (const batch of chunk(withBaseId(payloads, baseId), CHUNK_SIZE)) {
      const { error } = await supabase.from("extintores").insert(batch);
      if (error) {
        return withDupes({
          inserted: 0,
          updated: 0,
          error: isDuplicateKeyError(error.message)
            ? `${error.message} (conflito na base selecionada — confira o seletor «Base ativa» ou use «Atualizar em lote».)`
            : error.message,
        });
      }
    }
    return withDupes({ inserted: uniqueRows.length, updated: 0, error: null });
  }

  const { set: existing, error: loadError } = await loadCodigoSet(supabase, "extintores", baseId);
  if (loadError) return withDupes({ inserted: 0, updated: 0, error: loadError });

  const toInsert = uniqueRows.filter((r) => !existing.has(normalizeCodigo(r.codigo)));
  const toUpdate = uniqueRows.filter((r) => existing.has(normalizeCodigo(r.codigo)));

  const insertPayloads = toInsert.map(extintorInsertPayload);
  for (const batch of chunk(withBaseId(insertPayloads, baseId), CHUNK_SIZE)) {
    const insertError = await insertExtintorBatchOrUpdateOnConflict(supabase, batch);
    if (insertError) {
      return withDupes({ inserted: 0, updated: 0, error: insertError });
    }
  }

  const updateError = await runInBatches(toUpdate, UPDATE_CONCURRENCY, async (row) =>
    supabase
      .from("extintores")
      .update(extintorUpdatePayload(row))
      .eq("codigo", normalizeCodigo(row.codigo))
      .eq("base_id", baseId),
  );
  if (updateError) return withDupes({ inserted: 0, updated: 0, error: updateError });

  return withDupes({
    inserted: toInsert.length,
    updated: toUpdate.length,
    error: null,
  });
}

export async function syncHidrantes(
  supabase: SupabaseClient,
  rows: HidranteImportRow[],
  mode: ImportMode,
  baseId: string,
): Promise<ImportSyncResult> {
  if (!baseId) return { inserted: 0, updated: 0, error: "Base ativa não definida." };
  if (rows.length === 0) return { inserted: 0, updated: 0, error: null };

  const { rows: uniqueRows, duplicatesInSheet } = dedupeByCodigo(rows);
  const withDupes = (result: Omit<ImportSyncResult, "duplicatesInSheet">): ImportSyncResult => ({
    ...result,
    duplicatesInSheet: duplicatesInSheet > 0 ? duplicatesInSheet : undefined,
  });

  if (uniqueRows.length === 0) {
    return withDupes({ inserted: 0, updated: 0, error: "Nenhuma linha com código preenchido." });
  }

  if (mode === "cadastro") {
    for (const batch of chunk(withBaseId(uniqueRows, baseId), CHUNK_SIZE)) {
      const { error } = await supabase.from("hidrantes").insert(batch);
      if (error) {
        return withDupes({
          inserted: 0,
          updated: 0,
          error: isDuplicateKeyError(error.message)
            ? `${error.message} (conflito na base selecionada — confira o seletor «Base ativa» ou use «Atualizar em lote».)`
            : error.message,
        });
      }
    }
    return withDupes({ inserted: uniqueRows.length, updated: 0, error: null });
  }

  const { set: existing, error: loadError } = await loadCodigoSet(supabase, "hidrantes", baseId);
  if (loadError) return withDupes({ inserted: 0, updated: 0, error: loadError });

  const toUpdate = uniqueRows.filter((r) => existing.has(normalizeCodigo(r.codigo)));
  const toInsert = uniqueRows.filter((r) => !existing.has(normalizeCodigo(r.codigo)));

  for (const batch of chunk(withBaseId(toInsert, baseId), CHUNK_SIZE)) {
    const { error } = await supabase.from("hidrantes").insert(batch);
    if (error && isDuplicateKeyError(error.message)) {
      for (const row of batch) {
        const { error: upsertError } = await supabase
          .from("hidrantes")
          .upsert(row, { onConflict: "base_id,codigo" });
        if (upsertError) return withDupes({ inserted: 0, updated: 0, error: upsertError.message });
      }
    } else if (error) {
      return withDupes({ inserted: 0, updated: 0, error: error.message });
    }
  }

  for (const batch of chunk(withBaseId(toUpdate, baseId), CHUNK_SIZE)) {
    const { error } = await supabase
      .from("hidrantes")
      .upsert(batch, { onConflict: "base_id,codigo" });
    if (error) return withDupes({ inserted: 0, updated: 0, error: error.message });
  }

  return withDupes({
    inserted: toInsert.length,
    updated: toUpdate.length,
    error: null,
  });
}

export function formatSyncResultMessage(
  result: ImportSyncResult,
  label: string,
  skipped?: number,
): string {
  const parts: string[] = [];
  if (result.updated > 0) parts.push(`${result.updated} ${label} atualizado(s)`);
  if (result.inserted > 0) parts.push(`${result.inserted} novo(s) cadastro(s)`);
  if (parts.length === 0) parts.push("Nenhum registro processado.");
  let msg = parts.join(", ") + ".";
  if (result.duplicatesInSheet && result.duplicatesInSheet > 0) {
    msg += ` (${result.duplicatesInSheet} linha(s) repetida(s) na planilha foram ignoradas.)`;
  }
  if (skipped && skipped > 0) {
    msg += ` (${skipped} linha(s) ignorada(s) por falta de código.)`;
  }
  return msg;
}
