"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <main className="mx-auto flex min-h-0 flex-1 w-full max-w-4xl items-center justify-center px-6 py-10">
        <p className="text-zinc-600">Carregando mapa...</p>
      </main>
    </div>
  ),
});

export default function MapViewDynamic() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <MapView />
    </div>
  );
}
