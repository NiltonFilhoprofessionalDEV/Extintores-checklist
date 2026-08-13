"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOverlay } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import {
  buildFloorImageCandidates,
  type FloorPlantLoadStatus,
} from "@/lib/map/floor-image-resolution";

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
  const candidates = useMemo(
    () => buildFloorImageCandidates(imagePath, imagePathPreview, preferWebp, floorKey),
    [imagePath, imagePathPreview, preferWebp, floorKey, retryKey],
  );

  const [resolvedUrl, setResolvedUrl] = useState("");
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    setResolvedUrl("");

    if (!candidates.length) {
      onStatusChange?.("error");
      return;
    }

    onStatusChange?.("loading");

    const tryCandidate = (index: number) => {
      if (generation !== generationRef.current) return;
      if (index >= candidates.length) {
        setResolvedUrl("");
        onStatusChange?.("error");
        return;
      }

      const url = candidates[index];
      const probe = new Image();
      probe.onload = () => {
        if (generation !== generationRef.current) return;
        setResolvedUrl(url);
        onStatusChange?.("ready");
      };
      probe.onerror = () => {
        if (generation !== generationRef.current) return;
        tryCandidate(index + 1);
      };
      probe.src = url;
    };

    tryCandidate(0);

    return () => {
      generationRef.current += 1;
    };
  }, [candidates, onStatusChange]);

  if (!resolvedUrl) return null;

  return (
    <ImageOverlay
      key={resolvedUrl}
      url={resolvedUrl}
      bounds={bounds}
      className="map-plant-overlay"
    />
  );
}
