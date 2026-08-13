"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L, { type LatLngBoundsExpression, type LatLngBoundsLiteral } from "leaflet";

export function MapFitBounds({
  bounds,
  maxZoomExtra = 32,
  bottomOffset = 0,
  initialZoomOut = 0,
  minZoomAbsolute = -18,
  boundsPad = 0.15,
}: {
  bounds: LatLngBoundsExpression;
  maxZoomExtra?: number;
  bottomOffset?: number;
  initialZoomOut?: number;
  minZoomAbsolute?: number;
  boundsPad?: number;
}) {
  const map = useMap();
  const userInteractedRef = useRef(false);
  const programmaticRef = useRef(false);

  useEffect(() => {
    userInteractedRef.current = false;
    const leafletBounds = L.latLngBounds(bounds as LatLngBoundsLiteral);

    const tryFullFit = (): boolean => {
      map.invalidateSize({ animate: false });
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return false;

      programmaticRef.current = true;
      map.setMaxBounds(leafletBounds.pad(boundsPad));
      map.options.bounceAtZoomLimits = true;
      map.fitBounds(leafletBounds, {
        paddingTopLeft: [20, 20],
        paddingBottomRight: [20, 20 + bottomOffset],
        animate: false,
      });

      const fittedZoom = map.getZoom();
      const targetZoom = fittedZoom - initialZoomOut;
      map.setMinZoom(minZoomAbsolute);
      map.setMaxZoom(fittedZoom + maxZoomExtra);

      if (initialZoomOut > 0) {
        const z = Math.max(minZoomAbsolute, targetZoom);
        map.setZoom(z, { animate: false });
      }
      programmaticRef.current = false;
      return true;
    };

    const onUserInteract = () => {
      if (programmaticRef.current) return;
      userInteractedRef.current = true;
    };

    const onContainerResize = () => {
      map.invalidateSize({ animate: false });
      if (!userInteractedRef.current) tryFullFit();
    };

    map.on("dragstart", onUserInteract);
    map.on("zoomstart", onUserInteract);

    const container = map.getContainer();
    const ro = new ResizeObserver(onContainerResize);
    ro.observe(container);

    tryFullFit();
    const id = globalThis.setTimeout(() => {
      if (!userInteractedRef.current) tryFullFit();
    }, 300);

    return () => {
      ro.disconnect();
      globalThis.clearTimeout(id);
      map.off("dragstart", onUserInteract);
      map.off("zoomstart", onUserInteract);
    };
  }, [bounds, map, maxZoomExtra, bottomOffset, initialZoomOut, minZoomAbsolute, boundsPad]);

  return null;
}

export function MapZoomStabilityGuard() {
  const map = useMap();

  useEffect(() => {
    let clamping = false;

    const clampIfBroken = () => {
      if (clamping) return;
      const zoom = map.getZoom();
      const min = map.getMinZoom();
      const max = map.getMaxZoom();
      const center = map.getCenter();
      const zoomBroken = !Number.isFinite(zoom) || zoom < min - 0.05 || zoom > max + 0.05;
      const centerBroken = !Number.isFinite(center.lat) || !Number.isFinite(center.lng);
      if (!zoomBroken && !centerBroken) return;

      clamping = true;
      try {
        const safeZoom = Number.isFinite(zoom)
          ? Math.min(max, Math.max(min, zoom))
          : Math.min(max, Math.max(min, 0));
        if (centerBroken) {
          map.setZoom(safeZoom, { animate: false });
          return;
        }
        map.setView(center, safeZoom, { animate: false });
      } catch {
        try {
          map.setZoom(min, { animate: false });
        } catch {
          // ignore
        }
      } finally {
        clamping = false;
      }
    };

    map.on("zoomend", clampIfBroken);
    map.on("moveend", clampIfBroken);

    return () => {
      map.off("zoomend", clampIfBroken);
      map.off("moveend", clampIfBroken);
    };
  }, [map]);

  return null;
}
