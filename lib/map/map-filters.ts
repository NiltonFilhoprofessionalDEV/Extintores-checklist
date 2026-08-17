import type { EquipeConferenciaId } from "@/lib/equipes/conferencia-filtro";

export type MapStatusFilter = "todos" | "pendentes" | "concluidos" | "nao_conformes";

export type MapLayerFilters = {
  extintor: boolean;
  hidrante: boolean;
};

export type MapFilterState = {
  layers: MapLayerFilters;
  status: MapStatusFilter;
  equipe: EquipeConferenciaId | "";
};

export const DEFAULT_MAP_FILTERS: MapFilterState = {
  layers: { extintor: true, hidrante: true },
  status: "todos",
  equipe: "",
};

export const MAP_STATUS_FILTER_OPTIONS: { id: MapStatusFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendentes", label: "Pendentes" },
  { id: "concluidos", label: "Concluídos" },
  { id: "nao_conformes", label: "Não conformes" },
];

const STATUS_VALUES = new Set<MapStatusFilter>([
  "todos",
  "pendentes",
  "concluidos",
  "nao_conformes",
]);

export function parseMapStatusFilter(value: unknown): MapStatusFilter {
  if (typeof value === "string" && STATUS_VALUES.has(value as MapStatusFilter)) {
    return value as MapStatusFilter;
  }
  return "todos";
}

export function matchesInspectionStatus(
  conferido: boolean,
  naoConforme: boolean,
  status: MapStatusFilter,
): boolean {
  switch (status) {
    case "todos":
      return true;
    case "pendentes":
      return !conferido;
    case "concluidos":
      return conferido && !naoConforme;
    case "nao_conformes":
      return naoConforme;
  }
}

export function countActiveMapFilters(state: MapFilterState): number {
  let count = 0;
  if (!state.layers.extintor || !state.layers.hidrante) count += 1;
  if (state.status !== "todos") count += 1;
  if (state.equipe) count += 1;
  return count;
}
