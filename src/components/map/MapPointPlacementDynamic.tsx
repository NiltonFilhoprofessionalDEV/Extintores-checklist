"use client";

import dynamic from "next/dynamic";

const MapPointPlacementEditor = dynamic(() => import("@/src/components/map/MapPointPlacementEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      Carregando editor de posicionamento…
    </div>
  ),
});

export default function MapPointPlacementDynamic() {
  return <MapPointPlacementEditor />;
}
