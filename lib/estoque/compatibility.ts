/** Configuração física de extintor usada para compatibilidade estoque ↔ ponto. */
export type ExtintorStockConfig = {
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
};

function normalizeConfigField(value: string): string {
  return value.trim().toLocaleUpperCase("pt-BR");
}

/**
 * Verifica se duas configurações são compatíveis para substituição.
 * Regra centralizada — alterar aqui se a política de compatibilidade mudar.
 */
export function extintorConfigsAreCompatible(
  expected: ExtintorStockConfig,
  candidate: ExtintorStockConfig,
): boolean {
  return (
    normalizeConfigField(expected.tipo) === normalizeConfigField(candidate.tipo) &&
    expected.tamanho.trim() === candidate.tamanho.trim() &&
    expected.capacidade_extintora.trim() === candidate.capacidade_extintora.trim()
  );
}

export function formatExtintorConfigLabel(config: ExtintorStockConfig): string {
  const tipo = config.tipo.trim();
  const tam = config.tamanho.trim();
  if (tipo && tam) return `${tipo} — ${tam}`;
  return tipo || tam || "—";
}
