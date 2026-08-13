/**
 * Catálogo de mapas legados — espelha lib/map/legacy-floor-maps.ts para scripts Node.
 */
import path from "node:path";

export const LEGACY_FLOOR_MAPS = [
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

export const LEGACY_BY_KEY = new Map(LEGACY_FLOOR_MAPS.map((e) => [e.key, e]));

export function normalizeFloorText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function pavimentoMatchesFloor(pavimento, floor) {
  const p = normalizeFloorText(pavimento);
  if (!p) return false;
  return p === normalizeFloorText(floor.label) || p === normalizeFloorText(floor.key);
}

export function isStorageImagePath(imagePath) {
  const p = String(imagePath ?? "").trim();
  return p.includes("/storage/v1/object/public/mapas/");
}

export function isLegacyImagePath(imagePath) {
  const p = String(imagePath ?? "").trim();
  return p.startsWith("/maps/");
}

export function legacyJpgAbsolutePath(imageBase, rootDir = process.cwd()) {
  const rel = String(imageBase).replace(/^\/maps\//, "");
  return path.join(rootDir, "public", "maps", `${rel}.jpg`);
}

export function publicMapObjectUrl(supabaseUrl, objectPath) {
  const raw = String(supabaseUrl ?? "").trim();
  const base = raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/g, "");
  if (!base) return objectPath;
  return `${base}/storage/v1/object/public/mapas/${String(objectPath).replace(/^\/+/, "")}`;
}

export function storageObjectPath(baseId, floorKey, ext) {
  return `${baseId}/${floorKey}.${ext}`;
}

export function previewObjectPath(baseId, floorKey) {
  return `${baseId}/${floorKey}_preview.webp`;
}
