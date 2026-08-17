"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { markerLodFromZoom, type MarkerLod } from "@/lib/map/marker-lod";

type MapViewportSyncProps = {
  onLodChange: (lod: MarkerLod) => void;
  onFitZoomChange?: (fitZoom: number) => void;
  enableDoubleTapZoom?: boolean;
};

/**
 * Sincroniza LOD dos marcadores com o zoom e opcional double-tap no mobile.
 */
export default function MapViewportSync({
  onLodChange,
  onFitZoomChange,
  enableDoubleTapZoom = false,
}: MapViewportSyncProps) {
  const map = useMap();
  const fitZoomRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    const onZoomEnd = () => {
      if (fitZoomRef.current == null) {
        fitZoomRef.current = map.getZoom();
        onFitZoomChange?.(fitZoomRef.current);
      }
      const current = map.getZoom();
      const fit = fitZoomRef.current ?? current;
      onLodChange(markerLodFromZoom(current, fit));
    };

    map.on("zoomend", onZoomEnd);

    const id = globalThis.setTimeout(onZoomEnd, 400);

    return () => {
      globalThis.clearTimeout(id);
      map.off("zoomend", onZoomEnd);
    };
  }, [map, onFitZoomChange, onLodChange]);

  useMapEvents({
    click() {
      if (!enableDoubleTapZoom) return;
      const now = Date.now();
      if (now - lastTapRef.current < 320) {
        const next = Math.min(map.getMaxZoom(), map.getZoom() + 1);
        map.setZoom(next, { animate: false });
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
    },
  });

  return null;
}
