"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageOverlay } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
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
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const candidates = useMemo(
    () => buildFloorImageCandidates(imagePath, imagePathPreview, preferWebp, floorKey),
    [imagePath, imagePathPreview, preferWebp, floorKey, retryKey],
  );

  const candidatesKey = candidates.join("\n");
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const generationRef = useRef(0);

  const adoptUrl = useCallback((index: number, url: string) => {
    setCandidateIndex(index);
    setResolvedUrl(url);
    onStatusChangeRef.current?.("ready");
  }, []);

  const tryCandidateFrom = useCallback(
    (startIndex: number, generation: number) => {
      const tryAt = (index: number) => {
        if (generation !== generationRef.current) return;

        if (index >= candidates.length) {
          setResolvedUrl("");
          onStatusChangeRef.current?.("error");
          return;
        }

        onStatusChangeRef.current?.("loading");
        const url = candidates[index];
        const probe = new Image();
        let timedOut = false;

        const timeoutId = globalThis.setTimeout(() => {
          timedOut = true;
          tryAt(index + 1);
        }, PLANT_LOAD_TIMEOUT_MS);

        probe.onload = () => {
          if (generation !== generationRef.current || timedOut) return;
          globalThis.clearTimeout(timeoutId);
          adoptUrl(index, url);
        };

        probe.onerror = () => {
          if (generation !== generationRef.current) return;
          globalThis.clearTimeout(timeoutId);
          tryAt(index + 1);
        };

        probe.src = url;
      };

      tryAt(startIndex);
    },
    [adoptUrl, candidates],
  );

  useEffect(() => {
    const generation = ++generationRef.current;
    setResolvedUrl("");
    setCandidateIndex(0);

    if (!candidates.length) {
      onStatusChangeRef.current?.("error");
      return;
    }

    tryCandidateFrom(0, generation);

    return () => {
      generationRef.current += 1;
    };
  }, [candidatesKey, retryKey, tryCandidateFrom, candidates.length]);

  const handleOverlayError = useCallback(() => {
    tryCandidateFrom(candidateIndex + 1, generationRef.current);
  }, [candidateIndex, tryCandidateFrom]);

  if (!resolvedUrl) return null;

  return (
    <ImageOverlay
      key={resolvedUrl}
      url={resolvedUrl}
      bounds={bounds}
      className="map-plant-overlay"
      eventHandlers={{ error: handleOverlayError }}
    />
  );
}
