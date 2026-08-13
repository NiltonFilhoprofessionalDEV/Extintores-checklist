/**
 * Coordenadas de equipamentos no mapa (CRS.Simple / imagem estática).
 * Referência: largura e altura originais da planta (base_floors.image_width / image_height).
 * Posições normalizadas ficam entre 0 e 1 relativas à planta.
 */

export type MapCoordinateFields = {
  coord_x?: number | null;
  coord_y?: number | null;
  coord_x_norm?: number | null;
  coord_y_norm?: number | null;
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function hasStoredMapPosition(item: MapCoordinateFields): boolean {
  if (item.coord_x_norm != null && item.coord_y_norm != null) {
    const xn = Number(item.coord_x_norm);
    const yn = Number(item.coord_y_norm);
    if (Number.isFinite(xn) && Number.isFinite(yn)) return true;
  }
  if (item.coord_x == null || item.coord_y == null) return false;
  const x = Number(item.coord_x);
  const y = Number(item.coord_y);
  return Number.isFinite(x) && Number.isFinite(y);
}

/** Converte posição armazenada em pixels no sistema da planta (x = lng, y = lat). */
export function resolveMapPixelPosition(
  item: MapCoordinateFields,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } | null {
  const width = imageWidth > 0 ? imageWidth : 1;
  const height = imageHeight > 0 ? imageHeight : 1;

  if (item.coord_x_norm != null && item.coord_y_norm != null) {
    const xn = Number(item.coord_x_norm);
    const yn = Number(item.coord_y_norm);
    if (Number.isFinite(xn) && Number.isFinite(yn)) {
      return {
        x: clamp01(xn) * width,
        y: clamp01(yn) * height,
      };
    }
  }

  if (!hasStoredMapPosition(item)) return null;

  const x = Number(item.coord_x);
  const y = Number(item.coord_y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y };
}

/** Posição Leaflet: [lat, lng] = [y, x]. */
export function resolveLeafletPosition(
  item: MapCoordinateFields,
  imageWidth: number,
  imageHeight: number,
): [number, number] | null {
  const pos = resolveMapPixelPosition(item, imageWidth, imageHeight);
  if (!pos) return null;
  return [pos.y, pos.x];
}

export type StoredMapCoords = {
  coord_x: number;
  coord_y: number;
  coord_x_norm: number;
  coord_y_norm: number;
};

/** Clique no mapa (lat/lng Leaflet) → coordenadas persistidas. */
export function mapClickToStoredCoords(
  lat: number,
  lng: number,
  imageWidth: number,
  imageHeight: number,
): StoredMapCoords {
  const width = imageWidth > 0 ? imageWidth : 1;
  const height = imageHeight > 0 ? imageHeight : 1;
  const x = lng;
  const y = lat;
  return {
    coord_x: x,
    coord_y: y,
    coord_x_norm: clamp01(x / width),
    coord_y_norm: clamp01(y / height),
  };
}
