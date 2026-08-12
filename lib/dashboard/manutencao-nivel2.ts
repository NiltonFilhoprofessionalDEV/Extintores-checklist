import { formatDateOnlyPt, parseCalendarDateAsLocal } from "@/lib/date/date-only";
import { isDataVencida } from "@/lib/checklist/types";

export type ManutencaoAlertaKey =
  | "vencidos"
  | "alerta30"
  | "alerta60"
  | "alerta90"
  | "alerta120"
  | "alerta180"
  | "alerta360";

export type ManutencaoFaixa = {
  key: ManutencaoAlertaKey;
  /** Dias no fim da faixa (não usado em vencidos). */
  maxDays: number | null;
  /** Dias no início exclusivo da faixa (após este dia). */
  afterDays: number | null;
  label: string;
  color: string;
};

/** Faixas exclusivas baseadas só na manutenção de 2º nível (anual). */
export const MANUTENCAO_FAIXAS: ManutencaoFaixa[] = [
  { key: "vencidos", maxDays: null, afterDays: null, label: "Manutenção de 2º nível vencida", color: "#dc2626" },
  { key: "alerta30", maxDays: 30, afterDays: -1, label: "Vencendo em 30 dias", color: "#f59e0b" },
  { key: "alerta60", maxDays: 60, afterDays: 30, label: "Vencendo em 60 dias", color: "#eab308" },
  { key: "alerta90", maxDays: 90, afterDays: 60, label: "Vencendo em 90 dias", color: "#84cc16" },
  { key: "alerta120", maxDays: 120, afterDays: 90, label: "Vencendo em 120 dias", color: "#22c55e" },
  { key: "alerta180", maxDays: 180, afterDays: 120, label: "Vencendo em 180 dias", color: "#14b8a6" },
  { key: "alerta360", maxDays: 360, afterDays: 180, label: "Vencendo em 360 dias", color: "#0ea5e9" },
];

export function addDaysLocal(d: Date, n: number): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfTodayLocal(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatRangePt(from: Date, to: Date): string {
  return `${formatDateOnlyPt(from)} a ${formatDateOnlyPt(to)}`;
}

/** Intervalo de datas que o card usa para contabilizar (texto para UI). */
export function faixaDateRangeLabel(key: ManutencaoAlertaKey, today: Date): string {
  if (key === "vencidos") {
    const ontem = addDaysLocal(today, -1);
    return `Até ${formatDateOnlyPt(ontem)} (antes de ${formatDateOnlyPt(today)})`;
  }
  const faixa = MANUTENCAO_FAIXAS.find((f) => f.key === key);
  if (!faixa || faixa.maxDays == null || faixa.afterDays == null) return "";
  const from = addDaysLocal(today, faixa.afterDays + 1);
  const to = addDaysLocal(today, faixa.maxDays);
  return formatRangePt(from, to);
}

export function parseNivel2Date(manutencao2: string | null | undefined): Date | null {
  const dt = parseCalendarDateAsLocal(manutencao2);
  if (!dt) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function isManutencaoNivel2Vencida(manutencao2: string | null | undefined): boolean {
  return isDataVencida(manutencao2 ?? null);
}

/**
 * Aviso de 3º nível: só quando o 2º está na faixa de alerta/vencido
 * e o 3º nível vence no mesmo ano calendário do 2º.
 */
export function nivel3VenceNoMesmoAnoQueNivel2(
  manutencao2: string | null | undefined,
  manutencao3: string | null | undefined,
): boolean {
  const d2 = parseNivel2Date(manutencao2);
  const d3 = parseNivel2Date(manutencao3);
  if (!d2 || !d3) return false;
  return d2.getFullYear() === d3.getFullYear();
}

export function diasRestantesNivel2(manutencao2: string | null | undefined, today: Date): number | null {
  const target = parseNivel2Date(manutencao2);
  if (!target) return null;
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function dataNivel2NaFaixa(
  manutencao2: string | null | undefined,
  key: ManutencaoAlertaKey,
  today: Date,
): boolean {
  if (key === "vencidos") return isManutencaoNivel2Vencida(manutencao2);

  const dt = parseNivel2Date(manutencao2);
  if (!dt) return false;
  if (isManutencaoNivel2Vencida(manutencao2)) return false;

  const faixa = MANUTENCAO_FAIXAS.find((f) => f.key === key);
  if (!faixa || faixa.maxDays == null || faixa.afterDays == null) return false;

  const after = addDaysLocal(today, faixa.afterDays);
  const until = addDaysLocal(today, faixa.maxDays);
  return dt > after && dt <= until;
}
