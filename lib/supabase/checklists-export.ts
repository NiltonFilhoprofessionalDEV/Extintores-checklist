import type { SupabaseClient } from "@supabase/supabase-js";
import { fillChecklistItemsFromObservacoes } from "@/lib/checklist/parse-legacy-observacoes";
import type { ChecklistRow, ExtintorChecklistExportItem } from "@/lib/export/excel";
import { fetchAllPages } from "./fetch-all";

const EXTINTOR_EMBED = "extintores(codigo,setor,local_detalhado)";

/** Tentativas de select — da mais completa à mínima (compatível com schema antigo). */
const CHECKLIST_SELECT_ATTEMPTS = [
  `id,extintor_id,data_conferencia,conferente,local_correto,dados_corretos,sinalizacao_correta,mangueira_status,bico_difusor_status,alca_gatilho_status,medidor_pressao_status,cilindro_status,status_lacre,status_manometro,observacoes,created_at,${EXTINTOR_EMBED}`,
  `id,extintor_id,data_conferencia,conferente,local_correto,dados_corretos,sinalizacao_correta,mangueira_status,bico_difusor_status,alca_gatilho_status,medidor_pressao_status,cilindro_status,observacoes,created_at,${EXTINTOR_EMBED}`,
  `id,extintor_id,data_conferencia,conferente,status_lacre,status_manometro,observacoes,created_at,${EXTINTOR_EMBED}`,
  `id,extintor_id,data_conferencia,conferente,observacoes,created_at,${EXTINTOR_EMBED}`,
  `id,extintor_id,data_conferencia,conferente,observacoes,${EXTINTOR_EMBED}`,
];

function pickRelation<T extends Record<string, unknown>>(rel: unknown): T | null {
  if (!rel || typeof rel !== "object") return null;
  if (Array.isArray(rel)) return (rel[0] as T | undefined) ?? null;
  return rel as T;
}

function normalizeChecklistRow(raw: Record<string, unknown>): ChecklistRow {
  const items = fillChecklistItemsFromObservacoes(
    {
      local_correto: (raw.local_correto as string | null | undefined) ?? null,
      dados_corretos: (raw.dados_corretos as string | null | undefined) ?? null,
      sinalizacao_correta: (raw.sinalizacao_correta as string | null | undefined) ?? null,
      mangueira_status: (raw.mangueira_status as string | null | undefined) ?? null,
      bico_difusor_status: (raw.bico_difusor_status as string | null | undefined) ?? null,
      alca_gatilho_status: (raw.alca_gatilho_status as string | null | undefined) ?? null,
      medidor_pressao_status: (raw.medidor_pressao_status as string | null | undefined) ?? null,
      cilindro_status: (raw.cilindro_status as string | null | undefined) ?? null,
    },
    raw.observacoes as string | null | undefined,
  );

  return {
    id: String(raw.id ?? ""),
    extintor_id: String(raw.extintor_id ?? ""),
    data_conferencia: String(raw.data_conferencia ?? ""),
    conferente: String(raw.conferente ?? ""),
    local_correto: items.local_correto ?? null,
    dados_corretos: items.dados_corretos ?? null,
    sinalizacao_correta: items.sinalizacao_correta ?? null,
    mangueira_status: items.mangueira_status ?? null,
    bico_difusor_status: items.bico_difusor_status ?? null,
    alca_gatilho_status: items.alca_gatilho_status ?? null,
    medidor_pressao_status: items.medidor_pressao_status ?? null,
    cilindro_status: items.cilindro_status ?? null,
    status_lacre: raw.status_lacre === false ? false : true,
    status_manometro: raw.status_manometro === false ? false : true,
    observacoes: (raw.observacoes as string | null | undefined) ?? null,
    created_at: String(raw.created_at ?? ""),
  };
}

function rowToExportItem(
  raw: Record<string, unknown>,
  extintorById: Map<string, { codigo: string; setor: string; local_detalhado: string }>,
): ExtintorChecklistExportItem {
  const embedded = pickRelation<{ codigo?: string; setor?: string; local_detalhado?: string }>(
    raw.extintores,
  );
  const extintorId = String(raw.extintor_id ?? "");
  const cached = extintorById.get(extintorId);

  return {
    codigo: embedded?.codigo ?? cached?.codigo ?? "",
    setor: embedded?.setor ?? cached?.setor ?? "",
    local_detalhado: embedded?.local_detalhado ?? cached?.local_detalhado ?? "",
    checklist: normalizeChecklistRow(raw),
  };
}

/**
 * Carrega todo o histórico de checklists de extintores para exportação,
 * com fallbacks de colunas e enriquecimento de registros legados.
 */
export async function fetchChecklistsExtintoresForExport(
  supabase: SupabaseClient,
  extintorById: Map<string, { codigo: string; setor: string; local_detalhado: string }>,
): Promise<{ items: ExtintorChecklistExportItem[]; error: string | null }> {
  let lastError: string | null = null;

  for (const select of CHECKLIST_SELECT_ATTEMPTS) {
    const { data, error } = await fetchAllPages<Record<string, unknown>>((from, to) =>
      supabase
        .from("checklists")
        .select(select)
        .order("data_conferencia", { ascending: false })
        .range(from, to) as unknown as Promise<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>,
    );

    if (error) {
      lastError = error;
      continue;
    }

    return {
      items: data.map((row) => rowToExportItem(row, extintorById)),
      error: null,
    };
  }

  // Sem embed: busca mínima e resolve extintor pelo mapa em memória
  const minimalSelects = [
    "id,extintor_id,data_conferencia,conferente,status_lacre,status_manometro,observacoes,created_at",
    "id,extintor_id,data_conferencia,conferente,observacoes,created_at",
    "id,extintor_id,data_conferencia,conferente,observacoes",
  ];

  for (const select of minimalSelects) {
    const { data, error } = await fetchAllPages<Record<string, unknown>>((from, to) =>
      supabase
        .from("checklists")
        .select(select)
        .order("data_conferencia", { ascending: false })
        .range(from, to) as unknown as Promise<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>,
    );

    if (error) {
      lastError = error;
      continue;
    }

    return {
      items: data.map((row) => rowToExportItem(row, extintorById)),
      error: null,
    };
  }

  return { items: [], error: lastError ?? "Não foi possível carregar as conferências." };
}
