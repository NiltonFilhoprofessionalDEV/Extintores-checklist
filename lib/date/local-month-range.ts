/**
 * Intervalo do mês civil no fuso local do navegador, para filtrar `timestamptz` no Supabase.
 * Usa `.gte(startIso).lte(endInclusiveIso)` para incluir conferências no último dia à noite
 * (evita o bug de `.lt(primeiro_instante_do_próximo_mês)` com `toISOString()`, que cortava
 * o fim do mês em fusos como o do Brasil).
 */
export function getLocalCalendarMonthUtcIsoRange(reference: Date = new Date()) {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const endInclusive = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { startIso: start.toISOString(), endInclusiveIso: endInclusive.toISOString() };
}

/** `timestamptz` ISO dentro do intervalo inclusive (mesmo mês civil local dos extremos). */
export function isIsoDateWithinInclusiveRange(
  iso: string | null,
  startIso: string,
  endInclusiveIso: string,
): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= new Date(startIso).getTime() && t <= new Date(endInclusiveIso).getTime();
}
