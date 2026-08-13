import { floorHasMap, resolveFloorImageUrl } from "@/lib/auth/bases";
import { getLegacyFloorImageBase } from "@/lib/map/legacy-floor-maps";

export type FloorPlantLoadStatus = "loading" | "ready" | "error";

/**
 * Caminho efetivo da planta: DB/Storage → legado public/maps por key.
 * Não depende de preview (otimização opcional).
 */
export function resolveEffectiveFloorImagePath(
  imagePath: string | null | undefined,
  floorKey?: string | null,
): string | null {
  if (floorHasMap(imagePath)) return imagePath!.trim();
  return getLegacyFloorImageBase(floorKey);
}

function pushUniqueUrl(urls: string[], seen: Set<string>, url: string) {
  if (!url || seen.has(url)) return;
  seen.add(url);
  urls.push(url);
}

/** Variantes de URL para um path lógico (webp/jpg em estáticos). */
function urlsForLogicalPath(path: string, preferWebp: boolean): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  pushUniqueUrl(out, seen, resolveFloorImageUrl(path, preferWebp));

  if (path.startsWith("/") && !/\.(webp|jpg|jpeg|png)$/i.test(path)) {
    pushUniqueUrl(out, seen, resolveFloorImageUrl(path, !preferWebp));
  }

  return out;
}

/**
 * Cadeia de URLs a tentar em ordem:
 * preview → original (DB/Storage) → legado public/maps.
 */
export function buildFloorImageCandidates(
  imagePath: string | null | undefined,
  imagePathPreview: string | null | undefined,
  preferWebp = true,
  floorKey?: string | null,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  if (imagePathPreview?.trim()) {
    for (const url of urlsForLogicalPath(imagePathPreview.trim(), preferWebp)) {
      pushUniqueUrl(urls, seen, url);
    }
  }

  const effectiveOriginal = resolveEffectiveFloorImagePath(imagePath, floorKey);
  if (effectiveOriginal) {
    for (const url of urlsForLogicalPath(effectiveOriginal, preferWebp)) {
      pushUniqueUrl(urls, seen, url);
    }
  }

  if (!floorHasMap(imagePath) && floorKey) {
    const legacyOnly = getLegacyFloorImageBase(floorKey);
    if (legacyOnly && legacyOnly !== effectiveOriginal) {
      for (const url of urlsForLogicalPath(legacyOnly, preferWebp)) {
        pushUniqueUrl(urls, seen, url);
      }
    }
  }

  return urls;
}

export function floorHasDisplayablePlant(
  imagePath: string | null | undefined,
  imagePathPreview: string | null | undefined,
  floorKey?: string | null,
): boolean {
  return buildFloorImageCandidates(imagePath, imagePathPreview, true, floorKey).length > 0;
}
