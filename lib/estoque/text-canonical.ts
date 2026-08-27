/** Remove acentos para comparação (ÁGUA ≡ AGUA). */
export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Tipo/agente: caixa alta, sem acentos, sem espaços. */
export function canonicalExtintorTipo(value: string): string {
  return stripDiacritics(
    value
      .trim()
      .replace(/₂/g, "2")
      .replace(/\s+/g, " ")
      .toLocaleUpperCase("pt-BR"),
  ).replace(/\s+/g, "");
}

/** Carga nominal: apenas alfanumérico (6 kg ≡ 6KG). */
export function canonicalExtintorTamanho(value: string): string {
  return stripDiacritics(
    value.trim().replace(/₂/g, "2").toLocaleUpperCase("pt-BR"),
  ).replace(/[^A-Z0-9]/g, "");
}
