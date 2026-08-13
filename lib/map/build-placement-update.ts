import { mapClickToStoredCoords } from "@/lib/map/coordinates";

export type PlacementFloor = {
  id?: string;
  label: string;
};

export type PlacementImageSize = {
  width: number;
  height: number;
};

/** Payload Supabase ao posicionar/mover equipamento no mapa. */
export function buildPlacementUpdate(
  lat: number,
  lng: number,
  floor: PlacementFloor,
  imageSize: PlacementImageSize,
) {
  const stored = mapClickToStoredCoords(lat, lng, imageSize.width, imageSize.height);
  return {
    coord_x: stored.coord_x,
    coord_y: stored.coord_y,
    coord_x_norm: stored.coord_x_norm,
    coord_y_norm: stored.coord_y_norm,
    pavimento: floor.label,
    ...(floor.id ? { floor_id: floor.id } : {}),
  };
}

export function buildPlacementClear() {
  return {
    coord_x: null,
    coord_y: null,
    coord_x_norm: null,
    coord_y_norm: null,
    floor_id: null,
    pavimento: null,
  };
}
