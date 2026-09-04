import { CHECKLIST_EXPORT_COLUMN_LABELS } from "@/lib/checklist/export-labels";
import {
  HIDRANTE_ACTIVE_ITEM_KEYS,
  HIDRANTE_ITEM_KEYS,
  HIDRANTE_ITEM_LABELS,
} from "@/lib/checklist/hidrante-types";
import { CHECKLIST_ITEM_KEYS, type ChecklistItemKey, type ChecklistValue } from "@/lib/checklist/types";
import type { ChecklistQuestion } from "@/lib/checklist/default-questions";
import {
  extrairBlocosNaoConformidadeObservacoes,
  extrairComentariosLivresConferente,
} from "@/lib/checklist/observacao-conferencia";
import {
  fillChecklistItemsFromObservacoes,
  parseChecklistValuesFromObservacoes,
} from "@/lib/checklist/parse-legacy-observacoes";
import type { ConferenciaExportStatus } from "@/lib/export/conferencia-historico";
import type { HidranteVencimentoRow } from "@/lib/hidrantes/vencimento-mangueiras";
import type { TipoEquipamento } from "@/lib/inventario/equipamento-padrao";

export type ConferenciaItem = {
  id: string;
  tipo: TipoEquipamento;
  data_conferencia: string;
  conferente: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  tipoEquip?: string;
  tamanho?: string;
  numInmetro?: string;
  capacidadeExtintora?: string;
  pavimento?: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  hidrante: HidranteVencimentoRow | null;
  checklistRaw: Record<string, unknown>;
  exportStatus: ConferenciaExportStatus;
  observacaoExibicao: string;
};

export type ConferenciaAnswerRow = {
  key: string;
  label: string;
  value: ChecklistValue | null;
  text: string;
  className: string;
  observacao: string;
};

export const STATUS_META: Record<
  ConferenciaExportStatus,
  { label: string; badge: string; accent: string; tone: "ok" | "bad" | "warn" | "mute" }
> = {
  conforme: {
    label: "Conforme",
    badge: "conf-badge conf-badge--ok",
    accent: "ok",
    tone: "ok",
  },
  alerta: {
    label: "Não conforme",
    badge: "conf-badge conf-badge--bad",
    accent: "bad",
    tone: "bad",
  },
  vencido: {
    label: "Vencido",
    badge: "conf-badge conf-badge--warn",
    accent: "warn",
    tone: "warn",
  },
  pendente: {
    label: "Pendente",
    badge: "conf-badge conf-badge--mute",
    accent: "mute",
    tone: "mute",
  },
};

const EXTINTOR_SHORT_LABELS: Record<string, string> = {
  ...CHECKLIST_EXPORT_COLUMN_LABELS,
};

const HIDRANTE_SHORT_LABELS: Record<string, string> = {
  identificacao_sinalizacao: "Identificação e sinalização",
  documentacao_acesso: "Validade dos testes hidrostáticos",
  mangueira_esguicho: "Mangueiras e acessórios",
  acesso_desobstruido: "Acesso desobstruído",
  gabinete_caixa: "Abrigo / gabinete",
  valvulas_registros: "Válvulas e registros",
  pressao_abastecimento: "Pressão e abastecimento",
  hidrante_integridade: "Integridade do hidrante",
};

export function formatDateTime(value: string): string {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  const data = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const hora = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} · ${hora}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Não informado";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatKey(key: string): string {
  return key
    .replace(/^custom_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeAnswerValue(value: unknown): ChecklistValue | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (v === "conforme") return "conforme";
  if (v === "nao_conforme" || v === "não_conforme" || v === "nao-conforme") return "nao_conforme";
  if (v === "nao_aplica" || v === "não_aplica" || v === "n/a" || v === "na") return "nao_aplica";
  return null;
}

function answerLabel(value: unknown): { text: string; className: string } {
  const normalized = normalizeAnswerValue(value);
  if (normalized === "conforme") return { text: "Conforme", className: "conf-ans conf-ans--ok" };
  if (normalized === "nao_conforme") return { text: "Não conforme", className: "conf-ans conf-ans--bad" };
  if (normalized === "nao_aplica") return { text: "N/A", className: "conf-ans conf-ans--mute" };
  return { text: "Não informado", className: "conf-ans conf-ans--mute" };
}

function configuredLabel(question: ChecklistQuestion, kind: TipoEquipamento): string {
  const known =
    kind === "extintor"
      ? EXTINTOR_SHORT_LABELS[question.item_key]
      : HIDRANTE_SHORT_LABELS[question.item_key];
  if (known) return known;
  const label = question.label.replace(/\?+$/, "").trim();
  return label.length > 64 ? `${label.slice(0, 61).trimEnd()}…` : label;
}

function parseAnswersJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function firstDefinedAnswer(...candidates: unknown[]): ChecklistValue | null {
  for (const candidate of candidates) {
    const normalized = normalizeAnswerValue(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function matchBlocoToKey(
  titulo: string,
  questions: ChecklistQuestion[],
  kind: TipoEquipamento,
): string | null {
  const t = titulo.toLowerCase().trim();
  if (!t) return null;

  for (const question of questions) {
    const label = configuredLabel(question, kind).toLowerCase();
    const rawLabel = question.label.toLowerCase();
    if (t.includes(label) || label.includes(t) || t.includes(rawLabel.slice(0, 40)) || rawLabel.includes(t)) {
      return question.item_key;
    }
  }

  if (kind === "extintor") {
    for (const key of CHECKLIST_ITEM_KEYS) {
      const short = CHECKLIST_EXPORT_COLUMN_LABELS[key].toLowerCase();
      if (t.includes(short) || short.includes(t)) return key;
    }
  } else {
    for (const key of HIDRANTE_ITEM_KEYS) {
      const short = (HIDRANTE_SHORT_LABELS[key] ?? HIDRANTE_ITEM_LABELS[key]).toLowerCase();
      if (t.includes(short.slice(0, 40)) || short.includes(t)) return key;
    }
  }
  return null;
}

function visibleQuestionsFor(item: ConferenciaItem, questions: ChecklistQuestion[]): ChecklistQuestion[] {
  if (questions.length > 0) return questions;
  const keys = item.tipo === "extintor" ? CHECKLIST_ITEM_KEYS : HIDRANTE_ACTIVE_ITEM_KEYS;
  return keys.map((key, index) => ({
    item_key: key,
    label:
      item.tipo === "extintor"
        ? CHECKLIST_EXPORT_COLUMN_LABELS[key as ChecklistItemKey]
        : HIDRANTE_ITEM_LABELS[key as keyof typeof HIDRANTE_ITEM_LABELS],
    active: true,
    sort_order: index,
  }));
}

function resolveAnswerMap(
  item: ConferenciaItem,
  questions: ChecklistQuestion[],
): Record<string, ChecklistValue | null> {
  const raw = item.checklistRaw;
  const extras = parseAnswersJson(raw.answers_json);
  const observacoes = String(raw.observacoes ?? "");
  const legacy =
    item.tipo === "extintor" ? parseChecklistValuesFromObservacoes(observacoes) : {};

  const filledColumns =
    item.tipo === "extintor"
      ? fillChecklistItemsFromObservacoes(
          {
            local_correto: (raw.local_correto as string | null) ?? null,
            dados_corretos: (raw.dados_corretos as string | null) ?? null,
            sinalizacao_correta: (raw.sinalizacao_correta as string | null) ?? null,
            mangueira_status: (raw.mangueira_status as string | null) ?? null,
            bico_difusor_status: (raw.bico_difusor_status as string | null) ?? null,
            alca_gatilho_status: (raw.alca_gatilho_status as string | null) ?? null,
            medidor_pressao_status: (raw.medidor_pressao_status as string | null) ?? null,
            cilindro_status: (raw.cilindro_status as string | null) ?? null,
          },
          observacoes,
        )
      : {};

  const resolved: Record<string, ChecklistValue | null> = {};
  for (const question of questions) {
    const key = question.item_key;
    resolved[key] = firstDefinedAnswer(
      extras[key],
      raw[key],
      (filledColumns as Record<string, unknown>)[key],
      legacy[key as ChecklistItemKey],
    );
  }

  const blocos = extrairBlocosNaoConformidadeObservacoes(observacoes);
  for (const bloco of blocos) {
    const key = matchBlocoToKey(bloco.titulo, questions, item.tipo);
    if (key) resolved[key] = "nao_conforme";
  }

  const hasAnyAnswer = Object.values(resolved).some((value) => value != null);
  const shouldAssumeAnswered =
    hasAnyAnswer ||
    blocos.length > 0 ||
    item.exportStatus === "conforme" ||
    item.exportStatus === "alerta" ||
    item.exportStatus === "vencido";

  if (shouldAssumeAnswered) {
    for (const question of questions) {
      if (resolved[question.item_key] == null) {
        resolved[question.item_key] = "conforme";
      }
    }
  }

  return resolved;
}

export function localLines(item: ConferenciaItem): { local: string; pavimento: string } {
  const pavimento = (item.pavimento || item.setor || "").trim();
  const local = item.local_detalhado.trim();
  return {
    local: local || "Local não informado",
    pavimento,
  };
}

export function listarTiposNaoConformidade(
  item: ConferenciaItem,
  questions: ChecklistQuestion[],
): string[] {
  const visibleQuestions = visibleQuestionsFor(item, questions);
  const resolved = resolveAnswerMap(item, visibleQuestions);

  const tipos = visibleQuestions
    .filter((question) => resolved[question.item_key] === "nao_conforme")
    .map((question) => configuredLabel(question, item.tipo));

  if (tipos.length > 0) return tipos;

  const blocos = extrairBlocosNaoConformidadeObservacoes(String(item.checklistRaw.observacoes ?? ""));
  if (blocos.length > 0) return blocos.map((b) => b.titulo);

  if (item.exportStatus === "vencido") {
    return item.tipo === "extintor" ? ["Manutenção vencida"] : ["Teste hidrostático vencido"];
  }

  if (item.exportStatus === "alerta") return ["Não conformidade registrada"];
  return [];
}

export function getInspectionView(item: ConferenciaItem, questions: ChecklistQuestion[]) {
  const visibleQuestions = visibleQuestionsFor(item, questions);
  const resolved = resolveAnswerMap(item, visibleQuestions);
  const observacoes = String(item.checklistRaw.observacoes ?? "");
  const blocos = extrairBlocosNaoConformidadeObservacoes(observacoes);
  const usedBlocos = new Set<number>();

  const answers: ConferenciaAnswerRow[] = visibleQuestions.map((question) => {
    const value = resolved[question.item_key] ?? null;
    let observacao = "";
    if (value === "nao_conforme") {
      for (let i = 0; i < blocos.length; i++) {
        if (usedBlocos.has(i)) continue;
        const matched = matchBlocoToKey(blocos[i].titulo, [question], item.tipo);
        if (matched === question.item_key) {
          usedBlocos.add(i);
          observacao = blocos[i].descricao.trim();
          break;
        }
      }
    }
    return {
      key: question.item_key,
      label: configuredLabel(question, item.tipo) || formatKey(question.item_key),
      value,
      observacao,
      ...answerLabel(value),
    };
  });

  const naoConformidades = answers.filter((row) => row.value === "nao_conforme");

  for (let i = 0; i < blocos.length; i++) {
    if (usedBlocos.has(i)) continue;
    naoConformidades.push({
      key: `bloco-${i}`,
      label: blocos[i].titulo,
      value: "nao_conforme",
      text: "Não conforme",
      className: "conf-ans conf-ans--bad",
      observacao: blocos[i].descricao.trim(),
    });
  }

  if (naoConformidades.length === 0 && item.exportStatus === "vencido") {
    naoConformidades.push({
      key: "vencido",
      label: item.tipo === "extintor" ? "Manutenção vencida" : "Teste hidrostático vencido",
      value: "nao_conforme",
      text: "Vencido",
      className: "conf-ans conf-ans--warn",
      observacao: "",
    });
  }

  if (naoConformidades.length === 0 && item.exportStatus === "alerta") {
    naoConformidades.push({
      key: "alerta",
      label: "Não conformidade registrada",
      value: "nao_conforme",
      text: "Não conforme",
      className: "conf-ans conf-ans--bad",
      observacao: "",
    });
  }

  const comentariosLivres = extrairComentariosLivresConferente(observacoes)
    .map((itemText) => itemText.trim())
    .filter(Boolean);

  return { answers, naoConformidades, comentariosLivres };
}
