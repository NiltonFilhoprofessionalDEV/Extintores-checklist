import type { ChecklistItemKey } from "@/lib/checklist/types";
import { CHECKLIST_ITEM_KEYS } from "@/lib/checklist/types";
import type { HidranteItemKey } from "@/lib/checklist/hidrante-types";
import { HIDRANTE_ACTIVE_ITEM_KEYS, HIDRANTE_ITEM_LABELS } from "@/lib/checklist/hidrante-types";

export type ChecklistKind = "extintor" | "hidrante";

export type ChecklistQuestion = {
  item_key: string;
  label: string;
  active: boolean;
  sort_order: number;
};

export const DEFAULT_EXTINTOR_QUESTION_LABELS: Record<ChecklistItemKey, string> = {
  local_correto:
    "A localização do extintor está conforme o layout/mapa de distribuição e atende aos requisitos normativos aplicáveis?",
  dados_corretos:
    "As informações de identificação, rótulo e instruções de uso do extintor estão corretas, legíveis e atualizadas?",
  sinalizacao_correta:
    "A sinalização de identificação do extintor está visível, adequada e em conformidade com as normas vigentes?",
  mangueira_status:
    "A mangueira apresenta integridade física, sem rachaduras, ressecamento ou obstruções, e está em condições adequadas de uso?",
  bico_difusor_status:
    "O bico ou difusor encontra-se em perfeito estado de conservação, sem obstruções ou danos que comprometam o funcionamento?",
  alca_gatilho_status:
    "A alça de transporte, gatilho, lacre e pino de segurança estão íntegros, inviolados e em condições adequadas de operação?",
  medidor_pressao_status:
    "O manômetro apresenta leitura dentro da faixa operacional recomendada, sem sinais de falha ou avaria?",
  cilindro_status:
    "O cilindro apresenta boas condições estruturais, sem corrosão, amassados, vazamentos ou outros danos aparentes?",
};

export function defaultExtintorQuestions(): ChecklistQuestion[] {
  return CHECKLIST_ITEM_KEYS.map((key, index) => ({
    item_key: key,
    label: DEFAULT_EXTINTOR_QUESTION_LABELS[key],
    active: true,
    sort_order: index,
  }));
}

export function defaultHidranteQuestions(): ChecklistQuestion[] {
  return HIDRANTE_ACTIVE_ITEM_KEYS.map((key, index) => ({
    item_key: key,
    label: HIDRANTE_ITEM_LABELS[key as HidranteItemKey],
    active: true,
    sort_order: index,
  }));
}

export function defaultQuestionsForKind(kind: ChecklistKind): ChecklistQuestion[] {
  return kind === "extintor" ? defaultExtintorQuestions() : defaultHidranteQuestions();
}
