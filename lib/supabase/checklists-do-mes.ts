import type { SupabaseClient } from "@supabase/supabase-js";

/** Linhas de `checklists` filtradas pelo mês (campos usados na inspeção / NC). */
export type ChecklistExtintorMesRow = {
  extintor_id: string;
  data_conferencia: string;
  local_correto: string | null;
  dados_corretos: string | null;
  sinalizacao_correta: string | null;
  mangueira_status: string | null;
  bico_difusor_status: string | null;
  alca_gatilho_status: string | null;
  medidor_pressao_status: string | null;
  cilindro_status: string | null;
  /** Respostas (nativas + custom); essencial para manter NC em vermelho no mapa. */
  answers_json: Record<string, string | null> | null;
};

/** Linhas de `checklists_hidrantes` filtradas pelo mês. */
export type ChecklistHidranteMesRow = {
  hidrante_id: string;
  data_conferencia: string;
  acesso_desobstruido: string | null;
  identificacao_sinalizacao: string | null;
  mangueira_esguicho: string | null;
  valvulas_registros: string | null;
  pressao_abastecimento: string | null;
  gabinete_caixa: string | null;
  hidrante_integridade: string | null;
  documentacao_acesso: string | null;
  answers_json: Record<string, string | null> | null;
};

const EXT_SELECT_FULL =
  "extintor_id,data_conferencia,local_correto,dados_corretos,sinalizacao_correta,mangueira_status,bico_difusor_status,alca_gatilho_status,medidor_pressao_status,cilindro_status,answers_json";

const EXT_SELECT_COLUMNS =
  "extintor_id,data_conferencia,local_correto,dados_corretos,sinalizacao_correta,mangueira_status,bico_difusor_status,alca_gatilho_status,medidor_pressao_status,cilindro_status";

const EXT_SELECT_JSON = "extintor_id,data_conferencia,answers_json";

const HID_SELECT_FULL =
  "hidrante_id,data_conferencia,acesso_desobstruido,identificacao_sinalizacao,mangueira_esguicho,valvulas_registros,pressao_abastecimento,gabinete_caixa,hidrante_integridade,documentacao_acesso,answers_json";

const HID_SELECT_COLUMNS =
  "hidrante_id,data_conferencia,acesso_desobstruido,identificacao_sinalizacao,mangueira_esguicho,valvulas_registros,pressao_abastecimento,gabinete_caixa,hidrante_integridade,documentacao_acesso";

const HID_SELECT_JSON = "hidrante_id,data_conferencia,answers_json";

function normalizeAnswersJson(value: unknown): Record<string, string | null> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string | null>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string | null>;
  }
  return null;
}

function padExtintorMesRow(row: Record<string, unknown>): ChecklistExtintorMesRow {
  return {
    extintor_id: String(row.extintor_id ?? ""),
    data_conferencia: String(row.data_conferencia ?? ""),
    local_correto: (row.local_correto as string | null | undefined) ?? null,
    dados_corretos: (row.dados_corretos as string | null | undefined) ?? null,
    sinalizacao_correta: (row.sinalizacao_correta as string | null | undefined) ?? null,
    mangueira_status: (row.mangueira_status as string | null | undefined) ?? null,
    bico_difusor_status: (row.bico_difusor_status as string | null | undefined) ?? null,
    alca_gatilho_status: (row.alca_gatilho_status as string | null | undefined) ?? null,
    medidor_pressao_status: (row.medidor_pressao_status as string | null | undefined) ?? null,
    cilindro_status: (row.cilindro_status as string | null | undefined) ?? null,
    answers_json: normalizeAnswersJson(row.answers_json),
  };
}

function padHidranteMesRow(row: Record<string, unknown>): ChecklistHidranteMesRow {
  return {
    hidrante_id: String(row.hidrante_id ?? ""),
    data_conferencia: String(row.data_conferencia ?? ""),
    acesso_desobstruido: (row.acesso_desobstruido as string | null | undefined) ?? null,
    identificacao_sinalizacao: (row.identificacao_sinalizacao as string | null | undefined) ?? null,
    mangueira_esguicho: (row.mangueira_esguicho as string | null | undefined) ?? null,
    valvulas_registros: (row.valvulas_registros as string | null | undefined) ?? null,
    pressao_abastecimento: (row.pressao_abastecimento as string | null | undefined) ?? null,
    gabinete_caixa: (row.gabinete_caixa as string | null | undefined) ?? null,
    hidrante_integridade: (row.hidrante_integridade as string | null | undefined) ?? null,
    documentacao_acesso: (row.documentacao_acesso as string | null | undefined) ?? null,
    answers_json: normalizeAnswersJson(row.answers_json),
  };
}

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

async function runMonthQuery(
  supabase: SupabaseClient,
  table: "checklists" | "checklists_hidrantes",
  select: string,
  startIso: string,
  endInclusiveIso: string,
  baseId?: string | null,
): Promise<QueryResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from(table)
    .select(select)
    .gte("data_conferencia", startIso)
    .lte("data_conferencia", endInclusiveIso);
  if (baseId) query = query.eq("base_id", baseId);
  return query;
}

/**
 * Checklists de extintores no intervalo do mês. Várias tentativas de `select` se o banco ainda
 * não tiver todas as colunas de inspeção (evita falha total). `ok === false` só se todas falharem.
 */
export async function fetchChecklistsExtintoresDoMes(
  supabase: SupabaseClient,
  startIso: string,
  endInclusiveIso: string,
  baseId?: string | null,
): Promise<{ ok: boolean; rows: ChecklistExtintorMesRow[] }> {
  const selects = [
    EXT_SELECT_FULL,
    EXT_SELECT_COLUMNS,
    EXT_SELECT_JSON,
    "extintor_id,data_conferencia,observacoes",
    "extintor_id,data_conferencia",
  ];

  for (const select of selects) {
    const result = await runMonthQuery(supabase, "checklists", select, startIso, endInclusiveIso, baseId);
    if (!result.error) {
      return {
        ok: true,
        rows: (result.data ?? []).map((r) => padExtintorMesRow(r as Record<string, unknown>)),
      };
    }
  }

  return { ok: false, rows: [] };
}

/** Checklists de hidrantes no mês, com fallback de colunas. */
export async function fetchChecklistsHidrantesDoMes(
  supabase: SupabaseClient,
  startIso: string,
  endInclusiveIso: string,
  baseId?: string | null,
): Promise<{ ok: boolean; rows: ChecklistHidranteMesRow[] }> {
  const selects = [
    HID_SELECT_FULL,
    HID_SELECT_COLUMNS,
    HID_SELECT_JSON,
    "hidrante_id,data_conferencia,observacoes",
    "hidrante_id,data_conferencia",
  ];

  for (const select of selects) {
    const result = await runMonthQuery(
      supabase,
      "checklists_hidrantes",
      select,
      startIso,
      endInclusiveIso,
      baseId,
    );
    if (!result.error) {
      return {
        ok: true,
        rows: (result.data ?? []).map((r) => padHidranteMesRow(r as Record<string, unknown>)),
      };
    }
  }

  return { ok: false, rows: [] };
}
