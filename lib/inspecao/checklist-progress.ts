import type { ChecklistValue } from "@/lib/checklist/types";
import { getChecklistAnswer } from "@/lib/checklist/types";
import { getHidranteAnswer, type HidranteChecklistData } from "@/lib/checklist/hidrante-types";
import type { ChecklistData } from "@/lib/checklist/types";

export type ChecklistProgress = {
  answered: number;
  total: number;
  percent: number;
  isComplete: boolean;
};

export function computeChecklistProgress(
  data: ChecklistData,
  fieldKeys: string[],
): ChecklistProgress {
  const total = fieldKeys.length;
  let answered = 0;
  for (const key of fieldKeys) {
    if (getChecklistAnswer(data, key) !== null) answered += 1;
  }
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
  return { answered, total, percent, isComplete: total > 0 && answered === total };
}

export function computeHidranteChecklistProgress(
  data: HidranteChecklistData,
  fieldKeys: string[],
): ChecklistProgress {
  const total = fieldKeys.length;
  let answered = 0;
  for (const key of fieldKeys) {
    if (getHidranteAnswer(data, key) !== null) answered += 1;
  }
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
  return { answered, total, percent, isComplete: total > 0 && answered === total };
}

export function hasMeaningfulChecklistAnswers(
  data: ChecklistData | HidranteChecklistData,
  fieldKeys: string[],
  getAnswer: (key: string) => ChecklistValue | null,
): boolean {
  for (const key of fieldKeys) {
    if (getAnswer(key) !== null) return true;
  }
  if ("observacoes" in data && data.observacoes.trim()) return true;
  if (data.detalhesNaoConformidade && Object.values(data.detalhesNaoConformidade).some((v) => v?.trim())) {
    return true;
  }
  return false;
}
