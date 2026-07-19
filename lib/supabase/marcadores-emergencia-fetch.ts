import type { SupabaseClient } from "@supabase/supabase-js";

const MAP_FULL =
  "id,kind,pavimento,coord_x,coord_y,quantidade,verified_at,verified_by,inspecao_resultado,nao_conformidade_descricao";
const MAP_LEGACY = "id,kind,pavimento,coord_x,coord_y,quantidade,verified_at,verified_by";

const DASH_FULL =
  "id,kind,pavimento,quantidade,verified_at,verified_by,inspecao_resultado,nao_conformidade_descricao";
const DASH_LEGACY = "id,kind,pavimento,quantidade,verified_at,verified_by";

function withInspecaoDefaults<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map((row) => ({
    ...row,
    inspecao_resultado: (row as { inspecao_resultado?: unknown }).inspecao_resultado ?? null,
    nao_conformidade_descricao:
      (row as { nao_conformidade_descricao?: unknown }).nao_conformidade_descricao ?? null,
  }));
}

/**
 * Carrega marcadores de emergência para o mapa. Se as colunas de inspeção ainda não existirem no banco,
 * repete o select sem elas (evita sumir todos os pontos após deploy antes da migração SQL).
 */
export async function fetchMarcadoresEmergenciaForMap(
  supabase: SupabaseClient,
  baseId?: string | null,
) {
  let fullQuery = supabase.from("marcadores_emergencia").select(MAP_FULL);
  if (baseId) fullQuery = fullQuery.eq("base_id", baseId);
  const full = await fullQuery;
  if (!full.error) return withInspecaoDefaults((full.data ?? []) as Record<string, unknown>[]);

  let legacyQuery = supabase.from("marcadores_emergencia").select(MAP_LEGACY);
  if (baseId) legacyQuery = legacyQuery.eq("base_id", baseId);
  const legacy = await legacyQuery;
  if (!legacy.error) return withInspecaoDefaults((legacy.data ?? []) as Record<string, unknown>[]);

  return [];
}

/** Mesma tolerância à ausência de colunas, para o dashboard admin. */
export async function fetchMarcadoresEmergenciaForDashboard(
  supabase: SupabaseClient,
  baseId?: string | null,
) {
  let fullQuery = supabase.from("marcadores_emergencia").select(DASH_FULL);
  if (baseId) fullQuery = fullQuery.eq("base_id", baseId);
  const full = await fullQuery;
  if (!full.error) return withInspecaoDefaults((full.data ?? []) as Record<string, unknown>[]);

  let legacyQuery = supabase.from("marcadores_emergencia").select(DASH_LEGACY);
  if (baseId) legacyQuery = legacyQuery.eq("base_id", baseId);
  const legacy = await legacyQuery;
  if (!legacy.error) return withInspecaoDefaults((legacy.data ?? []) as Record<string, unknown>[]);

  return [];
}
