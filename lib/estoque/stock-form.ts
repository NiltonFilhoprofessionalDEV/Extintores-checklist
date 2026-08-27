import { toDateInputValue, toUppercaseLabel } from "@/lib/inventario/inventory-form";

export type EstoqueFormData = {
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: string;
  manutencao_2_nivel: string;
  manutencao_3_nivel: string;
};

export const EMPTY_ESTOQUE_FORM: EstoqueFormData = {
  tipo: "",
  tamanho: "",
  capacidade_extintora: "",
  quantidade: "",
  manutencao_2_nivel: "",
  manutencao_3_nivel: "",
};

export function validateEstoqueForm(form: EstoqueFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.tipo.trim()) errors.tipo = "Este campo é obrigatório.";
  if (!form.tamanho.trim()) errors.tamanho = "Este campo é obrigatório.";
  if (!form.capacidade_extintora.trim()) errors.capacidade_extintora = "Este campo é obrigatório.";
  const q = form.quantidade.trim();
  if (!q) errors.quantidade = "Este campo é obrigatório.";
  else {
    const n = Number.parseInt(q, 10);
    if (!Number.isFinite(n) || n < 0) errors.quantidade = "Quantidade inválida.";
  }
  return errors;
}

export function normalizeEstoquePayload(form: EstoqueFormData) {
  const manut2 = form.manutencao_2_nivel.trim();
  const manut3 = form.manutencao_3_nivel.trim();
  return {
    tipo: toUppercaseLabel(form.tipo),
    tamanho: form.tamanho.trim(),
    capacidade_extintora: form.capacidade_extintora.trim(),
    quantidade: Number.parseInt(form.quantidade.trim(), 10),
    manutencao_2_nivel: manut2 ? manut2 : null,
    manutencao_3_nivel: manut3 ? manut3 : null,
  };
}

export function estoqueFormFromRow(row: {
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
  manutencao_2_nivel?: string | null;
  manutencao_3_nivel?: string | null;
}): Partial<EstoqueFormData> {
  return {
    tipo: row.tipo,
    tamanho: row.tamanho,
    capacidade_extintora: row.capacidade_extintora,
    quantidade: String(row.quantidade),
    manutencao_2_nivel: toDateInputValue(row.manutencao_2_nivel),
    manutencao_3_nivel: toDateInputValue(row.manutencao_3_nivel),
  };
}
