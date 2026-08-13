/** Persistência leve do estado do mapa (setor, filtros) entre navegação no PWA. */

export type PersistedMapViewState = {
  floorKey?: string;
  mode?: "edicao" | "inspecao";
  filtroEquipe?: string;
  showExtintor?: boolean;
  showHidrante?: boolean;
};

function storageKey(baseId: string | null): string {
  return `firecheck-map-state:${baseId ?? "legacy"}`;
}

export function readMapViewState(baseId: string | null): PersistedMapViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(baseId));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedMapViewState;
  } catch {
    return null;
  }
}

export function writeMapViewState(baseId: string | null, state: PersistedMapViewState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(baseId), JSON.stringify(state));
  } catch {
    // quota / private mode
  }
}
