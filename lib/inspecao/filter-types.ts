export type InspecaoStatusTab = "todas" | "pendentes" | "concluidas";

export type InspecaoOrdenacao = "codigo" | "setor" | "pavimento";

export type InspecaoStatusFilter = "all" | "pendente" | "concluido" | "nao_conforme";

export type InspecaoFilters = {
  pavimento: string;
  tipo: string;
  capacidade: string;
  status: InspecaoStatusFilter;
  ordenacao: InspecaoOrdenacao;
};

export const DEFAULT_INSPECAO_FILTERS: InspecaoFilters = {
  pavimento: "",
  tipo: "",
  capacidade: "",
  status: "all",
  ordenacao: "codigo",
};

export function countActiveInspecaoFilters(filters: InspecaoFilters): number {
  let count = 0;
  if (filters.pavimento) count += 1;
  if (filters.tipo) count += 1;
  if (filters.capacidade) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.ordenacao !== "codigo") count += 1;
  return count;
}
