"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

type MapSearchFocusProps = {
  position: [number, number] | null;
  requestId: number;
  plantReady: boolean;
};

/**
 * Após a planta do setor estar pronta, centraliza o equipamento escolhido na busca.
 * Não executa setView enquanto o mapa novo ainda carrega.
 */
export default function MapSearchFocus({ position, requestId, plantReady }: MapSearchFocusProps) {
  const map = useMap();
  const lastRequestRef = useRef(0);

  useEffect(() => {
    if (!position || requestId === 0 || !plantReady) return;
    if (lastRequestRef.current === requestId) return;

    const timer = globalThis.setTimeout(() => {
      lastRequestRef.current = requestId;
      map.invalidateSize({ animate: false });
      const current = map.getZoom();
      const maxZoom = map.getMaxZoom();
      const comfort = Math.min(maxZoom, current + 1.35);
      map.setView(L.latLng(position[0], position[1]), comfort, { animate: false });
    }, 380);

    return () => globalThis.clearTimeout(timer);
  }, [map, plantReady, position, requestId]);

  return null;
}
