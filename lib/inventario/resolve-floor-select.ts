import {
  normalizeFloorText,
  type FloorMatchableItem,
  type FloorRef,
} from "@/lib/map/floor-matching";

export type FloorSelectOption = FloorRef & { id: string };

/**
 * Valor do Select de Pavimento: label exato da opção.
 * Prioridade: floor_id → texto pavimento/setor (normalizado) → texto original.
 */
export function resolveFloorSelectValue(
  floors: FloorSelectOption[],
  item: FloorMatchableItem,
): string {
  const floorId = item.floor_id?.trim();
  if (floorId) {
    const byId = floors.find((floor) => floor.id === floorId);
    if (byId) return byId.label;
  }

  const tokens = [item.pavimento, item.setor]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  for (const token of tokens) {
    const match = floors.find(
      (floor) =>
        normalizeFloorText(floor.label) === normalizeFloorText(token) ||
        normalizeFloorText(floor.key) === normalizeFloorText(token),
    );
    if (match) return match.label;
  }

  return tokens[0] ?? "";
}

/** Garante que o valor atual apareça no Select mesmo se for um registro legado. */
export function withCurrentFloorOption(
  floors: FloorSelectOption[],
  currentValue: string,
): FloorSelectOption[] {
  const value = currentValue.trim();
  if (!value) return floors;
  if (floors.some((floor) => floor.label === value)) return floors;
  return [{ id: `legacy:${value}`, key: value, label: value }, ...floors];
}

export function floorsFromLabels(labels: readonly string[]): FloorSelectOption[] {
  return labels.map((label) => ({ id: label, key: label, label }));
}
