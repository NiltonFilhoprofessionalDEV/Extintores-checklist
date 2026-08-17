"use client";

import { useCallback } from "react";
import { useMap } from "react-leaflet";
import L, { type LatLngBoundsLiteral } from "leaflet";

type MapZoomControlsProps = {
  bounds: LatLngBoundsLiteral;
  bottomOffset?: number;
  compact?: boolean;
};

export default function MapZoomControls({ bounds, bottomOffset = 0, compact = false }: MapZoomControlsProps) {
  const map = useMap();

  const fitToScreen = useCallback(() => {
    const leafletBounds = L.latLngBounds(bounds);
    map.invalidateSize({ animate: false });
    map.fitBounds(leafletBounds, {
      paddingTopLeft: [20, 20],
      paddingBottomRight: [20, 20 + bottomOffset],
      animate: false,
    });
  }, [bounds, bottomOffset, map]);

  const zoomIn = () => {
    map.zoomIn(undefined, { animate: false });
  };

  const zoomOut = () => {
    map.zoomOut(undefined, { animate: false });
  };

  const btnClass = compact ? "map-zoom-btn map-zoom-btn--compact" : "map-zoom-btn";

  return (
    <div className="map-zoom-controls" aria-label="Controles de zoom do mapa">
      <button type="button" className={btnClass} onClick={zoomIn} aria-label="Aumentar zoom">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button type="button" className={btnClass} onClick={zoomOut} aria-label="Diminuir zoom">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
          <path strokeLinecap="round" d="M5 12h14" />
        </svg>
      </button>
      <button type="button" className={btnClass} onClick={fitToScreen} aria-label="Ajustar à tela">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4" />
        </svg>
      </button>
    </div>
  );
}
