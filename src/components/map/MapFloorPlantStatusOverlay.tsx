"use client";

import type { FloorPlantLoadStatus } from "@/lib/map/floor-image-resolution";

export default function MapFloorPlantStatusOverlay({
  status,
  onRetry,
  showAdminConfigHint = false,
}: {
  status: FloorPlantLoadStatus;
  onRetry?: () => void;
  showAdminConfigHint?: boolean;
}) {
  if (status === "ready") return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-[#e8eaed]/40"
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-4 max-w-sm rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-center shadow-lg">
        {status === "loading" ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-6 w-6 animate-spin rounded-full border-[3px] border-slate-200 border-t-[var(--forest)]"
              aria-hidden
            />
            <p className="text-sm text-slate-600">Carregando planta…</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Não foi possível carregar a planta deste setor.
            </p>
            {onRetry && (
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={onRetry}
              >
                Tentar novamente
              </button>
            )}
            {showAdminConfigHint && (
              <p className="text-[11px] text-slate-500">
                Verifique o upload da planta em Configurações ou em Posicionar equipamentos.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
