import { CHECKLIST_ITEM_KEYS, type ChecklistItemKey, type ChecklistValue } from "./types";

/** Prefixos gravados em `observacoes` quando o banco ainda não tinha colunas dedicadas. */
const LEGACY_PREFIXES: { key: ChecklistItemKey; prefixes: string[] }[] = [
  { key: "local_correto", prefixes: ["Local correto conforme mapa:"] },
  { key: "dados_corretos", prefixes: ["Dados do extintor corretos:"] },
  { key: "sinalizacao_correta", prefixes: ["Sinalização correta:"] },
  { key: "mangueira_status", prefixes: ["Mangueira em boas condições:"] },
  { key: "bico_difusor_status", prefixes: ["Bico/Difusor em boas condições:", "Bico ou difusor em boas condições:"] },
  {
    key: "alca_gatilho_status",
    prefixes: ["Alça/Gatilho/Lacre/Pino em boas condições:", "Alça/Gatilho/Lacre/Pino:"],
  },
  { key: "medidor_pressao_status", prefixes: ["Medidor de pressão correto:"] },
  { key: "cilindro_status", prefixes: ["Cilindro em boas condições:"] },
];

function normalizeRawValue(raw: string): ChecklistValue | null {
  const v = raw.trim().toLowerCase();
  if (v === "conforme" || v === "nao_conforme" || v === "nao_aplica") return v;
  return null;
}

/** Extrai respostas do checklist embutidas em texto de observações (formato legado). */
export function parseChecklistValuesFromObservacoes(
  observacoes: string | null | undefined,
): Partial<Record<ChecklistItemKey, ChecklistValue | null>> {
  if (!observacoes?.trim()) return {};

  const parts = observacoes.split(/\s*\|\s*/);
  const out: Partial<Record<ChecklistItemKey, ChecklistValue | null>> = {};

  for (const part of parts) {
    for (const { key, prefixes } of LEGACY_PREFIXES) {
      if (out[key] != null) continue;
      for (const prefix of prefixes) {
        if (!part.includes(prefix)) continue;
        const raw = part.slice(part.indexOf(prefix) + prefix.length).trim();
        const value = normalizeRawValue(raw);
        if (value) out[key] = value;
        break;
      }
    }
  }

  return out;
}

/** Preenche colunas de inspeção ausentes a partir de `observacoes` legado. */
export function fillChecklistItemsFromObservacoes<
  T extends Partial<Record<ChecklistItemKey, string | null>>,
>(row: T, observacoes: string | null | undefined): T {
  const parsed = parseChecklistValuesFromObservacoes(observacoes);
  const next = { ...row };

  for (const key of CHECKLIST_ITEM_KEYS) {
    if (next[key] == null || next[key] === "") {
      const fromObs = parsed[key];
      if (fromObs) next[key] = fromObs;
    }
  }

  return next;
}
