import { toUppercaseLabel } from "@/lib/inventario/inventory-form";

export type EstoqueFormData = {
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: string;
};

export const EMPTY_ESTOQUE_FORM: EstoqueFormData = {
  tipo: "",
  tamanho: "",
  capacidade_extintora: "",
  quantidade: "",
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
  return {
    tipo: toUppercaseLabel(form.tipo),
    tamanho: form.tamanho.trim(),
    capacidade_extintora: form.capacidade_extintora.trim(),
    quantidade: Number.parseInt(form.quantidade.trim(), 10),
  };
}
