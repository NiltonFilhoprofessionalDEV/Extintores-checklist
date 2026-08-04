import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHECKLIST_ITEM_KEYS,
  buildChecklistAnswersJson,
  getChecklistAnswer,
  isBuiltinChecklistItemKey,
  mergeObservacoesComNaoConformidades,
  type ChecklistData,
} from "@/lib/checklist/types";
import { buildObservacoesLegadoApenasNaoConformidades } from "@/lib/checklist/parse-legacy-observacoes";
import {
  HIDRANTE_ITEM_KEYS,
  buildHidranteAnswersJson,
  getHidranteAnswer,
  isBuiltinHidranteItemKey,
  mergeHidranteObservacoes,
  type HidranteChecklistData,
} from "@/lib/checklist/hidrante-types";

type InsertError = { message?: string } | null;

function isSchemaColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("schema cache") || lower.includes("column") || lower.includes("42703");
}

function isAnswersJsonError(message: string | undefined): boolean {
  return Boolean(message?.includes("answers_json"));
}

export function resolveChecklistFieldKeys(fieldKeys: string[]): string[] {
  return fieldKeys.length > 0 ? fieldKeys : [...CHECKLIST_ITEM_KEYS];
}

export function resolveHidranteFieldKeys(fieldKeys: string[]): string[] {
  return fieldKeys.length > 0 ? fieldKeys : [...HIDRANTE_ITEM_KEYS];
}

export function buildExtintorChecklistPayload(params: {
  extintorId: string;
  baseId: string | null;
  conferente: string;
  data: ChecklistData;
  fieldKeys: string[];
  fieldLabels: Record<string, string>;
}): Record<string, unknown> {
  const { extintorId, baseId, conferente, data, fieldKeys, fieldLabels } = params;
  const keys = resolveChecklistFieldKeys(fieldKeys);
  const observacoesFinal = mergeObservacoesComNaoConformidades(data, fieldLabels);
  const answersJson = buildChecklistAnswersJson(data, keys);

  const payload: Record<string, unknown> = {
    extintor_id: extintorId,
    data_conferencia: new Date().toISOString(),
    conferente,
    status_lacre: getChecklistAnswer(data, "alca_gatilho_status") === "conforme",
    status_manometro: getChecklistAnswer(data, "medidor_pressao_status") === "conforme",
    answers_json: answersJson,
    observacoes: observacoesFinal || null,
  };

  if (baseId) payload.base_id = baseId;

  for (const key of CHECKLIST_ITEM_KEYS) {
    if (isBuiltinChecklistItemKey(key)) {
      payload[key] = getChecklistAnswer(data, key);
    }
  }

  return payload;
}

export function buildHidranteChecklistPayload(params: {
  hidranteId: string;
  baseId: string | null;
  conferente: string;
  data: HidranteChecklistData;
  fieldKeys: string[];
  fieldLabels: Record<string, string>;
}): Record<string, unknown> {
  const { hidranteId, baseId, conferente, data, fieldKeys, fieldLabels } = params;
  const keys = resolveHidranteFieldKeys(fieldKeys);
  const observacoesFinal = mergeHidranteObservacoes(data, fieldLabels);
  const answersJson = buildHidranteAnswersJson(data, keys);

  const payload: Record<string, unknown> = {
    hidrante_id: hidranteId,
    data_conferencia: new Date().toISOString(),
    conferente,
    answers_json: answersJson,
    observacoes: observacoesFinal || null,
  };

  if (baseId) payload.base_id = baseId;

  for (const key of HIDRANTE_ITEM_KEYS) {
    if (isBuiltinHidranteItemKey(key)) {
      payload[key] = getHidranteAnswer(data, key);
    }
  }

  return payload;
}

async function insertWithFallback(
  supabase: SupabaseClient,
  table: "checklists" | "checklists_hidrantes",
  payload: Record<string, unknown>,
  legadoPayload: Record<string, unknown>,
): Promise<InsertError> {
  const first = await supabase.from(table).insert(payload);
  if (!first.error) return null;

  let error = first.error;

  if (isAnswersJsonError(error.message) && "answers_json" in payload) {
    const { answers_json: _ignored, ...withoutJson } = payload;
    const retry = await supabase.from(table).insert(withoutJson);
    if (!retry.error) return null;
    error = retry.error;
  }

  if (isSchemaColumnError(error.message)) {
    const compact: Record<string, unknown> = {
      ...("extintor_id" in payload
        ? { extintor_id: payload.extintor_id }
        : { hidrante_id: payload.hidrante_id }),
      data_conferencia: payload.data_conferencia,
      conferente: payload.conferente,
      observacoes: payload.observacoes ?? null,
    };
    if (payload.base_id) compact.base_id = payload.base_id;
    if (payload.answers_json !== undefined) compact.answers_json = payload.answers_json;

    const retryCompact = await supabase.from(table).insert(compact);
    if (!retryCompact.error) return null;
    error = retryCompact.error;
  }

  if (isAnswersJsonError(error.message) || isSchemaColumnError(error.message)) {
    const retryLegado = await supabase.from(table).insert(legadoPayload);
    if (!retryLegado.error) return null;
    error = retryLegado.error;
  }

  return error;
}

export async function insertExtintorChecklist(
  supabase: SupabaseClient,
  params: {
    extintorId: string;
    baseId: string | null;
    conferente: string;
    data: ChecklistData;
    fieldKeys: string[];
    fieldLabels: Record<string, string>;
  },
): Promise<{ ok: boolean; error: InsertError; payload: Record<string, unknown> }> {
  const payload = buildExtintorChecklistPayload(params);
  const observacoesFinal = String(payload.observacoes ?? "");
  const legadoPayload: Record<string, unknown> = {
    extintor_id: params.extintorId,
    data_conferencia: payload.data_conferencia,
    conferente: params.conferente,
    status_lacre: payload.status_lacre,
    status_manometro: payload.status_manometro,
    observacoes:
      buildObservacoesLegadoApenasNaoConformidades(observacoesFinal, params.data) || null,
  };
  if (params.baseId) legadoPayload.base_id = params.baseId;

  const error = await insertWithFallback(supabase, "checklists", payload, legadoPayload);
  return { ok: !error, error, payload };
}

export async function insertHidranteChecklist(
  supabase: SupabaseClient,
  params: {
    hidranteId: string;
    baseId: string | null;
    conferente: string;
    data: HidranteChecklistData;
    fieldKeys: string[];
    fieldLabels: Record<string, string>;
  },
): Promise<{ ok: boolean; error: InsertError; payload: Record<string, unknown> }> {
  const payload = buildHidranteChecklistPayload(params);
  const legadoPayload: Record<string, unknown> = {
    hidrante_id: params.hidranteId,
    data_conferencia: payload.data_conferencia,
    conferente: params.conferente,
    observacoes: payload.observacoes ?? null,
  };
  if (params.baseId) legadoPayload.base_id = params.baseId;

  const error = await insertWithFallback(supabase, "checklists_hidrantes", payload, legadoPayload);
  return { ok: !error, error, payload };
}
