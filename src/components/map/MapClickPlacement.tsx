"use client";

import { useMapEvents } from "react-leaflet";

export default function MapClickPlacement({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}
