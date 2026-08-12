import * as XLSX from "xlsx";
import { formatDateOnlyIso } from "@/lib/date/date-only";

/** Cabeçalhos oficiais da planilha de importação (template + validação). */
const REQUIRED_HEADERS = [
  "Código",
  "Pavimento",
  "Local Detalhado",
  "Número Inmetro",
  "Nº do Cilindro",
  "Tipo",
  "Tamanho",
  "Capacidade Extintora",
  "Vencimento Manutenção 2º Nível",
  "Vencimento Manutenção 3º Nível",
] as const;

/**
 * Colunas que planilhas antigas podem omitir sem falhar a importação.
 * Ainda entram no template oficial e são gravadas quando presentes.
 */
const OPTIONAL_HEADERS = ["Nº do Cilindro"] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];
type OptionalHeader = (typeof OPTIONAL_HEADERS)[number];
type KnownHeader = RequiredHeader;

type ParsedSpreadsheetResult = {
  records: ExtintorImportRecord[];
  missingHeaders: string[];
};

export type ExtintorImportRecord = {
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
  num_cilindro: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
};

const HEADER_ALIASES: Record<KnownHeader, string[]> = {
  Código: ["Código", "CODIGO"],
  /** Cabeçalho oficial Pavimento; planilhas antigas com Setor continuam válidas (grava em `setor` no banco). */
  Pavimento: ["Pavimento", "PAVIMENTO", "Setor", "SETOR"],
  "Local Detalhado": ["Local Detalhado"],
  "Número Inmetro": ["Número Inmetro", "Número do Inmetro", "NUMERO INMETRO", "NUMERO DO INMETRO"],
  "Nº do Cilindro": [
    "Nº do Cilindro",
    "Nº do cilindro",
    "Numero do Cilindro",
    "Número do Cilindro",
    "NUMERO DO CILINDRO",
    "Nº Cilindro",
    "Num Cilindro",
  ],
  Tipo: ["Tipo"],
  Tamanho: ["Tamanho"],
  "Capacidade Extintora": ["Capacidade Extintora"],
  "Vencimento Manutenção 2º Nível": [
    "Vencimento Manutenção 2º Nível",
    "Vencimento Manutenção Nível 2",
    "Vencimento Manutenção Nivel 2",
  ],
  "Vencimento Manutenção 3º Nível": [
    "Vencimento Manutenção 3º Nível",
    "Vencimento Manutenção Nível 3",
    "Vencimento Manutenção Nivel 3",
  ],
};

function isOptionalHeader(header: KnownHeader): header is OptionalHeader {
  return (OPTIONAL_HEADERS as readonly string[]).includes(header);
}

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
  if (!value) return "";

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return "";
    const isoDate = new Date(Date.UTC(date.y, date.m - 1, date.d))
      .toISOString()
      .slice(0, 10);
    return isoDate;
  }

  if (value instanceof Date) {
    return formatDateOnlyIso(value);
  }

  const parsedDate = new Date(String(value));
  if (Number.isNaN(parsedDate.getTime())) return "";
  return parsedDate.toISOString().slice(0, 10);
}

function dateOrNull(iso: string): string | null {
  const trimmed = iso.trim();
  return trimmed ? trimmed : null;
}

function normalizeRecord(row: Record<KnownHeader, unknown>): ExtintorImportRecord {
  return {
    codigo: String(row["Código"] ?? "").trim(),
    setor: String(row["Pavimento"] ?? "").trim(),
    local_detalhado: String(row["Local Detalhado"] ?? "").trim(),
    num_inmetro: String(row["Número Inmetro"] ?? "").trim(),
    num_cilindro: String(row["Nº do Cilindro"] ?? "").trim(),
    tipo: String(row["Tipo"] ?? "").trim(),
    tamanho: String(row["Tamanho"] ?? "").trim(),
    capacidade_extintora: String(row["Capacidade Extintora"] ?? "").trim(),
    manutencao_2_nivel: dateOrNull(formatDate(row["Vencimento Manutenção 2º Nível"])),
    manutencao_3_nivel: dateOrNull(formatDate(row["Vencimento Manutenção 3º Nível"])),
  };
}

function resolveHeaders(headers: string[]) {
  const normalizedHeaderMap = new Map<string, string>();
  headers.forEach((header) => {
    normalizedHeaderMap.set(normalizeHeaderText(header), header);
  });

  const resolvedHeaderMap = new Map<KnownHeader, string>();
  const missingHeaders: string[] = [];

  REQUIRED_HEADERS.forEach((requiredHeader) => {
    const aliases = HEADER_ALIASES[requiredHeader] ?? [requiredHeader];
    const foundHeader = aliases
      .map((alias) => normalizedHeaderMap.get(normalizeHeaderText(alias)))
      .find(Boolean);

    if (!foundHeader) {
      if (isOptionalHeader(requiredHeader)) return;
      missingHeaders.push(requiredHeader);
      return;
    }

    resolvedHeaderMap.set(requiredHeader, foundHeader);
  });

  return { resolvedHeaderMap, missingHeaders };
}

export function parseSpreadsheet(file: File): Promise<ParsedSpreadsheetResult> {
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
          resolve({
            records: [],
            missingHeaders: REQUIRED_HEADERS.filter((h) => !isOptionalHeader(h)),
          });
          return;
        }

        const firstRowKeys = Object.keys(rows[0]);
        const { resolvedHeaderMap, missingHeaders } = resolveHeaders(firstRowKeys);

        if (missingHeaders.length > 0) {
          resolve({ records: [], missingHeaders });
          return;
        }

        const records = rows.map((row) => {
          const canonicalRow = Object.fromEntries(
            REQUIRED_HEADERS.map((requiredHeader) => [
              requiredHeader,
              row[resolvedHeaderMap.get(requiredHeader) ?? ""] ?? "",
            ]),
          ) as Record<KnownHeader, unknown>;

          return normalizeRecord(canonicalRow);
        });

        resolve({ records, missingHeaders: [] });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Gera e baixa a planilha-modelo (.xlsx) com os cabeçalhos oficiais de extintores. */
export function downloadExtintorImportTemplate(): void {
  const headers = [...REQUIRED_HEADERS];
  const exampleRow = headers.map(() => "");
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  ws["!cols"] = headers.map((header) => ({
    wch: Math.max(14, Math.min(36, header.length + 4)),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Extintores");
  XLSX.writeFile(wb, "modelo_importacao_extintores.xlsx");
}

export { REQUIRED_HEADERS };
