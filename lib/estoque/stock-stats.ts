import type { ExtintorStockConfig } from "@/lib/estoque/compatibility";
import { normalizeExtintorTipo } from "@/lib/estoque/compatibility";

export type EstoqueStatRow = {
  tipo: string;
  quantidade: number;
};

const TIPO_COLORS: Record<string, string> = {
  ÁGUA: "#0ea5e9",
  "PQS ABC": "#2563eb",
  "PQS BC": "#7c3aed",
  CO2: "#475569",
  "ESPUMA MECÂNICA": "#059669",
};

const FALLBACK_COLORS = ["#0f766e", "#d97706", "#be123c", "#6366f1", "#64748b"];

export function colorForTipo(tipo: string, index: number): string {
  const key = normalizeExtintorTipo(tipo);
  if (TIPO_COLORS[key]) return TIPO_COLORS[key];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function buildStockStatsByTipo(
  items: Array<ExtintorStockConfig & { quantidade: number }>,
): { total: number; porTipo: EstoqueStatRow[] } {
  const byTipoNorm = new Map<string, EstoqueStatRow>();
  let total = 0;

  for (const row of items) {
    const q = Math.max(0, row.quantidade);
    total += q;
    const norm = normalizeExtintorTipo(row.tipo);
    const existing = byTipoNorm.get(norm);
    if (existing) {
      existing.quantidade += q;
    } else {
      byTipoNorm.set(norm, { tipo: row.tipo.trim() || "Sem tipo", quantidade: q });
    }
  }

  const porTipo = [...byTipoNorm.values()].sort(
    (a, b) => b.quantidade - a.quantidade || a.tipo.localeCompare(b.tipo, "pt-BR"),
  );

  return { total, porTipo };
}
