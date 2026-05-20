import type { ChecklistData, ChecklistItemKey, ChecklistValue, InspecaoExtintorCabecalho } from "@/lib/checklist/types";
import { isChecklistValid, isDataVencida } from "@/lib/checklist/types";
import { formatDateOnlyPt } from "@/lib/date/date-only";

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
    label: "Não conforme",
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

const FIELDS: { key: ChecklistItemKey; label: string }[] = [
  {
    key: "local_correto",
    label:
      "A localização do extintor está conforme o layout/mapa de distribuição e atende aos requisitos normativos aplicáveis?",
  },
  {
    key: "dados_corretos",
    label:
      "As informações de identificação, rótulo e instruções de uso do extintor estão corretas, legíveis e atualizadas?",
  },
  {
    key: "sinalizacao_correta",
    label:
      "A sinalização de identificação do extintor está visível, adequada e em conformidade com as normas vigentes?",
  },
  {
    key: "mangueira_status",
    label:
      "A mangueira apresenta integridade física, sem rachaduras, ressecamento ou obstruções, e está em condições adequadas de uso?",
  },
  {
    key: "bico_difusor_status",
    label:
      "O bico ou difusor encontra-se em perfeito estado de conservação, sem obstruções ou danos que comprometam o funcionamento?",
  },
  {
    key: "alca_gatilho_status",
    label:
      "A alça de transporte, gatilho, lacre e pino de segurança estão íntegros, inviolados e em condições adequadas de operação?",
  },
  {
    key: "medidor_pressao_status",
    label:
      "O manômetro apresenta leitura dentro da faixa operacional recomendada, sem sinais de falha ou avaria?",
  },
  {
    key: "cilindro_status",
    label:
      "O cilindro apresenta boas condições estruturais, sem corrosão, amassados, vazamentos ou outros danos aparentes?",
  },
];

function CabecalhoInspecao({ info }: { info: InspecaoExtintorCabecalho }) {
  const v2 = isDataVencida(info.manutencao_2_nivel);
  const v3 = isDataVencida(info.manutencao_3_nivel);

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-lg font-bold text-slate-900">{info.codigo}</p>
        <p className="text-xs font-medium text-slate-500">Extintor</p>
      </div>
      <dl className="grid gap-2 px-4 py-3 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Pavimento</dt>
          <dd className="text-right font-medium text-slate-800">{info.pavimento?.trim() || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Local detalhado</dt>
          <dd className="text-right font-medium text-slate-800">{info.local_detalhado || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Nº INMETRO</dt>
          <dd className="text-right font-medium text-slate-800">{info.num_inmetro || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Tipo</dt>
          <dd className="text-right font-medium text-slate-800">{info.tipo || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Tamanho</dt>
          <dd className="text-right font-medium text-slate-800">{info.tamanho || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Capacidade extintora</dt>
          <dd className="text-right font-medium text-slate-800">{info.capacidade_extintora || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Próximo teste nível 2</dt>
          <dd className={`text-right font-semibold ${v2 ? "text-red-600" : "text-slate-800"}`}>
            {formatDateOnlyPt(info.manutencao_2_nivel)}
            {v2 ? " (vencido)" : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Próximo teste nível 3</dt>
          <dd className={`text-right font-semibold ${v3 ? "text-red-600" : "text-slate-800"}`}>
            {formatDateOnlyPt(info.manutencao_3_nivel)}
            {v3 ? " (vencido)" : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ToggleField({
  label,
  value,
  onChange,
  index,
  detalheNc,
  onDetalheNcChange,
}: {
  label: string;
  value: ChecklistValue | null;
  onChange: (v: ChecklistValue) => void;
  index: number;
  detalheNc: string;
  onDetalheNcChange: (text: string) => void;
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
      {value === "nao_conforme" && (
        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-red-700">
            Descreva a não conformidade *
          </label>
          <textarea
            required
            rows={3}
            placeholder="Obrigatório: descreva o problema encontrado..."
            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            value={detalheNc}
            onChange={(e) => onDetalheNcChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

type Props = {
  data: ChecklistData;
  onChange: (data: ChecklistData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isSaving: boolean;
  cabecalho?: InspecaoExtintorCabecalho;
  /** @deprecated use cabecalho */
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
  cabecalho,
  extintor,
}: Props) {
  const valid = isChecklistValid(data);

  function setField(key: ChecklistItemKey, value: ChecklistValue) {
    const next = { ...data, [key]: value };
    if (value !== "nao_conforme") {
      const nextNc = { ...next.detalhesNaoConformidade };
      delete nextNc[key];
      next.detalhesNaoConformidade = nextNc;
    }
    onChange(next);
  }

  function setDetalheNc(key: ChecklistItemKey, text: string) {
    onChange({
      ...data,
      detalhesNaoConformidade: { ...data.detalhesNaoConformidade, [key]: text },
    });
  }

  const headerResolved: InspecaoExtintorCabecalho | null = cabecalho
    ? cabecalho
    : extintor
      ? {
          codigo: extintor.codigo,
          pavimento: extintor.setor ?? null,
          local_detalhado: extintor.local_detalhado,
          num_inmetro: "—",
          tipo: extintor.tipo ?? "—",
          tamanho: extintor.tamanho ?? "—",
          capacidade_extintora: "—",
          manutencao_2_nivel: null,
          manutencao_3_nivel: null,
        }
      : null;

  return (
    <form onSubmit={onSubmit}>
      {headerResolved && <CabecalhoInspecao info={headerResolved} />}

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Conferente *
          </label>
          <input
            required
            type="text"
            placeholder="Nome do responsável pela conferência"
            className="field-control py-3"
            value={data.conferente}
            onChange={(e) => onChange({ ...data, conferente: e.target.value })}
          />
        </div>

        {FIELDS.map((field, i) => (
          <ToggleField
            key={field.key}
            index={i + 1}
            label={field.label}
            value={data[field.key]}
            onChange={(v) => setField(field.key, v)}
            detalheNc={data.detalhesNaoConformidade[field.key] ?? ""}
            onDetalheNcChange={(text) => setDetalheNc(field.key, text)}
          />
        ))}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Observações
          </label>
          <textarea
            rows={3}
            placeholder="Observações adicionais (opcional)..."
            className="field-control py-3"
            value={data.observacoes}
            onChange={(e) => onChange({ ...data, observacoes: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={isSaving || !valid}
          className="btn-primary flex-1 py-3.5 disabled:opacity-50"
        >
          {isSaving ? "Salvando..." : "Confirmar Inspeção"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary py-3.5"
        >
          Cancelar
        </button>
      </div>

      {!valid && data.conferente.trim() && (
        <p className="mt-2 text-center text-xs text-amber-600">
          Responda todos os itens e preencha a descrição em todo item marcado como não conforme.
        </p>
      )}
    </form>
  );
}
