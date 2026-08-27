import type { ChecklistExtintorMesRow } from "@/lib/supabase/checklists-do-mes";

/**
 * Considera conferido no mês apenas checklists após `inspecao_reset_at`
 * (ex.: após substituição de equipamento no mesmo mês).
 */
export function filterChecklistsAfterInspecaoReset(
  rows: ChecklistExtintorMesRow[],
  inspecaoResetAt: string | null | undefined,
): ChecklistExtintorMesRow[] {
  if (!inspecaoResetAt) return rows;
  const resetMs = new Date(inspecaoResetAt).getTime();
  if (!Number.isFinite(resetMs)) return rows;
  return rows.filter((row) => {
    const ms = new Date(row.data_conferencia).getTime();
    return Number.isFinite(ms) && ms >= resetMs;
  });
}

export function extintorConferidoNoMes(
  extintorId: string,
  rows: ChecklistExtintorMesRow[],
  inspecaoResetAt: string | null | undefined,
): boolean {
  const filtered = filterChecklistsAfterInspecaoReset(rows, inspecaoResetAt);
  return filtered.some((row) => row.extintor_id === extintorId);
}

export function buildConferidosNoMesIds(
  rows: ChecklistExtintorMesRow[],
  inspecaoResetMap: Map<string, string | null>,
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row.extintor_id) continue;
    const resetAt = inspecaoResetMap.get(row.extintor_id);
    const valid = filterChecklistsAfterInspecaoReset([row], resetAt);
    if (valid.length > 0) ids.add(row.extintor_id);
  }
  return ids;
}
