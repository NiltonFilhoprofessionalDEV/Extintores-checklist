import * as XLSX from "xlsx";
import { formatDateOnlyIso } from "@/lib/date/date-only";

/** Cabeçalhos exatos esperados na planilha de hidrantes (RF01 hidrantes). */
export const HIDRANTE_REQUIRED_HEADERS = [
  "Código do Local",
  "Pavimento",
  "Localização Detalhada do Hidrante",
  "Quantidade de Mangueiras",
  "Data do Último Teste Hidrostático – Mangueira 1 (M-1)",
  "Data do Último Teste Hidrostático – Mangueira 2 (M-2)",
  "Data do Último Teste Hidrostático – Mangueira 3 (M-3)",
  "Data do Último Teste Hidrostático – Mangueira 4 (M-4)",
  "Quantidade de Chaves Storz",
  "Quantidade de Esguichos",
] as const;

export type HidrantePlanilhaHeader = (typeof HIDRANTE_REQUIRED_HEADERS)[number];

export type HidranteImportRow = {
  codigo: string;
  pavimento: string | null;
  local_detalhado: string;
  quantidade_mangueiras: number | null;
  teste_hidrostatico_m1: string | null;
  teste_hidrostatico_m2: string | null;
  teste_hidrostatico_m3: string | null;
  teste_hidrostatico_m4: string | null;
  quantidade_chaves_storz: number | null;
  quantidade_esguichos: number | null;
};

type ParsedHidranteSpreadsheetResult = {
  records: HidranteImportRow[];
  missingHeaders: string[];
  /** Linhas ignoradas por falta de código do local */
  skippedSemCodigo: number;
};

const EN_DASH = "\u2013";
const HYPHEN = "-";

/**
 * Aliases: traço/en-dash, acentos via normalizeHeaderText.
 * Inclui exportação típica do Google Forms (cabeçalhos curtos; colunas extras como Carimbo de data/hora e Observação são ignoradas).
 */
const HEADER_ALIASES: Record<HidrantePlanilhaHeader, string[]> = {
  "Código do Local": [
    "Código do Local",
    "CÓDIGO",
    "CODIGO",
    "CODIGO DO LOCAL",
    "Codigo do Local",
  ],
  /** Valor gravado em `pavimento` no banco; planilhas com cabeçalho "Setor" (ex.: mesmo modelo de extintores) são aceitas. */
  Pavimento: ["Pavimento", "PAVIMENTO", "Setor", "SETOR"],
  "Localização Detalhada do Hidrante": [
    "Localização Detalhada do Hidrante",
    "Localizacao Detalhada do Hidrante",
    "LOCALIZACAO DETALHADA DO HIDRANTE",
    "LOCAL DETALHADO",
    "Local Detalhado",
  ],
  "Quantidade de Mangueiras": ["Quantidade de Mangueiras", "QUANTIDADE DE MANGUEIRAS"],
  "Data do Último Teste Hidrostático – Mangueira 1 (M-1)": [
    `Data do Último Teste Hidrostático ${EN_DASH} Mangueira 1 (M-1)`,
    `Data do Último Teste Hidrostático ${HYPHEN} Mangueira 1 (M-1)`,
    "Data do Ultimo Teste Hidrostatico Mangueira 1 (M-1)",
    "DATA DO ÚLTIMO TESTE HIDROSTÁTICO M-1",
    "Ultimo Teste Hidrostatico M1",
    "Teste Hidrostatico M-1",
  ],
  "Data do Último Teste Hidrostático – Mangueira 2 (M-2)": [
    `Data do Último Teste Hidrostático ${EN_DASH} Mangueira 2 (M-2)`,
    `Data do Último Teste Hidrostático ${HYPHEN} Mangueira 2 (M-2)`,
    "Data do Ultimo Teste Hidrostatico Mangueira 2 (M-2)",
    "DATA DO ÚLTIMO TESTE HIDROSTÁTICO M-2",
    "Ultimo Teste Hidrostatico M2",
    "Teste Hidrostatico M-2",
  ],
  "Data do Último Teste Hidrostático – Mangueira 3 (M-3)": [
    `Data do Último Teste Hidrostático ${EN_DASH} Mangueira 3 (M-3)`,
    `Data do Último Teste Hidrostático ${HYPHEN} Mangueira 3 (M-3)`,
    "Data do Ultimo Teste Hidrostatico Mangueira 3 (M-3)",
    "DATA DO ÚLTIMO TESTE HIDROSTÁTICO M-3",
    "Ultimo Teste Hidrostatico M3",
    "Teste Hidrostatico M-3",
  ],
  "Data do Último Teste Hidrostático – Mangueira 4 (M-4)": [
    `Data do Último Teste Hidrostático ${EN_DASH} Mangueira 4 (M-4)`,
    `Data do Último Teste Hidrostático ${HYPHEN} Mangueira 4 (M-4)`,
    "Data do Ultimo Teste Hidrostatico Mangueira 4 (M-4)",
    "DATA DO ÚLTIMO TESTE HIDROSTÁTICO M-4",
    "Ultimo Teste Hidrostatico M4",
    "Teste Hidrostatico M-4",
  ],
  "Quantidade de Chaves Storz": ["Quantidade de Chaves Storz", "QUANTIDADE DE CHAVES STORZ", "Chaves Storz"],
  "Quantidade de Esguichos": [
    "Quantidade de Esguichos",
    "QUANTIDADE DE ESGUICHOS",
    "QUANTIDADE DE ESGUICHO",
    "Esguichos",
  ],
};

function normalizeHeaderText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function formatDate(value: unknown): string {
  if (!value && value !== 0) return "";

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return "";
    const isoDate = new Date(Date.UTC(date.y, date.m - 1, date.d)).toISOString().slice(0, 10);
    return isoDate;
  }

  if (value instanceof Date) {
    return formatDateOnlyIso(value);
  }

  const parsedDate = new Date(String(value));
  if (Number.isNaN(parsedDate.getTime())) return "";
  return parsedDate.toISOString().slice(0, 10);
}

function parseQuantidade(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const s = String(value ?? "").trim();
  if (!s) return null;
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = Number.parseInt(m[0], 10);
  return Number.isNaN(n) ? null : n;
}

function dateOrNull(iso: string): string | null {
  const t = iso.trim();
  return t ? t : null;
}

function normalizeHidranteRecord(row: Record<HidrantePlanilhaHeader, unknown>): HidranteImportRow {
  const codigo = String(row["Código do Local"] ?? "").trim();
  const pav = String(row["Pavimento"] ?? "").trim();
  const local = String(row["Localização Detalhada do Hidrante"] ?? "").trim();

  return {
    codigo,
    pavimento: pav ? pav : null,
    local_detalhado: local,
    quantidade_mangueiras: parseQuantidade(row["Quantidade de Mangueiras"]),
    teste_hidrostatico_m1: dateOrNull(formatDate(row["Data do Último Teste Hidrostático – Mangueira 1 (M-1)"])),
    teste_hidrostatico_m2: dateOrNull(formatDate(row["Data do Último Teste Hidrostático – Mangueira 2 (M-2)"])),
    teste_hidrostatico_m3: dateOrNull(formatDate(row["Data do Último Teste Hidrostático – Mangueira 3 (M-3)"])),
    teste_hidrostatico_m4: dateOrNull(formatDate(row["Data do Último Teste Hidrostático – Mangueira 4 (M-4)"])),
    quantidade_chaves_storz: parseQuantidade(row["Quantidade de Chaves Storz"]),
    quantidade_esguichos: parseQuantidade(row["Quantidade de Esguichos"]),
  };
}

function resolveHeaders(headers: string[]) {
  const normalizedHeaderMap = new Map<string, string>();
  headers.forEach((header) => {
    normalizedHeaderMap.set(normalizeHeaderText(header), header);
  });

  const resolvedHeaderMap = new Map<HidrantePlanilhaHeader, string>();
  const missingHeaders: string[] = [];

  HIDRANTE_REQUIRED_HEADERS.forEach((requiredHeader) => {
    const aliases = HEADER_ALIASES[requiredHeader] ?? [requiredHeader];
    const foundHeader = aliases
      .map((alias) => normalizedHeaderMap.get(normalizeHeaderText(alias)))
      .find(Boolean);

    if (!foundHeader) {
      missingHeaders.push(requiredHeader);
      return;
    }

    resolvedHeaderMap.set(requiredHeader, foundHeader);
  });

  return { resolvedHeaderMap, missingHeaders };
}

export function parseHidranteSpreadsheet(file: File): Promise<ParsedHidranteSpreadsheetResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) throw new Error("Arquivo inválido.");

        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = workbook.Sheets[firstSheetName];

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
          defval: "",
          raw: true,
        });

        if (rows.length === 0) {
          resolve({ records: [], missingHeaders: [...HIDRANTE_REQUIRED_HEADERS], skippedSemCodigo: 0 });
          return;
        }

        const firstRowKeys = Object.keys(rows[0]);
        const { resolvedHeaderMap, missingHeaders } = resolveHeaders(firstRowKeys);

        if (missingHeaders.length > 0) {
          resolve({ records: [], missingHeaders, skippedSemCodigo: 0 });
          return;
        }

        let skippedSemCodigo = 0;
        const records: HidranteImportRow[] = [];

        for (const row of rows) {
          const canonicalRow = Object.fromEntries(
            HIDRANTE_REQUIRED_HEADERS.map((requiredHeader) => [
              requiredHeader,
              row[resolvedHeaderMap.get(requiredHeader) ?? ""],
            ]),
          ) as Record<HidrantePlanilhaHeader, unknown>;

          const rec = normalizeHidranteRecord(canonicalRow);
          if (!rec.codigo) {
            skippedSemCodigo += 1;
            continue;
          }
          records.push(rec);
        }

        resolve({ records, missingHeaders: [], skippedSemCodigo });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
