import { formatDateOnlyIso, parseCalendarDateAsLocal } from "@/lib/date/date-only";

export const SETORES_FALLBACK = [
  "SUBSOLO",
  "TÉRREO",
  "PAVIMENTO 1",
  "GALERIA TÉCNICA",
  "PAVIMENTO TÉCNICO",
  "TECA",
  "TPS 1",
  "SCI",
  "GUARITAS/CENTRAL DE RESÍDUOS",
] as const;

export const TIPOS_EXTINTOR = ["ÁGUA", "PQS ABC", "PQS BC", "ESPUMA MECÂNICA", "CO2"] as const;

export const TAMANHOS_POR_TIPO: Record<string, string[]> = {
  ÁGUA: ["10 L"],
  "PQS ABC": ["4 kg", "6 kg", "8 kg", "9 kg", "12 kg", "20 kg", "30 kg", "50 kg"],
  "PQS BC": ["4 kg", "6 kg", "8 kg", "9 kg", "12 kg", "20 kg", "30 kg", "50 kg"],
  "ESPUMA MECÂNICA": ["10 L", "50 L"],
  CO2: ["4 kg", "6 kg", "10 kg", "20 kg", "25 kg", "30 kg", "50 kg"],
};

export const MANGUEIRA_OPCOES = [0, 1, 2, 3, 4] as const;

export type ExtintorFormData = {
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
  num_cilindro: string | null;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  pavimento: string | null;
};

export type HidranteFormData = {
  codigo: string;
  pavimento: string;
  local_detalhado: string;
  quantidade_mangueiras: string;
  teste_hidrostatico_m1: string;
  teste_hidrostatico_m2: string;
  teste_hidrostatico_m3: string;
  teste_hidrostatico_m4: string;
  quantidade_chaves_storz: string;
  quantidade_esguichos: string;
};

export const HIDRANTE_TESTE_M_CAMPOS: {
  key: keyof Pick<
    HidranteFormData,
    "teste_hidrostatico_m1" | "teste_hidrostatico_m2" | "teste_hidrostatico_m3" | "teste_hidrostatico_m4"
  >;
  label: string;
}[] = [
  { key: "teste_hidrostatico_m1", label: "Mangueira 1 (M-1)" },
  { key: "teste_hidrostatico_m2", label: "Mangueira 2 (M-2)" },
  { key: "teste_hidrostatico_m3", label: "Mangueira 3 (M-3)" },
  { key: "teste_hidrostatico_m4", label: "Mangueira 4 (M-4)" },
];

export const EMPTY_EXTINTOR_FORM: ExtintorFormData = {
  codigo: "",
  setor: "",
  local_detalhado: "",
  num_inmetro: "",
  num_cilindro: "",
  tipo: "",
  tamanho: "",
  capacidade_extintora: "",
  manutencao_2_nivel: "",
  manutencao_3_nivel: "",
  pavimento: "",
};

export const EMPTY_HIDRANTE_FORM: HidranteFormData = {
  codigo: "",
  pavimento: "",
  local_detalhado: "",
  quantidade_mangueiras: "",
  teste_hidrostatico_m1: "",
  teste_hidrostatico_m2: "",
  teste_hidrostatico_m3: "",
  teste_hidrostatico_m4: "",
  quantidade_chaves_storz: "",
  quantidade_esguichos: "",
};

const LOCALE_PT_BR = "pt-BR";

export function toUppercaseLabel(value: string): string {
  return value.trim().toLocaleUpperCase(LOCALE_PT_BR);
}

export function parseQuantidadeMangueiras(value: string): number {
  if (value.trim() === "") return 0;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(4, n);
}

export function clampQuantidadeMangueirasString(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return "0";
  return String(Math.min(4, n));
}

export function parseOptionalIntField(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = parseCalendarDateAsLocal(value);
  return date ? formatDateOnlyIso(date) : value.slice(0, 10);
}

export function buildHidranteSavePayload(form: HidranteFormData) {
  const qtd = parseQuantidadeMangueiras(form.quantidade_mangueiras);
  return {
    codigo: form.codigo.trim(),
    pavimento: form.pavimento.trim() || null,
    local_detalhado: form.local_detalhado.trim(),
    quantidade_mangueiras: qtd,
    teste_hidrostatico_m1: qtd >= 1 ? form.teste_hidrostatico_m1.trim() || null : null,
    teste_hidrostatico_m2: qtd >= 2 ? form.teste_hidrostatico_m2.trim() || null : null,
    teste_hidrostatico_m3: qtd >= 3 ? form.teste_hidrostatico_m3.trim() || null : null,
    teste_hidrostatico_m4: qtd >= 4 ? form.teste_hidrostatico_m4.trim() || null : null,
    quantidade_chaves_storz: parseOptionalIntField(form.quantidade_chaves_storz),
    quantidade_esguichos: parseOptionalIntField(form.quantidade_esguichos),
  };
}

export function validateExtintorForm(form: ExtintorFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.codigo.trim()) errors.codigo = "Este campo é obrigatório.";
  if (!form.num_inmetro.trim()) errors.num_inmetro = "Este campo é obrigatório.";
  if (!form.setor.trim()) errors.setor = "Este campo é obrigatório.";
  if (!form.local_detalhado.trim()) errors.local_detalhado = "Este campo é obrigatório.";
  if (!form.tipo.trim()) errors.tipo = "Este campo é obrigatório.";
  if (!form.tamanho.trim()) errors.tamanho = "Este campo é obrigatório.";
  if (!form.capacidade_extintora.trim()) errors.capacidade_extintora = "Este campo é obrigatório.";
  return errors;
}

export function validateHidranteForm(form: HidranteFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.codigo.trim()) errors.codigo = "Este campo é obrigatório.";
  if (!form.local_detalhado.trim()) errors.local_detalhado = "Este campo é obrigatório.";
  if (form.quantidade_mangueiras.trim() === "") {
    errors.quantidade_mangueiras = "Este campo é obrigatório.";
  }
  return errors;
}
