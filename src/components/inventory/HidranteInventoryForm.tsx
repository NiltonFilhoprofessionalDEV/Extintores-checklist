"use client";

import {
  HIDRANTE_TESTE_M_CAMPOS,
  MANGUEIRA_OPCOES,
  parseQuantidadeMangueiras,
  type HidranteFormData,
} from "@/lib/inventario/inventory-form";
import type { FloorSelectOption } from "@/lib/inventario/resolve-floor-select";
import { withCurrentFloorOption } from "@/lib/inventario/resolve-floor-select";
import { FormField, FormSection, fieldControlClass } from "@/src/components/inventory/FormPrimitives";

type HidranteInventoryFormProps = {
  form: HidranteFormData;
  floors: FloorSelectOption[];
  errors: Record<string, string>;
  onChange: (key: keyof HidranteFormData, value: string) => void;
  onPavimentoChange: (value: string) => void;
  onQuantidadeMangueiras: (value: string) => void;
};

export default function HidranteInventoryForm({
  form,
  floors,
  errors,
  onChange,
  onPavimentoChange,
  onQuantidadeMangueiras,
}: HidranteInventoryFormProps) {
  const qtd = parseQuantidadeMangueiras(form.quantidade_mangueiras);
  const floorOptions = withCurrentFloorOption(floors, form.pavimento);

  return (
    <>
      <FormSection title="Dados básicos">
        <FormField id="hid-codigo" label="Código do local" required error={errors.codigo} className="inv-field--full">
          <input
            className={fieldControlClass(errors.codigo)}
            placeholder="Ex: 001"
            value={form.codigo}
            onChange={(event) => onChange("codigo", event.target.value)}
            autoComplete="off"
          />
        </FormField>

        <FormField id="hid-pavimento" label="Pavimento">
          <select
            className={fieldControlClass()}
            value={form.pavimento}
            onChange={(event) => onPavimentoChange(event.target.value)}
          >
            <option value="">Selecione o pavimento...</option>
            {floorOptions.map((floor) => (
              <option key={floor.id} value={floor.label}>
                {floor.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="hid-local"
          label="Localização detalhada"
          required
          error={errors.local_detalhado}
          className="inv-field--full"
        >
          <input
            className={fieldControlClass(errors.local_detalhado)}
            placeholder="Descrição detalhada do local"
            value={form.local_detalhado}
            onChange={(event) => onChange("local_detalhado", event.target.value)}
          />
        </FormField>

        <FormField id="hid-mangueiras" label="Quantidade de mangueiras" required error={errors.quantidade_mangueiras}>
          <select
            className={fieldControlClass(errors.quantidade_mangueiras)}
            value={form.quantidade_mangueiras}
            onChange={(event) => onQuantidadeMangueiras(event.target.value)}
          >
            <option value="" disabled>
              Selecione a quantidade...
            </option>
            {MANGUEIRA_OPCOES.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="hid-storz" label="Quantidade de chaves Storz">
          <input
            type="number"
            min={0}
            className={fieldControlClass()}
            placeholder="Ex: 2"
            value={form.quantidade_chaves_storz}
            onChange={(event) => onChange("quantidade_chaves_storz", event.target.value)}
          />
        </FormField>

        <FormField id="hid-esguichos" label="Quantidade de esguichos">
          <input
            type="number"
            min={0}
            className={fieldControlClass()}
            placeholder="Ex: 1"
            value={form.quantidade_esguichos}
            onChange={(event) => onChange("quantidade_esguichos", event.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection title="Datas do último teste hidrostático">
        {qtd === 0 ? (
          <p className="inv-field--full inv-form-note">
            Nenhuma mangueira cadastrada — não há datas de teste a informar.
          </p>
        ) : (
          HIDRANTE_TESTE_M_CAMPOS.slice(0, qtd).map(({ key, label }) => (
            <FormField key={key} id={`hid-${key}`} label={label}>
              <input
                type="date"
                className={fieldControlClass()}
                value={form[key]}
                onChange={(event) => onChange(key, event.target.value)}
              />
            </FormField>
          ))
        )}
      </FormSection>
    </>
  );
}
