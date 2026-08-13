/** Nível de detalhe visual dos marcadores conforme zoom. */
export type MarkerLod = "dot" | "icon" | "detail";

/**
 * Converte zoom atual vs zoom de “ajuste à tela” em LOD.
 * delta < 0.75 → ponto compacto; < 2 → ícone; resto → ícone + código.
 */
export function markerLodFromZoom(currentZoom: number, fitZoom: number): MarkerLod {
  const delta = currentZoom - fitZoom;
  if (delta < 0.75) return "dot";
  if (delta < 2) return "icon";
  return "detail";
}

export function effectiveMarkerLod(
  itemId: string,
  baseLod: MarkerLod,
  highlightedId?: string | null,
): MarkerLod {
  if (highlightedId && itemId === highlightedId) return "detail";
  return baseLod;
}
