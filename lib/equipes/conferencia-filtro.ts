export type EquipeConferenciaId = "equipe_1" | "equipe_2" | "equipe_3" | "equipe_4";

export type EquipeConferencia = {
  id: EquipeConferenciaId;
  label: string;
  extintorMin: number;
  extintorMax: number;
  hidranteMin: number;
  hidranteMax: number;
};

export const EQUIPES_CONFERENCIA: EquipeConferencia[] = [
  { id: "equipe_1", label: "Equipe 1", extintorMin: 1, extintorMax: 40, hidranteMin: 1, hidranteMax: 16 },
  { id: "equipe_2", label: "Equipe 2", extintorMin: 41, extintorMax: 79, hidranteMin: 17, hidranteMax: 31 },
  { id: "equipe_3", label: "Equipe 3", extintorMin: 80, extintorMax: 118, hidranteMin: 33, hidranteMax: 48 },
  { id: "equipe_4", label: "Equipe 4", extintorMin: 119, extintorMax: 157, hidranteMin: 49, hidranteMax: 64 },
];

/** Extrai o número sequencial do código (ex.: "EXT-041" → 41, "H-17" → 17). */
export function parseNumeroSequencialCodigo(codigo: string): number | null {
  const match = codigo.match(/(\d+)\s*$/);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function codigoPertenceEquipe(
  codigo: string,
  equipeId: EquipeConferenciaId,
  tipo: "extintor" | "hidrante",
): boolean {
  const equipe = EQUIPES_CONFERENCIA.find((e) => e.id === equipeId);
  if (!equipe) return false;
  const numero = parseNumeroSequencialCodigo(codigo);
  if (numero == null) return false;
  if (tipo === "extintor") {
    return numero >= equipe.extintorMin && numero <= equipe.extintorMax;
  }
  return numero >= equipe.hidranteMin && numero <= equipe.hidranteMax;
}

export function filtrarPorEquipe<T extends { codigo: string }>(
  items: T[],
  equipeId: EquipeConferenciaId | "",
  tipo: "extintor" | "hidrante",
): T[] {
  if (!equipeId) return items;
  return items.filter((item) => codigoPertenceEquipe(item.codigo, equipeId, tipo));
}
