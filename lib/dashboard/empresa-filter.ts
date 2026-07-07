export type EmpresaTab = "santa_genoveva" | "teca" | "todos";

const TECA_LABEL = "TECA";

/** Extintor/hidrante pertence à TECA quando o setor/pavimento é exatamente "TECA". */
export function pertenceTeca(setorOuPavimento: string | null | undefined): boolean {
  return (setorOuPavimento ?? "").trim().toLocaleUpperCase("pt-BR") === TECA_LABEL;
}

/**
 * Filtra itens conforme a empresa selecionada no dashboard.
 * - "todos": retorna tudo
 * - "teca": apenas itens da TECA
 * - "santa_genoveva": tudo que não é TECA
 */
export function filtrarPorEmpresa<T>(
  items: T[],
  tab: EmpresaTab,
  getCampo: (item: T) => string | null | undefined,
): T[] {
  if (tab === "todos") return items;
  if (tab === "teca") return items.filter((item) => pertenceTeca(getCampo(item)));
  return items.filter((item) => !pertenceTeca(getCampo(item)));
}

export const EMPRESA_TABS: { id: EmpresaTab; label: string }[] = [
  { id: "santa_genoveva", label: "Aeroporto Santa Genoveva" },
  { id: "teca", label: "TECA" },
  { id: "todos", label: "Todos" },
];
