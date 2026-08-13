/**
 * Associação equipamento ↔ setor/mapa (base_floors).
 * Prioridade: floor_id (FK). Fallback legado: texto pavimento/setor (estrito).
 */

export type FloorRef = {
  id?: string;
  key: string;
  label: string;
};

export function normalizeFloorText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function floorTextMatches(token: string, floor: FloorRef): boolean {
  const normalized = normalizeFloorText(token);
  if (!normalized) return false;
  return normalized === normalizeFloorText(floor.label) || normalized === normalizeFloorText(floor.key);
}

export type FloorMatchableItem = {
  floor_id?: string | null;
  pavimento?: string | null;
  setor?: string | null;
};

/**
 * Determina se o item pertence ao mapa/setor selecionado.
 * - Com floor_id: só coincide se o id do mapa é o mesmo (nunca “vaza” para outro mapa).
 * - Legado: tokens de pavimento/setor; vazio NÃO casa com todos os mapas.
 */
export function itemMatchesFloor(item: FloorMatchableItem, floor: FloorRef): boolean {
  const floorId = item.floor_id?.trim();
  if (floorId) {
    return floor.id ? floorId === floor.id : false;
  }

  const tokens = [item.pavimento, item.setor]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (tokens.length === 0) return false;

  return tokens.some((token) => floorTextMatches(token, floor));
}

/** Marcadores de emergência (sem setor cadastral). */
export function marcadorMatchesFloor(
  marcador: { floor_id?: string | null; pavimento?: string | null },
  floor: FloorRef,
): boolean {
  const floorId = marcador.floor_id?.trim();
  if (floorId) {
    return floor.id ? floorId === floor.id : false;
  }

  const pav = marcador.pavimento?.trim();
  if (!pav) return false;
  return floorTextMatches(pav, floor);
}
