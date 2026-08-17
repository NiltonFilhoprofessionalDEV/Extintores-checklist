"use client";

import { COLUNAS_PADRAO } from "@/lib/inventario/equipamento-padrao";
import {
  TAMANHOS_POR_TIPO,
  TIPOS_EXTINTOR,
  type ExtintorFormData,
} from "@/lib/inventario/inventory-form";
import type { FloorSelectOption } from "@/lib/inventario/resolve-floor-select";
import { withCurrentFloorOption } from "@/lib/inventario/resolve-floor-select";
import { FormField, FormSection, fieldControlClass } from "@/src/components/inventory/FormPrimitives";

type ExtintorInventoryFormProps = {
  mode: "create" | "edit";
  form: ExtintorFormData;
  floors: FloorSelectOption[];
  errors: Record<string, string>;
  onChange: (key: keyof ExtintorFormData, value: string) => void;
  onTipoChange: (tipo: string) => void;
  onPavimentoChange: (value: string) => void;
};

export default function ExtintorInventoryForm({
  mode,
  form,
  floors,
  errors,
  onChange,
  onTipoChange,
  onPavimentoChange,
}: ExtintorInventoryFormProps) {
  const floorOptions = withCurrentFloorOption(floors, form.setor);

  return (
    <>
      <FormSection title="Dados básicos">
        <FormField id="ext-codigo" label="Código de controle" required error={errors.codigo} className="inv-field--full">
          <input
            className={fieldControlClass(errors.codigo)}
            placeholder="Ex: 001"
            value={form.codigo}
            onChange={(event) => onChange("codigo", event.target.value)}
            autoComplete="off"
          />
        </FormField>

        <FormField id="ext-inmetro" label="Nº do INMETRO" required error={errors.num_inmetro} className="inv-field--full">
          <input
            className={fieldControlClass(errors.num_inmetro)}
            placeholder="Número do INMETRO"
            value={form.num_inmetro}
            onChange={(event) => onChange("num_inmetro", event.target.value)}
            autoComplete="off"
          />
        </FormField>

        <FormField id="ext-cilindro" label="Nº do cilindro">
          <input
            className={fieldControlClass()}
            placeholder="Número do cilindro"
            value={form.num_cilindro ?? ""}
            onChange={(event) => onChange("num_cilindro", event.target.value)}
            autoComplete="off"
          />
        </FormField>

        <FormField id="ext-pavimento" label="Pavimento" required error={errors.setor}>
          <select
            className={fieldControlClass(errors.setor)}
            value={form.setor}
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
          id="ext-local"
          label="Local detalhado"
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

        <FormField id="ext-tipo" label="Tipo de agente" required error={errors.tipo}>
          <select
            className={fieldControlClass(errors.tipo)}
            value={form.tipo}
            onChange={(event) => onTipoChange(event.target.value)}
          >
            <option value="">Selecione o tipo de agente...</option>
            {TIPOS_EXTINTOR.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="ext-carga" label="Carga nominal" required error={errors.tamanho}>
          <select
            className={fieldControlClass(errors.tamanho)}
            value={form.tamanho}
            onChange={(event) => onChange("tamanho", event.target.value)}
            disabled={!form.tipo}
          >
            <option value="">
              {form.tipo ? "Selecione a carga nominal..." : "Selecione um tipo primeiro"}
            </option>
            {(TAMANHOS_POR_TIPO[form.tipo] ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="ext-capacidade"
          label="Capacidade extintora"
          required
          error={errors.capacidade_extintora}
          className="inv-field--full"
        >
          <input
            readOnly={mode === "edit"}
            className={fieldControlClass(
              errors.capacidade_extintora,
              mode === "edit" ? "cursor-not-allowed bg-slate-50 text-slate-500" : "",
            )}
            placeholder="Ex: 2-A 20-B:C"
            value={form.capacidade_extintora}
            onChange={(event) => onChange("capacidade_extintora", event.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection title="Datas de manutenção">
        <FormField id="ext-n2" label={COLUNAS_PADRAO.venctoN2}>
          <input
            type="date"
            className={fieldControlClass()}
            value={form.manutencao_2_nivel ?? ""}
            onChange={(event) => onChange("manutencao_2_nivel", event.target.value)}
          />
        </FormField>
        <FormField id="ext-n3" label={COLUNAS_PADRAO.venctoN3}>
          <input
            type="date"
            className={fieldControlClass()}
            value={form.manutencao_3_nivel ?? ""}
            onChange={(event) => onChange("manutencao_3_nivel", event.target.value)}
          />
        </FormField>
      </FormSection>
    </>
  );
}
