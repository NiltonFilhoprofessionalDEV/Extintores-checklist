/** Texto gravado em checklists gerados automaticamente na substituição de equipamento. */
export const OBSERVACAO_SUBSTITUICAO_AUTO =
  "Inspeção registrada automaticamente na substituição do equipamento (todos os itens conforme).";

/** Identifica observações de inspeção automática na substituição (não são NC nem comentário livre). */
export function isObservacaoSubstituicaoAutomatica(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  if (t === OBSERVACAO_SUBSTITUICAO_AUTO) return true;
  return /inspe[cç][aã]o registrada automaticamente na substitui[cç][aã]o do equipamento/i.test(t);
}
