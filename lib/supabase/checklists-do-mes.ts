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
};

const EXT_SELECT_FULL =
  "extintor_id,data_conferencia,local_correto,dados_corretos,sinalizacao_correta,mangueira_status,bico_difusor_status,alca_gatilho_status,medidor_pressao_status,cilindro_status";

const HID_SELECT_FULL =
  "hidrante_id,data_conferencia,acesso_desobstruido,identificacao_sinalizacao,mangueira_esguicho,valvulas_registros,pressao_abastecimento,gabinete_caixa,hidrante_integridade,documentacao_acesso";

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
  };
}

/**
 * Checklists de extintores no intervalo do mês. Várias tentativas de `select` se o banco ainda
 * não tiver todas as colunas de inspeção (evita falha total). `ok === false` só se todas falharem.
 */
export async function fetchChecklistsExtintoresDoMes(
  supabase: SupabaseClient,
  startIso: string,
  endInclusiveIso: string,
): Promise<{ ok: boolean; rows: ChecklistExtintorMesRow[] }> {
  const q1 = await supabase
    .from("checklists")
    .select(EXT_SELECT_FULL)
    .gte("data_conferencia", startIso)
    .lte("data_conferencia", endInclusiveIso);

  if (!q1.error) {
    return {
      ok: true,
      rows: (q1.data ?? []).map((r) => padExtintorMesRow(r as Record<string, unknown>)),
    };
  }

  const q2 = await supabase
    .from("checklists")
    .select("extintor_id,data_conferencia,observacoes")
    .gte("data_conferencia", startIso)
    .lte("data_conferencia", endInclusiveIso);

  if (!q2.error) {
    return {
      ok: true,
      rows: (q2.data ?? []).map((r) => {
        const row = r as Record<string, unknown>;
        return padExtintorMesRow({
          extintor_id: row.extintor_id,
          data_conferencia: row.data_conferencia,
        });
      }),
    };
  }

  const q3 = await supabase
    .from("checklists")
    .select("extintor_id,data_conferencia")
    .gte("data_conferencia", startIso)
    .lte("data_conferencia", endInclusiveIso);

  if (!q3.error) {
    return {
      ok: true,
      rows: (q3.data ?? []).map((r) => padExtintorMesRow(r as Record<string, unknown>)),
    };
  }

  return { ok: false, rows: [] };
}

/** Checklists de hidrantes no mês, com fallback de colunas. */
export async function fetchChecklistsHidrantesDoMes(
  supabase: SupabaseClient,
  startIso: string,
  endInclusiveIso: string,
): Promise<{ ok: boolean; rows: ChecklistHidranteMesRow[] }> {
  const q1 = await supabase
    .from("checklists_hidrantes")
    .select(HID_SELECT_FULL)
    .gte("data_conferencia", startIso)
    .lte("data_conferencia", endInclusiveIso);

  if (!q1.error) {
    return {
      ok: true,
      rows: (q1.data ?? []).map((r) => padHidranteMesRow(r as Record<string, unknown>)),
    };
  }

  const q2 = await supabase
    .from("checklists_hidrantes")
    .select("hidrante_id,data_conferencia,observacoes")
    .gte("data_conferencia", startIso)
    .lte("data_conferencia", endInclusiveIso);

  if (!q2.error) {
    return {
      ok: true,
      rows: (q2.data ?? []).map((r) => {
        const row = r as Record<string, unknown>;
        return padHidranteMesRow({
          hidrante_id: row.hidrante_id,
          data_conferencia: row.data_conferencia,
        });
      }),
    };
  }

  const q3 = await supabase
    .from("checklists_hidrantes")
    .select("hidrante_id,data_conferencia")
    .gte("data_conferencia", startIso)
    .lte("data_conferencia", endInclusiveIso);

  if (!q3.error) {
    return {
      ok: true,
      rows: (q3.data ?? []).map((r) => padHidranteMesRow(r as Record<string, unknown>)),
    };
  }

  return { ok: false, rows: [] };
}
