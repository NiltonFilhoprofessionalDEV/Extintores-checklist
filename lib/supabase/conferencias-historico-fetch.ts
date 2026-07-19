import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/supabase/fetch-all";

const EXTINTOR_EMBED_FULL =
  "extintores(codigo,setor,local_detalhado,tipo,tamanho,manutencao_2_nivel,manutencao_3_nivel)";
const EXTINTOR_EMBED_BASIC = "extintores(codigo,setor,local_detalhado,tipo,tamanho)";

const CHECKLIST_EXT_ATTEMPTS = [
  `id,extintor_id,data_conferencia,conferente,observacoes,local_correto,dados_corretos,sinalizacao_correta,mangueira_status,bico_difusor_status,alca_gatilho_status,medidor_pressao_status,cilindro_status,${EXTINTOR_EMBED_FULL}`,
  `id,extintor_id,data_conferencia,conferente,observacoes,local_correto,dados_corretos,sinalizacao_correta,mangueira_status,bico_difusor_status,alca_gatilho_status,medidor_pressao_status,cilindro_status,${EXTINTOR_EMBED_BASIC}`,
  `id,extintor_id,data_conferencia,conferente,observacoes,${EXTINTOR_EMBED_BASIC}`,
  `id,extintor_id,data_conferencia,conferente,observacoes`,
];

const HIDRANTE_EMBED_FULL =
  "hidrantes(codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos)";
const HIDRANTE_EMBED_BASIC = "hidrantes(codigo,pavimento,local_detalhado)";

const CHECKLIST_HID_ATTEMPTS = [
  `id,hidrante_id,data_conferencia,conferente,observacoes,acesso_desobstruido,identificacao_sinalizacao,mangueira_esguicho,valvulas_registros,pressao_abastecimento,gabinete_caixa,hidrante_integridade,documentacao_acesso,${HIDRANTE_EMBED_FULL}`,
  `id,hidrante_id,data_conferencia,conferente,observacoes,acesso_desobstruido,identificacao_sinalizacao,mangueira_esguicho,valvulas_registros,pressao_abastecimento,gabinete_caixa,hidrante_integridade,documentacao_acesso,${HIDRANTE_EMBED_BASIC}`,
  `id,hidrante_id,data_conferencia,conferente,observacoes,${HIDRANTE_EMBED_BASIC}`,
  `id,hidrante_id,data_conferencia,conferente,observacoes`,
];

export type ExtintorLookupRow = {
  id: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  tipo: string;
  tamanho: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
};

export type HidranteLookupRow = {
  id: string;
  codigo: string;
  pavimento: string | null;
  local_detalhado: string;
  quantidade_mangueiras: number | null;
  teste_hidrostatico_m1: string | null;
  teste_hidrostatico_m2: string | null;
  teste_hidrostatico_m3: string | null;
  teste_hidrostatico_m4: string | null;
  quantidade_chaves_storz: number | null;
  quantidade_esguichos: number | null;
};

function pickRelation<T extends Record<string, unknown>>(rel: unknown): T | null {
  if (!rel || typeof rel !== "object") return null;
  if (Array.isArray(rel)) return (rel[0] as T | undefined) ?? null;
  return rel as T;
}

async function fetchTableWithAttempts(
  supabase: SupabaseClient,
  table: "checklists" | "checklists_hidrantes",
  attempts: string[],
  baseId?: string | null,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  let lastError: string | null = null;

  for (const select of attempts) {
    const { data, error } = await fetchAllPages<Record<string, unknown>>((from, to) => {
      let query = supabase
        .from(table)
        .select(select)
        .order("data_conferencia", { ascending: false })
        .range(from, to);
      if (baseId) query = query.eq("base_id", baseId);
      return query as unknown as Promise<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>;
    });

    if (error) {
      lastError = error;
      continue;
    }

    return { rows: data, error: null };
  }

  return { rows: [], error: lastError ?? `Não foi possível carregar ${table}.` };
}

async function loadExtintorLookup(
  supabase: SupabaseClient,
  baseId?: string | null,
): Promise<Map<string, ExtintorLookupRow>> {
  const map = new Map<string, ExtintorLookupRow>();
  const selects = [
    "id,codigo,setor,local_detalhado,tipo,tamanho,manutencao_2_nivel,manutencao_3_nivel",
    "id,codigo,setor,local_detalhado,tipo,tamanho,manutencao_2_nivel",
    "id,codigo,setor,local_detalhado,tipo,tamanho",
    "id,codigo,setor,local_detalhado",
  ];

  for (const select of selects) {
    const { data, error } = await fetchAllPages<ExtintorLookupRow>((from, to) => {
      let query = supabase
        .from("extintores")
        .select(select)
        .order("codigo", { ascending: true })
        .range(from, to);
      if (baseId) query = query.eq("base_id", baseId);
      return query as unknown as Promise<{
        data: ExtintorLookupRow[] | null;
        error: { message: string } | null;
      }>;
    });

    if (error) continue;

    for (const row of data) {
      map.set(row.id, {
        id: row.id,
        codigo: row.codigo ?? "",
        setor: row.setor ?? "",
        local_detalhado: row.local_detalhado ?? "",
        tipo: row.tipo ?? "",
        tamanho: row.tamanho ?? "",
        manutencao_2_nivel: row.manutencao_2_nivel ?? null,
        manutencao_3_nivel: row.manutencao_3_nivel ?? null,
      });
    }
    return map;
  }

  return map;
}

async function loadHidranteLookup(
  supabase: SupabaseClient,
  baseId?: string | null,
): Promise<Map<string, HidranteLookupRow>> {
  const map = new Map<string, HidranteLookupRow>();
  const selects = [
    "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos",
    "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4",
    "id,codigo,pavimento,local_detalhado",
  ];

  for (const select of selects) {
    const { data, error } = await fetchAllPages<HidranteLookupRow>((from, to) => {
      let query = supabase
        .from("hidrantes")
        .select(select)
        .order("codigo", { ascending: true })
        .range(from, to);
      if (baseId) query = query.eq("base_id", baseId);
      return query as unknown as Promise<{
        data: HidranteLookupRow[] | null;
        error: { message: string } | null;
      }>;
    });

    if (error) continue;

    for (const row of data) {
      map.set(row.id, {
        id: row.id,
        codigo: row.codigo ?? "",
        pavimento: row.pavimento ?? null,
        local_detalhado: row.local_detalhado ?? "",
        quantidade_mangueiras: row.quantidade_mangueiras ?? null,
        teste_hidrostatico_m1: row.teste_hidrostatico_m1 ?? null,
        teste_hidrostatico_m2: row.teste_hidrostatico_m2 ?? null,
        teste_hidrostatico_m3: row.teste_hidrostatico_m3 ?? null,
        teste_hidrostatico_m4: row.teste_hidrostatico_m4 ?? null,
        quantidade_chaves_storz: row.quantidade_chaves_storz ?? null,
        quantidade_esguichos: row.quantidade_esguichos ?? null,
      });
    }
    return map;
  }

  return map;
}

export function resolveExtintorFromRow(
  row: Record<string, unknown>,
  lookup: Map<string, ExtintorLookupRow>,
): ExtintorLookupRow | null {
  const extintorId = String(row.extintor_id ?? "");
  const fromLookup = lookup.get(extintorId) ?? null;
  const embedded = pickRelation<ExtintorLookupRow>(row.extintores);

  if (embedded?.codigo) {
    return {
      id: extintorId || String(embedded.id ?? fromLookup?.id ?? ""),
      codigo: embedded.codigo,
      setor: embedded.setor ?? fromLookup?.setor ?? "",
      local_detalhado: embedded.local_detalhado ?? fromLookup?.local_detalhado ?? "",
      tipo: embedded.tipo ?? fromLookup?.tipo ?? "",
      tamanho: embedded.tamanho ?? fromLookup?.tamanho ?? "",
      manutencao_2_nivel: embedded.manutencao_2_nivel ?? fromLookup?.manutencao_2_nivel ?? null,
      manutencao_3_nivel: embedded.manutencao_3_nivel ?? fromLookup?.manutencao_3_nivel ?? null,
    };
  }

  return fromLookup;
}

export function resolveHidranteFromRow(
  row: Record<string, unknown>,
  lookup: Map<string, HidranteLookupRow>,
): HidranteLookupRow | null {
  const hidranteId = String(row.hidrante_id ?? "");
  const fromLookup = lookup.get(hidranteId) ?? null;
  const embedded = pickRelation<HidranteLookupRow>(row.hidrantes);

  if (embedded?.codigo) {
    return {
      id: hidranteId || String(embedded.id ?? fromLookup?.id ?? ""),
      codigo: embedded.codigo,
      pavimento: embedded.pavimento ?? fromLookup?.pavimento ?? null,
      local_detalhado: embedded.local_detalhado ?? fromLookup?.local_detalhado ?? "",
      quantidade_mangueiras: embedded.quantidade_mangueiras ?? fromLookup?.quantidade_mangueiras ?? null,
      teste_hidrostatico_m1:
        embedded.teste_hidrostatico_m1 ?? fromLookup?.teste_hidrostatico_m1 ?? null,
      teste_hidrostatico_m2:
        embedded.teste_hidrostatico_m2 ?? fromLookup?.teste_hidrostatico_m2 ?? null,
      teste_hidrostatico_m3:
        embedded.teste_hidrostatico_m3 ?? fromLookup?.teste_hidrostatico_m3 ?? null,
      teste_hidrostatico_m4:
        embedded.teste_hidrostatico_m4 ?? fromLookup?.teste_hidrostatico_m4 ?? null,
      quantidade_chaves_storz:
        embedded.quantidade_chaves_storz ?? fromLookup?.quantidade_chaves_storz ?? null,
      quantidade_esguichos: embedded.quantidade_esguichos ?? fromLookup?.quantidade_esguichos ?? null,
    };
  }

  return fromLookup;
}

export async function fetchConferenciasHistorico(
  supabase: SupabaseClient,
  baseId?: string | null,
): Promise<{
  extintorRows: Record<string, unknown>[];
  hidranteRows: Record<string, unknown>[];
  extintorLookup: Map<string, ExtintorLookupRow>;
  hidranteLookup: Map<string, HidranteLookupRow>;
  errors: string[];
}> {
  const [extintorLookup, hidranteLookup, extFetch, hidFetch] = await Promise.all([
    loadExtintorLookup(supabase, baseId),
    loadHidranteLookup(supabase, baseId),
    fetchTableWithAttempts(supabase, "checklists", CHECKLIST_EXT_ATTEMPTS, baseId),
    fetchTableWithAttempts(supabase, "checklists_hidrantes", CHECKLIST_HID_ATTEMPTS, baseId),
  ]);

  const errors: string[] = [];
  if (extFetch.error) errors.push(`Extintores: ${extFetch.error}`);
  if (hidFetch.error) errors.push(`Hidrantes: ${hidFetch.error}`);

  return {
    extintorRows: extFetch.rows,
    hidranteRows: hidFetch.rows,
    extintorLookup,
    hidranteLookup,
    errors,
  };
}
