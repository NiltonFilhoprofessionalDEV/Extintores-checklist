import type { ChecklistData, ChecklistValue } from "@/lib/checklist/types";
import { isChecklistValid } from "@/lib/checklist/types";

type OptionDef = { value: ChecklistValue; label: string; color: string; bg: string; ring: string };

const OPTIONS: OptionDef[] = [
  {
    value: "conforme",
    label: "Conforme",
    color: "#15803d",
    bg: "#dcfce7",
    ring: "#16a34a",
  },
  {
    value: "nao_conforme",
    label: "Não Conforme",
    color: "#b91c1c",
    bg: "#fee2e2",
    ring: "#dc2626",
  },
  {
    value: "nao_aplica",
    label: "N/A",
    color: "#4b5563",
    bg: "#f3f4f6",
    ring: "#9ca3af",
  },
];

type FieldKey = keyof Omit<ChecklistData, "conferente" | "observacoes">;

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "local_correto", label: "O local do extintor está correto conforme o mapa?" },
  { key: "dados_corretos", label: "Os dados do extintor estão corretos?" },
  { key: "sinalizacao_correta", label: "Sinalização está correta?" },
  { key: "mangueira_status", label: "Mangueira está em boas condições?" },
  { key: "bico_difusor_status", label: "O bico ou difusor estão em boas condições?" },
  {
    key: "alca_gatilho_status",
    label: "A alça de transporte, gatilho, lacre e pino estão em boas condições?",
  },
  { key: "medidor_pressao_status", label: "O medidor de pressão está correto?" },
  { key: "cilindro_status", label: "O cilindro está em boas condições?" },
];

function ToggleField({
  label,
  value,
  onChange,
  index,
}: {
  label: string;
  value: ChecklistValue | null;
  onChange: (v: ChecklistValue) => void;
  index: number;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
      <p className="mb-2.5 text-xs font-semibold leading-snug text-gray-700">
        <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E02020] text-[10px] font-bold text-white">
          {index}
        </span>
        {label}
      </p>
      <div className="flex gap-2">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="flex-1 rounded-lg py-2 text-xs font-bold transition-all"
              style={{
                background: active ? opt.bg : "white",
                color: active ? opt.color : "#9ca3af",
                border: `1.5px solid ${active ? opt.ring : "#e5e7eb"}`,
                boxShadow: active ? `0 0 0 2px ${opt.ring}22` : "none",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  data: ChecklistData;
  onChange: (data: ChecklistData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isSaving: boolean;
  /** Optional extintor info shown at top */
  extintor?: {
    codigo: string;
    local_detalhado: string;
    tipo?: string;
    tamanho?: string;
    setor?: string;
  };
};

export default function ChecklistForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  isSaving,
  extintor,
}: Props) {
  const valid = isChecklistValid(data);

  function setField(key: FieldKey, value: ChecklistValue) {
    onChange({ ...data, [key]: value });
  }

  return (
    <form onSubmit={onSubmit}>
      {/* Extintor info header */}
      {extintor && (
        <div
          className="mb-4 rounded-xl px-4 py-3"
          style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
        >
          <p className="text-base font-bold text-white">{extintor.codigo}</p>
          <p className="text-xs text-white/80">{extintor.local_detalhado}</p>
          {(extintor.tipo || extintor.setor) && (
            <p className="mt-0.5 text-[11px] text-white/60">
              {[extintor.tipo, extintor.tamanho, extintor.setor].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {/* Conferente */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Conferente *
          </label>
          <input
            required
            type="text"
            placeholder="Nome do responsável pela conferência"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-[#E02020] focus:outline-none focus:ring-2 focus:ring-[#E02020]/20"
            value={data.conferente}
            onChange={(e) => onChange({ ...data, conferente: e.target.value })}
          />
        </div>

        {/* Checklist items */}
        {FIELDS.map((field, i) => (
          <ToggleField
            key={field.key}
            index={i + 1}
            label={field.label}
            value={data[field.key]}
            onChange={(v) => setField(field.key, v)}
          />
        ))}

        {/* Observações */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Observações
          </label>
          <textarea
            rows={3}
            placeholder="Observações adicionais (opcional)..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-[#E02020] focus:outline-none focus:ring-2 focus:ring-[#E02020]/20"
            value={data.observacoes}
            onChange={(e) => onChange({ ...data, observacoes: e.target.value })}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={isSaving || !valid}
          className="flex-1 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
        >
          {isSaving ? "Salvando..." : "Confirmar Inspeção"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-gray-200 px-4 py-3.5 text-sm font-semibold text-gray-600"
        >
          Cancelar
        </button>
      </div>

      {!valid && data.conferente.trim() && (
        <p className="mt-2 text-center text-xs text-amber-600">
          Responda todos os itens para confirmar a inspeção.
        </p>
      )}
    </form>
  );
}
