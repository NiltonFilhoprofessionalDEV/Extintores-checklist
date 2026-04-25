"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-10">
      <p className="text-zinc-600">Carregando mapa...</p>
    </main>
  ),
});

export default function MapViewDynamic() {
  return <MapView />;
}
