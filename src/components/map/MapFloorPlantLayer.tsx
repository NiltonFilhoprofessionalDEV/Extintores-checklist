"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import L, { type LatLngBoundsExpression, type LatLngBoundsLiteral } from "leaflet";
import {
  buildFloorImageCandidates,
  type FloorPlantLoadStatus,
} from "@/lib/map/floor-image-resolution";

const PLANT_LOAD_TIMEOUT_MS = 12000;

export default function MapFloorPlantLayer({
  imagePath,
  imagePathPreview,
  floorKey,
  bounds,
  preferWebp = true,
  retryKey = 0,
  onStatusChange,
}: {
  imagePath: string | null | undefined;
  imagePathPreview?: string | null;
  floorKey?: string | null;
  bounds: LatLngBoundsExpression;
  preferWebp?: boolean;
  retryKey?: number;
  onStatusChange?: (status: FloorPlantLoadStatus) => void;
}) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const candidates = useMemo(
    () => buildFloorImageCandidates(imagePath, imagePathPreview, preferWebp, floorKey),
    [imagePath, imagePathPreview, preferWebp, floorKey, retryKey],
  );

  const candidatesKey = candidates.join("\n");
  const boundsLiteral = bounds as LatLngBoundsLiteral;

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const report = (status: FloorPlantLoadStatus) => {
      if (!cancelled) onStatusChangeRef.current?.(status);
    };

    const removeOverlay = () => {
      const layer = overlayRef.current;
      if (!layer) return;
      layer.off();
      map.removeLayer(layer);
      overlayRef.current = null;
    };

    const tryLoadAt = (index: number) => {
      if (cancelled) return;

      if (index >= candidates.length) {
        removeOverlay();
        report("error");
        return;
      }

      const url = candidates[index];
      report("loading");
      removeOverlay();

      const leafletBounds = L.latLngBounds(boundsLiteral);
      const overlay = L.imageOverlay(url, leafletBounds, {
        className: "map-plant-overlay",
        interactive: false,
      });

      let settled = false;

      const finish = (ok: boolean) => {
        if (cancelled || settled) return;
        settled = true;
        if (timeoutId !== undefined) clearTimeout(timeoutId);

        if (!ok) {
          overlay.off();
          if (map.hasLayer(overlay)) map.removeLayer(overlay);
          tryLoadAt(index + 1);
          return;
        }

        overlayRef.current = overlay;
        report("ready");

        map.invalidateSize({ animate: false });
        requestAnimationFrame(() => {
          if (!cancelled) map.invalidateSize({ animate: false });
        });
      };

      overlay.on("error", () => finish(false));
      overlay.addTo(map);

      const img = overlay.getElement() as HTMLImageElement | null;
      if (img) {
        if (img.complete && img.naturalWidth > 0) {
          finish(true);
        } else {
          img.addEventListener("load", () => finish(true), { once: true });
          img.addEventListener("error", () => finish(false), { once: true });
        }
      } else {
        overlay.once("load", () => finish(true));
      }

      timeoutId = setTimeout(() => finish(false), PLANT_LOAD_TIMEOUT_MS);
    };

    tryLoadAt(0);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      removeOverlay();
    };
  }, [map, boundsLiteral, candidatesKey, retryKey]);

  useEffect(() => {
    const layer = overlayRef.current;
    if (!layer) return;
    layer.setBounds(L.latLngBounds(boundsLiteral));
  }, [boundsLiteral]);

  return null;
}
