"use client";

import { useState } from "react";
import { COLUNAS_PADRAO } from "@/lib/inventario/equipamento-padrao";
import { TAMANHOS_POR_TIPO, TIPOS_EXTINTOR } from "@/lib/inventario/inventory-form";
import {
  EMPTY_ESTOQUE_FORM,
  type EstoqueFormData,
  validateEstoqueForm,
} from "@/lib/estoque/stock-form";
import { FormField, FormSection, fieldControlClass } from "@/src/components/inventory/FormPrimitives";

type EstoqueStockFormProps = {
  form: EstoqueFormData;
  errors: Record<string, string>;
  onChange: (key: keyof EstoqueFormData, value: string) => void;
  onTipoChange: (tipo: string) => void;
};

export default function EstoqueStockForm({
  form,
  errors,
  onChange,
  onTipoChange,
}: EstoqueStockFormProps) {
  const tamanhos = TAMANHOS_POR_TIPO[form.tipo] ?? [];

  return (
    <FormSection title="Configuração do equipamento">
      <FormField id="est-tipo" label="Tipo de agente extintor" required error={errors.tipo}>
        <select
          className={fieldControlClass(errors.tipo)}
          value={form.tipo}
          onChange={(event) => onTipoChange(event.target.value)}
        >
          <option value="">Selecione...</option>
          {TIPOS_EXTINTOR.map((tipo) => (
            <option key={tipo} value={tipo}>{tipo}</option>
          ))}
        </select>
      </FormField>

      <FormField id="est-tamanho" label="Carga nominal" required error={errors.tamanho}>
        <select
          className={fieldControlClass(errors.tamanho)}
          value={form.tamanho}
          onChange={(event) => onChange("tamanho", event.target.value)}
        >
          <option value="">Selecione...</option>
          {tamanhos.map((tam) => (
            <option key={tam} value={tam}>{tam}</option>
          ))}
        </select>
      </FormField>

      <FormField
        id="est-capacidade"
        label={COLUNAS_PADRAO.capacidadeExtintora}
        required
        error={errors.capacidade_extintora}
        className="inv-field--full"
      >
        <input
          className={fieldControlClass(errors.capacidade_extintora)}
          placeholder="Ex: 2-A 20-B:C"
          value={form.capacidade_extintora}
          onChange={(event) => onChange("capacidade_extintora", event.target.value)}
          autoComplete="off"
        />
      </FormField>

      <FormField id="est-qtd" label="Quantidade disponível" required error={errors.quantidade}>
        <input
          type="number"
          min={0}
          step={1}
          className={fieldControlClass(errors.quantidade)}
          value={form.quantidade}
          onChange={(event) => onChange("quantidade", event.target.value)}
          autoComplete="off"
        />
      </FormField>
    </FormSection>
  );
}

export function useEstoqueFormState(initial?: Partial<EstoqueFormData>) {
  const [form, setForm] = useState<EstoqueFormData>({ ...EMPTY_ESTOQUE_FORM, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onChange(key: keyof EstoqueFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function onTipoChange(tipo: string) {
    setForm((prev) => ({
      ...prev,
      tipo,
      tamanho: TAMANHOS_POR_TIPO[tipo]?.[0] ?? "",
    }));
    setErrors({});
  }

  function validate(): boolean {
    const next = validateEstoqueForm(form);
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function reset(next?: Partial<EstoqueFormData>) {
    setForm({ ...EMPTY_ESTOQUE_FORM, ...next });
    setErrors({});
  }

  return { form, errors, onChange, onTipoChange, validate, reset };
}
