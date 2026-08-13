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

  const btnClass = compact
    ? "map-zoom-btn map-zoom-btn--compact"
    : "map-zoom-btn";

  return (
    <div className="map-zoom-controls" aria-label="Controles de zoom do mapa">
      <button type="button" className={btnClass} onClick={zoomIn} aria-label="Aumentar zoom">
        +
      </button>
      <button type="button" className={btnClass} onClick={zoomOut} aria-label="Diminuir zoom">
        −
      </button>
      <button type="button" className={btnClass} onClick={fitToScreen} aria-label="Ajustar à tela">
        ⊡
      </button>
    </div>
  );
}
