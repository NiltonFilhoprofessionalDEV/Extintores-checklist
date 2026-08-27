import { canonicalCapacidadeExtintora } from "@/lib/estoque/capacidade-canonical";

/** Configuração física de extintor usada para compatibilidade estoque ↔ ponto. */
export type ExtintorStockConfig = {
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
};

/** Normaliza tipo/agente (CO₂ → CO2, espaços, caixa). */
export function normalizeExtintorTipo(value: string): string {
  return value
    .trim()
    .replace(/₂/g, "2")
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("pt-BR");
}

/** Normaliza carga nominal (ex.: 6 kg). */
export function normalizeExtintorTamanho(value: string): string {
  return value
    .trim()
    .replace(/₂/g, "2")
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("pt-BR");
}

/**
 * Normaliza capacidade extintora para exibição (preserva estrutura legível).
 */
export function normalizeCapacidadeExtintora(value: string): string {
  return value
    .trim()
    .replace(/₂/g, "2")
    .replace(/[\u2010-\u2015\u2212–—−‐‑‒―]/g, "-")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("pt-BR");
}

/**
 * Verifica se duas configurações são compatíveis para substituição.
 * Capacidade extintora: compara valores (2A, 20BC) ignorando hífens, espaços e pontuação.
 */
export function extintorConfigsAreCompatible(
  expected: ExtintorStockConfig,
  candidate: ExtintorStockConfig,
): boolean {
  return (
    normalizeExtintorTipo(expected.tipo) === normalizeExtintorTipo(candidate.tipo) &&
    normalizeExtintorTamanho(expected.tamanho) === normalizeExtintorTamanho(candidate.tamanho) &&
    canonicalCapacidadeExtintora(expected.capacidade_extintora) ===
      canonicalCapacidadeExtintora(candidate.capacidade_extintora)
  );
}

export function formatExtintorConfigLabel(config: ExtintorStockConfig): string {
  const tipo = config.tipo.trim();
  const tam = config.tamanho.trim();
  if (tipo && tam) return `${tipo} — ${tam}`;
  return tipo || tam || "—";
}
