/** Nível de detalhe visual dos marcadores conforme zoom. */
export type MarkerLod = "dot" | "icon" | "detail";

/**
 * Converte zoom atual vs zoom de “ajuste à tela” em LOD.
 * E/H + número permanecem visíveis em todos os níveis.
 * delta < 0.75 → badge compacto; < 2 → badge médio; resto → badge + ícone.
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
