/**
 * Formato canônico de capacidade extintora: apenas letras e números.
 * Ex.: "2-A 20-B:C", "2-A:20-B:C" e "2a20bc" → "2A20BC"
 */
export function canonicalCapacidadeExtintora(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("pt-BR")
    .replace(/₂/g, "2")
    .replace(/[^A-Z0-9]/g, "");
}
