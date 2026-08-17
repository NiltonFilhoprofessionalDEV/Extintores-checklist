"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

type MapSearchFocusProps = {
  position: [number, number] | null;
};

/** Centraliza a planta no equipamento localizado pela busca, sem abrir detalhes. */
export default function MapSearchFocus({ position }: MapSearchFocusProps) {
  const map = useMap();
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!position) {
      lastKeyRef.current = "";
      return;
    }
    const key = `${position[0].toFixed(2)},${position[1].toFixed(2)}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    map.panTo(position, { animate: false });
  }, [map, position]);

  return null;
}
