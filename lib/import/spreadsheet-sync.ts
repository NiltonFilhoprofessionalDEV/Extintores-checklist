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
};

function normalizeCodigo(codigo: string): string {
  return codigo.trim();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
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

function extintorUpdatePayload(row: ExtintorImportRecord) {
  return {
    setor: row.setor,
    local_detalhado: row.local_detalhado,
    num_inmetro: row.num_inmetro,
    tipo: row.tipo,
    tamanho: row.tamanho,
    capacidade_extintora: row.capacidade_extintora,
    manutencao_2_nivel: row.manutencao_2_nivel || null,
    manutencao_3_nivel: row.manutencao_3_nivel || null,
  };
}

function withBaseId<T extends Record<string, unknown>>(rows: T[], baseId: string) {
  return rows.map((row) => ({ ...row, base_id: baseId }));
}

export async function syncExtintores(
  supabase: SupabaseClient,
  rows: ExtintorImportRecord[],
  mode: ImportMode,
  baseId: string,
): Promise<ImportSyncResult> {
  if (!baseId) return { inserted: 0, updated: 0, error: "Base ativa não definida." };
  if (rows.length === 0) return { inserted: 0, updated: 0, error: null };

  if (mode === "cadastro") {
    for (const batch of chunk(withBaseId(rows, baseId), CHUNK_SIZE)) {
      const { error } = await supabase.from("extintores").insert(batch);
      if (error) return { inserted: 0, updated: 0, error: error.message };
    }
    return { inserted: rows.length, updated: 0, error: null };
  }

  const { set: existing, error: loadError } = await loadCodigoSet(supabase, "extintores", baseId);
  if (loadError) return { inserted: 0, updated: 0, error: loadError };

  const toInsert = rows.filter((r) => !existing.has(normalizeCodigo(r.codigo)));
  const toUpdate = rows.filter((r) => existing.has(normalizeCodigo(r.codigo)));

  for (const batch of chunk(withBaseId(toInsert, baseId), CHUNK_SIZE)) {
    const { error } = await supabase.from("extintores").insert(batch);
    if (error) return { inserted: 0, updated: 0, error: error.message };
  }

  const updateError = await runInBatches(toUpdate, UPDATE_CONCURRENCY, async (row) =>
    supabase
      .from("extintores")
      .update(extintorUpdatePayload(row))
      .eq("codigo", normalizeCodigo(row.codigo))
      .eq("base_id", baseId),
  );
  if (updateError) return { inserted: 0, updated: 0, error: updateError };

  return { inserted: toInsert.length, updated: toUpdate.length, error: null };
}

export async function syncHidrantes(
  supabase: SupabaseClient,
  rows: HidranteImportRow[],
  mode: ImportMode,
  baseId: string,
): Promise<ImportSyncResult> {
  if (!baseId) return { inserted: 0, updated: 0, error: "Base ativa não definida." };
  if (rows.length === 0) return { inserted: 0, updated: 0, error: null };

  if (mode === "cadastro") {
    for (const batch of chunk(withBaseId(rows, baseId), CHUNK_SIZE)) {
      const { error } = await supabase.from("hidrantes").insert(batch);
      if (error) return { inserted: 0, updated: 0, error: error.message };
    }
    return { inserted: rows.length, updated: 0, error: null };
  }

  const { set: existing, error: loadError } = await loadCodigoSet(supabase, "hidrantes", baseId);
  if (loadError) return { inserted: 0, updated: 0, error: loadError };

  const toUpdate = rows.filter((r) => existing.has(normalizeCodigo(r.codigo)));
  const toInsert = rows.filter((r) => !existing.has(normalizeCodigo(r.codigo)));

  for (const batch of chunk(withBaseId(toInsert, baseId), CHUNK_SIZE)) {
    const { error } = await supabase.from("hidrantes").insert(batch);
    if (error) return { inserted: 0, updated: 0, error: error.message };
  }

  for (const batch of chunk(withBaseId(toUpdate, baseId), CHUNK_SIZE)) {
    const { error } = await supabase
      .from("hidrantes")
      .upsert(batch, { onConflict: "base_id,codigo" });
    if (error) return { inserted: 0, updated: 0, error: error.message };
  }

  return { inserted: toInsert.length, updated: toUpdate.length, error: null };
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
  if (skipped && skipped > 0) {
    msg += ` (${skipped} linha(s) ignorada(s) por falta de código.)`;
  }
  return msg;
}
