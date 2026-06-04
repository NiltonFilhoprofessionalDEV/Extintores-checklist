import { CHECKLIST_ITEM_KEYS, type ChecklistItemKey, type ChecklistValue } from "./types";

/** Prefixos gravados em `observacoes` quando o banco ainda não tinha colunas dedicadas. */
export const LEGACY_PREFIXES: { key: ChecklistItemKey; prefixes: string[] }[] = [
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

/** Trecho gerado automaticamente ao salvar (eco legado ou bloco de NC já refletido nas colunas). */
function isTrechoObservacaoAutomatica(trecho: string): boolean {
  const t = trecho.trim();
  if (!t) return true;
  if (t.startsWith("[Não conforme")) return true;

  for (const { prefixes } of LEGACY_PREFIXES) {
    for (const prefix of prefixes) {
      if (!t.includes(prefix)) continue;
      const valor = t.slice(t.indexOf(prefix) + prefix.length).trim().toLowerCase();
      if (
        valor === "conforme" ||
        valor === "nao_aplica" ||
        valor === "nao_conforme" ||
        valor === "nao conforme" ||
        valor === "não conforme" ||
        valor === "não se aplica"
      ) {
        return true;
      }
    }
  }

  if (/^[^:]+:\s*(conforme|nao_conforme|nao_aplica)\s*$/i.test(t)) return true;
  if (/^[^:]+:\s*não\s*conforme\s*\.?\s*$/i.test(t)) return true;
  if (/^[^:]+:\s*nao\s*conforme\s*\.?\s*$/i.test(t)) return true;
  if (/descrição informada:/i.test(t)) return true;

  return false;
}

/**
 * Texto livre do conferente em `observacoes`, sem eco legado "item: conforme" nem blocos [Não conforme — …].
 * Usado para status Conforme vs Atenção na listagem e no Excel.
 */
export function extrairObservacaoUsuarioLivre(observacoes: string | null | undefined): string {
  if (!observacoes?.trim()) return "";

  let texto = observacoes.replace(
    /\[Não conforme —[\s\S]*?(?=\n\n---\n\n|\s*\|\s*|$)/g,
    "",
  );

  const partes = texto
    .split(/\n\n---\n\n|\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const livres = partes.filter((p) => !isTrechoObservacaoAutomatica(p));
  return livres.join(" — ").trim();
}

/**
 * Fallback quando o banco não tem colunas do checklist: grava só NC em `observacoes`,
 * sem repetir itens conformes (evita poluir a listagem).
 */
export function buildObservacoesLegadoApenasNaoConformidades(
  observacoesBase: string,
  valores: Partial<Record<ChecklistItemKey, ChecklistValue | null>>,
): string {
  const partes: string[] = [];
  if (observacoesBase.trim()) partes.push(observacoesBase.trim());

  for (const { key, prefixes } of LEGACY_PREFIXES) {
    if (valores[key] !== "nao_conforme") continue;
    partes.push(`${prefixes[0]} nao_conforme`);
  }

  return partes.join(" | ");
}
