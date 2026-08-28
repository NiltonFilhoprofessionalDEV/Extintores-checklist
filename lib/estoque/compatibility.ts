import {
  extintorTamanhosAreCompatible,
  extintorTiposAreCompatible,
} from "@/lib/estoque/match-keys";
import { canonicalExtintorTamanho, canonicalExtintorTipo } from "@/lib/estoque/text-canonical";

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
 * Verifica se estoque e ponto são compatíveis para substituição.
 * Compara tipo de agente e carga nominal (com sinônimos e campos trocados).
 */
export function extintorConfigsAreCompatible(
  expected: ExtintorStockConfig,
  candidate: ExtintorStockConfig,
): boolean {
  if (!extintorTiposAreCompatible(expected.tipo, candidate.tipo)) {
    return false;
  }

  if (
    extintorTamanhosAreCompatible(
      expected.tamanho,
      expected.capacidade_extintora,
      candidate.tamanho,
      candidate.capacidade_extintora,
    )
  ) {
    return true;
  }

  // Fallback: comparação legada (strings canônicas diretas)
  return (
    canonicalExtintorTipo(expected.tipo) === canonicalExtintorTipo(candidate.tipo) &&
    canonicalExtintorTamanho(expected.tamanho) === canonicalExtintorTamanho(candidate.tamanho)
  );
}

export function formatExtintorConfigLabel(config: ExtintorStockConfig): string {
  const tipo = config.tipo.trim();
  const tam = config.tamanho.trim();
  if (tipo && tam) return `${tipo} — ${tam}`;
  return tipo || tam || "—";
}
