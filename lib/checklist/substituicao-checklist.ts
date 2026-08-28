import type { SupabaseClient } from "@supabase/supabase-js";
import { insertExtintorChecklist } from "@/lib/checklist/insert-checklist";
import { fetchActiveExtintorQuestionsForBase } from "@/lib/checklist/questions-server";
import { OBSERVACAO_SUBSTITUICAO_AUTO } from "@/lib/checklist/observacao-automatica";
import {
  CHECKLIST_INITIAL,
  CHECKLIST_ITEM_KEYS,
  isBuiltinChecklistItemKey,
  type ChecklistData,
} from "@/lib/checklist/types";

export function buildChecklistConformeParaSubstituicao(
  conferente: string,
  fieldKeys: string[],
): ChecklistData {
  const data: ChecklistData = {
    ...CHECKLIST_INITIAL,
    conferente,
    observacoes: OBSERVACAO_SUBSTITUICAO_AUTO,
  };

  for (const key of fieldKeys) {
    if (isBuiltinChecklistItemKey(key)) {
      data[key] = "conforme";
    } else {
      data.extraAnswers[key] = "conforme";
    }
  }

  for (const key of CHECKLIST_ITEM_KEYS) {
    data[key] = "conforme";
  }

  return data;
}

export async function insertChecklistAposSubstituicao(params: {
  supabase: SupabaseClient;
  extintorId: string;
  baseId: string;
  conferente: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const { supabase, extintorId, baseId, conferente } = params;
  const nome = conferente.trim();

  if (!nome) {
    return { ok: false, error: "Nome do conferente não encontrado para registrar a inspeção." };
  }

  const questions = await fetchActiveExtintorQuestionsForBase(supabase, baseId);
  const fieldKeys = questions.map((q) => q.item_key);
  const fieldLabels = Object.fromEntries(questions.map((q) => [q.item_key, q.label]));
  const checklistData = buildChecklistConformeParaSubstituicao(nome, fieldKeys);

  const { ok, error } = await insertExtintorChecklist(supabase, {
    extintorId,
    baseId,
    conferente: nome,
    data: checklistData,
    fieldKeys,
    fieldLabels,
  });

  if (!ok) {
    return { ok: false, error: error?.message ?? "Falha ao registrar checklist da substituição." };
  }

  return { ok: true, error: null };
}
