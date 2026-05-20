import { parseCalendarDateAsLocal } from "@/lib/date/date-only";

export type ChecklistValue = "conforme" | "nao_conforme" | "nao_aplica";

/** Chaves dos itens da inspeção de extintor (espelham colunas em `checklists`) */
export const CHECKLIST_ITEM_KEYS = [
  "local_correto",
  "dados_corretos",
  "sinalizacao_correta",
  "mangueira_status",
  "bico_difusor_status",
  "alca_gatilho_status",
  "medidor_pressao_status",
  "cilindro_status",
] as const;

export type ChecklistItemKey = (typeof CHECKLIST_ITEM_KEYS)[number];

export type ChecklistData = {
  conferente: string;
  local_correto: ChecklistValue | null;
  dados_corretos: ChecklistValue | null;
  sinalizacao_correta: ChecklistValue | null;
  mangueira_status: ChecklistValue | null;
  bico_difusor_status: ChecklistValue | null;
  alca_gatilho_status: ChecklistValue | null;
  medidor_pressao_status: ChecklistValue | null;
  cilindro_status: ChecklistValue | null;
  observacoes: string;
  /** Texto obrigatório quando o item correspondente está "Não conforme" */
  detalhesNaoConformidade: Partial<Record<ChecklistItemKey, string>>;
};

export const CHECKLIST_INITIAL: ChecklistData = {
  conferente: "",
  local_correto: null,
  dados_corretos: null,
  sinalizacao_correta: null,
  mangueira_status: null,
  bico_difusor_status: null,
  alca_gatilho_status: null,
  medidor_pressao_status: null,
  cilindro_status: null,
  observacoes: "",
  detalhesNaoConformidade: {},
};

/** Metadados do extintor exibidos no topo do modal de inspeção */
export type InspecaoExtintorCabecalho = {
  codigo: string;
  pavimento: string | null;
  local_detalhado: string;
  num_inmetro: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
};

export function isDataVencida(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = parseCalendarDateAsLocal(dateStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Retorna quantos dias faltam (ou há) para o vencimento do teste hidrostático.
 * A data informada é a ÚLTIMA REALIZAÇÃO do teste — a validade é de 1 ano.
 *  > 0 → ainda válido (faltam N dias)
 *  = 0 → vence hoje
 *  < 0 → vencido há N dias
 * Retorna null se a data for inválida/nula.
 */
export function diasParaVencimentoTeste(ultimaRealizacao: string | null): number | null {
  if (!ultimaRealizacao) return null;
  const ultima = parseCalendarDateAsLocal(ultimaRealizacao);
  if (!ultima) return null;

  const vencimento = new Date(ultima);
  vencimento.setFullYear(vencimento.getFullYear() + 1);
  vencimento.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((vencimento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Data de vencimento do teste (última realização + 1 ano). */
export function dataVencimentoTeste(ultimaRealizacao: string | null): Date | null {
  if (!ultimaRealizacao) return null;
  const ultima = parseCalendarDateAsLocal(ultimaRealizacao);
  if (!ultima) return null;
  const venc = new Date(ultima);
  venc.setFullYear(venc.getFullYear() + 1);
  return venc;
}

/** true somente quando última realização + 1 ano < hoje */
export function isTesteHidrostaticoVencido(ultimaRealizacao: string | null): boolean {
  const dias = diasParaVencimentoTeste(ultimaRealizacao);
  return dias !== null && dias < 0;
}

/** Junta observações gerais com descrições obrigatórias de não conformidade */
export function mergeObservacoesComNaoConformidades(data: ChecklistData): string {
  const blocos: string[] = [];
  if (data.observacoes.trim()) blocos.push(data.observacoes.trim());

  const rotulos: Record<ChecklistItemKey, string> = {
    local_correto: "Localização",
    dados_corretos: "Identificação e Rotulagem",
    sinalizacao_correta: "Sinalização",
    mangueira_status: "Mangueira",
    bico_difusor_status: "Bico/Difusor",
    alca_gatilho_status: "Componentes de Acionamento",
    medidor_pressao_status: "Indicador de Pressão",
    cilindro_status: "Cilindro",
  };

  for (const key of CHECKLIST_ITEM_KEYS) {
    if (data[key] !== "nao_conforme") continue;
    const det = (data.detalhesNaoConformidade[key] ?? "").trim();
    if (det) blocos.push(`[Não conforme — ${rotulos[key]}]\n${det}`);
  }

  return blocos.join("\n\n---\n\n") || "";
}

/** Retorna true se todos os itens obrigatórios estão respondidos e NC com texto quando aplicável */
export function isChecklistValid(d: ChecklistData): boolean {
  if (!d.conferente.trim()) return false;

  for (const key of CHECKLIST_ITEM_KEYS) {
    if (d[key] === null) return false;
    if (d[key] === "nao_conforme") {
      const det = (d.detalhesNaoConformidade[key] ?? "").trim();
      if (!det) return false;
    }
  }

  return true;
}

/** Último registro de checklist no mês indica se houve algum item não conforme */
export function checklistTemNaoConformidade(row: {
  local_correto: string | null;
  dados_corretos: string | null;
  sinalizacao_correta: string | null;
  mangueira_status: string | null;
  bico_difusor_status: string | null;
  alca_gatilho_status: string | null;
  medidor_pressao_status: string | null;
  cilindro_status: string | null;
}): boolean {
  return CHECKLIST_ITEM_KEYS.some((k) => row[k] === "nao_conforme");
}
