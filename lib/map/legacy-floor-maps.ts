/**
 * Mapas legados em public/maps/* — mantidos durante a migração ao Storage.
 * Chave alinhada com base_floors.key (Santa Genoveva e bases com o mesmo seed).
 */
export type LegacyFloorMap = {
  key: string;
  label: string;
  imageBase: string;
};

export const LEGACY_FLOOR_MAPS: readonly LegacyFloorMap[] = [
  { key: "terreo", label: "Térreo", imageBase: "/maps/terreo" },
  { key: "pavimento_1", label: "Pavimento 1", imageBase: "/maps/pavimento 1" },
  { key: "galeria_tecnica", label: "Galeria Técnica", imageBase: "/maps/galeria_tecniica" },
  { key: "pavimento_tecnico", label: "Pavimento Técnico", imageBase: "/maps/pavimento_tecnico" },
  { key: "subsolo", label: "Subsolo", imageBase: "/maps/subsolo" },
  { key: "teca", label: "TECA", imageBase: "/maps/teca" },
  { key: "tps_1", label: "TPS 1", imageBase: "/maps/tps_1" },
  { key: "sci", label: "SCI", imageBase: "/maps/sci" },
  { key: "other_places", label: "Guaritas/Central de resíduos", imageBase: "/maps/other_places" },
];

const LEGACY_BY_KEY = new Map(LEGACY_FLOOR_MAPS.map((entry) => [entry.key, entry]));

export function getLegacyFloorImageBase(floorKey: string | null | undefined): string | null {
  if (!floorKey?.trim()) return null;
  const entry = LEGACY_BY_KEY.get(floorKey.trim());
  const base = entry?.imageBase?.trim() ?? "";
  return base.length > 0 ? base : null;
}
