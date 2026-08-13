import { hasStoredMapPosition, type MapCoordinateFields } from "@/lib/map/coordinates";
import { itemMatchesFloor, type FloorMatchableItem, type FloorRef } from "@/lib/map/floor-matching";

export type FloorEquipmentRow = FloorMatchableItem & MapCoordinateFields & {
  id: string;
  codigo: string;
};

/** Equipamento com posição neste mapa (floor_id estrito quando disponível). */
export function isPlacedOnFloor(item: FloorMatchableItem & MapCoordinateFields, floor: FloorRef): boolean {
  if (!hasStoredMapPosition(item)) return false;
  const floorId = item.floor_id?.trim();
  if (floorId && floor.id) return floorId === floor.id;
  if (floorId && !floor.id) return false;
  return itemMatchesFloor(item, floor);
}

/** Equipamento sem posição candidato a este setor/mapa. */
export function isUnplacedCandidateForFloor(
  item: FloorMatchableItem & MapCoordinateFields,
  floor: FloorRef,
): boolean {
  if (hasStoredMapPosition(item)) return false;
  return itemMatchesFloor(item, floor);
}

export function filterPlacedOnFloor<T extends FloorEquipmentRow>(items: T[], floor: FloorRef): T[] {
  return items.filter((item) => isPlacedOnFloor(item, floor));
}

export function filterUnplacedCandidates<T extends FloorEquipmentRow>(items: T[], floor: FloorRef): T[] {
  return items.filter((item) => isUnplacedCandidateForFloor(item, floor));
}
