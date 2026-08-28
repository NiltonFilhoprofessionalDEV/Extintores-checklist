import { stripDiacritics } from "@/lib/estoque/text-canonical";

/** Normaliza espaços unicode e pontuação decimal. */
function cleanField(value: string): string {
  return stripDiacritics(
    value
      .trim()
      .replace(/₂/g, "2")
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
      .replace(/,/g, ".")
      .replace(/\s+/g, " ")
      .toLocaleUpperCase("pt-BR"),
  );
}

/** Indica texto de classe extintora (2-A 20-B:C), não carga nominal. */
function looksLikeFireClass(value: string): boolean {
  const v = cleanField(value);
  if (!v) return false;
  if (/^\d+\s*[A-Z]\s*[:.\-]/.test(v)) return true;
  if (/[AB]\s*[:.\-]|[\d][A-Z]{1,3}BC/i.test(v) && !/^\d+\s*(KG|G|L)\b/.test(v)) return true;
  return /^[\dA-Z]*BC$/i.test(v) && !/KG|L\b/.test(v);
}

/**
 * Extrai carga nominal (6 kg, 10 L) ignorando classes extintoras (2a20bc).
 * Retorna chave canônica: "6KG", "10L".
 */
export function extintorTamanhoMatchKey(value: string): string | null {
  const v = cleanField(value);
  if (!v || looksLikeFireClass(v)) return null;

  const strict = v.match(/^(\d+(?:\.\d+)?)\s*(KG|G|KILO(?:GRAMA)?S?|L|LT|LITROS?)?$/i);
  if (strict) {
    const num = normalizeNumber(strict[1]);
    const unit = normalizeUnit(strict[2] ?? inferUnit(v));
    return unit ? `${num}${unit}` : null;
  }

  const embedded = v.match(/(\d+(?:\.\d+)?)\s*(KG|G|L|LT|LITROS?)\b/i);
  if (embedded) {
    const num = normalizeNumber(embedded[1]);
    const unit = normalizeUnit(embedded[2]);
    return unit ? `${num}${unit}` : null;
  }

  const digitsOnly = v.match(/^(\d+(?:\.\d+)?)$/);
  if (digitsOnly) {
    return `${normalizeNumber(digitsOnly[1])}KG`;
  }

  return null;
}

function normalizeNumber(raw: string): string {
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n)) return raw.replace(/\.0+$/, "");
  if (Number.isInteger(n)) return String(Math.round(n));
  return String(n).replace(/\.?0+$/, "");
}

function normalizeUnit(raw: string | null): "KG" | "L" | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === "G" || u.startsWith("KILO") || u === "KG") return "KG";
  if (u === "L" || u === "LT" || u.startsWith("LITRO")) return "L";
  return null;
}

function inferUnit(value: string): string {
  return /\bL(ITRO)?S?\b/.test(value) ? "L" : "KG";
}

/** Chaves de carga nominal a partir de tamanho e, se necessário, capacidade extintora. */
export function extintorTamanhoMatchKeys(tamanho: string, capacidadeExtintora = ""): string[] {
  const keys = new Set<string>();
  for (const source of [tamanho, capacidadeExtintora]) {
    const key = extintorTamanhoMatchKey(source);
    if (key) keys.add(key);
  }
  return [...keys];
}

/**
 * Chave de família do agente extintor para compatibilidade estoque ↔ ponto.
 * Trata sinônimos: PQS ABC, PÓ QUÍMICO ABC, PQS, CO₂, etc.
 */
export function extintorTipoMatchKey(tipo: string): string {
  const t = cleanField(tipo).replace(/\s+/g, "");

  if (!t) return "";

  if (t.includes("CO2") || t === "CO") return "CO2";

  if (t.includes("AGUA")) return "AGUA";

  if (t.includes("ESPUMA")) return "ESPUMA";

  const isPqsFamily =
    t.includes("PQS") ||
    t.includes("POQUIMICO") ||
    t.includes("QUIMICO") ||
    t.includes("POLVO") ||
    t.includes("SECO");

  if (isPqsFamily) {
    if (t.includes("ABC")) return "PQSABC";
    if (t.includes("BC")) return "PQSBC";
    return "PQS";
  }

  // Inventário/importação usa só "ABC" ou "BC" (sem prefixo PQS)
  if (t === "ABC") return "PQSABC";
  if (t === "BC") return "PQSBC";

  return t;
}

/** Tipos compatíveis (PQS genérico casa com PQS ABC/BC). */
export function extintorTiposAreCompatible(tipoA: string, tipoB: string): boolean {
  const a = extintorTipoMatchKey(tipoA);
  const b = extintorTipoMatchKey(tipoB);
  if (!a || !b) return false;
  if (a === b) return true;

  const pqs = new Set(["PQS", "PQSABC", "PQSBC"]);
  if (pqs.has(a) && pqs.has(b)) {
    if (a === "PQS" || b === "PQS") return true;
    return a === b;
  }

  return false;
}

/** Cargas compatíveis (considera campos trocados no inventário). */
export function extintorTamanhosAreCompatible(
  tamanhoA: string,
  capacidadeA: string,
  tamanhoB: string,
  capacidadeB = "",
): boolean {
  const keysA = extintorTamanhoMatchKeys(tamanhoA, capacidadeA);
  const keysB = extintorTamanhoMatchKeys(tamanhoB, capacidadeB);
  if (keysA.length === 0 || keysB.length === 0) return false;
  return keysA.some((ka) => keysB.includes(ka));
}
