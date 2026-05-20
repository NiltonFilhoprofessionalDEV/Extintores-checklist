import type { ChecklistValue } from "@/lib/checklist/types";

export const HIDRANTE_ITEM_KEYS = [
  "acesso_desobstruido",
  "identificacao_sinalizacao",
  "mangueira_esguicho",
  "valvulas_registros",
  "pressao_abastecimento",
  "gabinete_caixa",
  "hidrante_integridade",
  "documentacao_acesso",
] as const;

export type HidranteItemKey = (typeof HIDRANTE_ITEM_KEYS)[number];

export const HIDRANTE_ACTIVE_ITEM_KEYS = [
  "identificacao_sinalizacao",
  "documentacao_acesso",
  "mangueira_esguicho",
  "acesso_desobstruido",
  "gabinete_caixa",
  "valvulas_registros",
] as const satisfies readonly HidranteItemKey[];

export const HIDRANTE_ITEM_LABELS: Record<HidranteItemKey, string> = {
  acesso_desobstruido: "O hidrante encontra-se desobstruído e com livre acesso para utilização em situação de emergência?",
  identificacao_sinalizacao:
    "Os dados de identificação, a numeração e a sinalização do hidrante estão em conformidade com o cadastro e a localização física do equipamento?",
  mangueira_esguicho:
    "A quantidade de mangueiras, chaves Storz e demais acessórios está conforme o especificado, e os equipamentos apresentam adequado estado de conservação e operacionalidade?",
  valvulas_registros:
    "A válvula de abertura do hidrante apresenta alguma avaria, vazamento, travamento ou irregularidade em seu funcionamento?",
  pressao_abastecimento: "Pressão / abastecimento",
  gabinete_caixa:
    "A estrutura do abrigo do hidrante encontra-se íntegra, sem danos estruturais, corrosão ou avarias aparentes?",
  hidrante_integridade: "Integridade geral do hidrante",
  documentacao_acesso:
    "As datas dos testes hidrostáticos das mangueiras encontram-se dentro do prazo de validade e compatíveis com os registros apresentados?",
};

export type HidranteChecklistData = {
  conferente: string;
  acesso_desobstruido: ChecklistValue | null;
  identificacao_sinalizacao: ChecklistValue | null;
  mangueira_esguicho: ChecklistValue | null;
  valvulas_registros: ChecklistValue | null;
  pressao_abastecimento: ChecklistValue | null;
  gabinete_caixa: ChecklistValue | null;
  hidrante_integridade: ChecklistValue | null;
  documentacao_acesso: ChecklistValue | null;
  observacoes: string;
  detalhesNaoConformidade: Partial<Record<HidranteItemKey, string>>;
};

export const HIDRANTE_CHECKLIST_INITIAL: HidranteChecklistData = {
  conferente: "",
  acesso_desobstruido: null,
  identificacao_sinalizacao: null,
  mangueira_esguicho: null,
  valvulas_registros: null,
  pressao_abastecimento: null,
  gabinete_caixa: null,
  hidrante_integridade: null,
  documentacao_acesso: null,
  observacoes: "",
  detalhesNaoConformidade: {},
};

export function mergeHidranteObservacoes(data: HidranteChecklistData): string {
  const blocos: string[] = [];
  if (data.observacoes.trim()) blocos.push(data.observacoes.trim());

  for (const key of HIDRANTE_ACTIVE_ITEM_KEYS) {
    if (data[key] !== "nao_conforme") continue;
    const det = (data.detalhesNaoConformidade[key] ?? "").trim();
    if (det) blocos.push(`[Não conforme — ${HIDRANTE_ITEM_LABELS[key]}]\n${det}`);
  }

  return blocos.join("\n\n---\n\n") || "";
}

export function isHidranteChecklistValid(d: HidranteChecklistData): boolean {
  if (!d.conferente.trim()) return false;
  for (const key of HIDRANTE_ACTIVE_ITEM_KEYS) {
    if (d[key] === null) return false;
    if (d[key] === "nao_conforme") {
      const det = (d.detalhesNaoConformidade[key] ?? "").trim();
      if (!det) return false;
    }
  }
  return true;
}

export function hidranteChecklistTemNaoConformidade(row: Record<string, string | null>): boolean {
  return HIDRANTE_ITEM_KEYS.some((k) => row[k] === "nao_conforme");
}
