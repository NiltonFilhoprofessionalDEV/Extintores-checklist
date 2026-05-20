import type { ChecklistValue } from "@/lib/checklist/types";
import { diasParaVencimentoTeste, dataVencimentoTeste } from "@/lib/checklist/types";
import { formatDateOnlyPt } from "@/lib/date/date-only";
import type { HidranteChecklistData, HidranteItemKey } from "@/lib/checklist/hidrante-types";
import {
  HIDRANTE_ACTIVE_ITEM_KEYS,
  HIDRANTE_ITEM_LABELS,
  isHidranteChecklistValid,
} from "@/lib/checklist/hidrante-types";
import type { HidranteImportRow } from "@/lib/rf01/hidrante-import-parser";

type OptionDef = { value: ChecklistValue; label: string; color: string; bg: string; ring: string };

const OPTIONS: OptionDef[] = [
  { value: "conforme", label: "Conforme", color: "#15803d", bg: "#dcfce7", ring: "#16a34a" },
  { value: "nao_conforme", label: "Não conforme", color: "#b91c1c", bg: "#fee2e2", ring: "#dc2626" },
  { value: "nao_aplica", label: "N/A", color: "#4b5563", bg: "#f3f4f6", ring: "#9ca3af" },
];

const FIELDS: { key: HidranteItemKey; label: string }[] = HIDRANTE_ACTIVE_ITEM_KEYS.map((key) => ({
  key,
  label: HIDRANTE_ITEM_LABELS[key],
}));

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
        <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
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

type TesteStatus = "vencido" | "alerta" | "ok" | "sem_data";

function testeStatusInfo(ultimaRealizacao: string | null | undefined): {
  status: TesteStatus;
  vencimentoFmt: string;
  label: string;
  color: string;
  bg: string;
} {
  if (!ultimaRealizacao) {
    return { status: "sem_data", vencimentoFmt: "—", label: "Sem registro", color: "#64748b", bg: "#f1f5f9" };
  }
  const dias = diasParaVencimentoTeste(ultimaRealizacao);
  const vencDate = dataVencimentoTeste(ultimaRealizacao);
  const vencimentoFmt = formatDateOnlyPt(vencDate);

  if (dias === null) {
    return { status: "sem_data", vencimentoFmt: "—", label: "Data inválida", color: "#64748b", bg: "#f1f5f9" };
  }
  if (dias < 0) {
    return {
      status: "vencido",
      vencimentoFmt,
      label: `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""}`,
      color: "#b91c1c",
      bg: "#fee2e2",
    };
  }
  if (dias === 0) {
    return { status: "alerta", vencimentoFmt, label: "Vence hoje", color: "#92400e", bg: "#fef3c7" };
  }
  if (dias <= 30) {
    return {
      status: "alerta",
      vencimentoFmt,
      label: `Vence em ${dias} dia${dias !== 1 ? "s" : ""}`,
      color: "#92400e",
      bg: "#fef3c7",
    };
  }
  return {
    status: "ok",
    vencimentoFmt,
    label: `Válido — vence em ${dias} dias`,
    color: "#15803d",
    bg: "#dcfce7",
  };
}

type Props = {
  data: HidranteChecklistData;
  onChange: (data: HidranteChecklistData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isSaving: boolean;
  /** Dados cadastrais do hidrante (planilha / banco). */
  hidrante: Partial<HidranteImportRow> & { codigo: string };
};

export default function HidranteChecklistForm({ data, onChange, onSubmit, onCancel, isSaving, hidrante }: Props) {
  const valid = isHidranteChecklistValid(data);

  function setField(key: HidranteItemKey, value: ChecklistValue) {
    const next = { ...data, [key]: value };
    if (value !== "nao_conforme") {
      const nextNc = { ...next.detalhesNaoConformidade };
      delete nextNc[key];
      next.detalhesNaoConformidade = nextNc;
    }
    onChange(next);
  }

  function setDetalheNc(key: HidranteItemKey, text: string) {
    onChange({
      ...data,
      detalhesNaoConformidade: { ...data.detalhesNaoConformidade, [key]: text },
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-4 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/80">
        <div className="border-b border-blue-100 bg-white px-4 py-3">
          <p className="text-lg font-bold text-slate-900">{hidrante.codigo}</p>
          <p className="text-xs font-medium text-blue-800">Hidrante · Código do local</p>
        </div>
        <dl className="grid gap-2 px-4 py-3 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Pavimento</dt>
            <dd className="text-right font-medium text-slate-800">{hidrante.pavimento?.trim() || "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Localização detalhada</dt>
            <dd className="max-w-[65%] text-right font-medium text-slate-800">{hidrante.local_detalhado?.trim() || "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Quantidade de mangueiras</dt>
            <dd className="text-right font-medium text-slate-800">
              {hidrante.quantidade_mangueiras != null ? hidrante.quantidade_mangueiras : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Chaves Storz / Esguichos</dt>
            <dd className="text-right font-medium text-slate-800">
              {[hidrante.quantidade_chaves_storz, hidrante.quantidade_esguichos].every((v) => v == null)
                ? "—"
                : `${hidrante.quantidade_chaves_storz ?? "—"} / ${hidrante.quantidade_esguichos ?? "—"}`}
            </dd>
          </div>
          {(
            [
              [1, hidrante.teste_hidrostatico_m1],
              [2, hidrante.teste_hidrostatico_m2],
              [3, hidrante.teste_hidrostatico_m3],
              [4, hidrante.teste_hidrostatico_m4],
            ] as const
          ).map(([n, val]) => {
            const info = testeStatusInfo(val ?? null);
            if (info.status === "sem_data") return null;
            return (
              <div key={n} className="col-span-full flex flex-col gap-1 rounded-lg p-2" style={{ background: info.bg }}>
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-semibold" style={{ color: info.color }}>
                    Teste hidrostático M-{n}
                  </dt>
                  <dd
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ color: info.color, background: `${info.color}18` }}
                  >
                    {info.label}
                  </dd>
                </div>
                <div className="flex justify-between text-[11px]" style={{ color: info.color }}>
                  <span>Última realização: <strong>{formatDateOnlyPt(val ?? null)}</strong></span>
                  <span>Vencimento: <strong>{info.vencimentoFmt}</strong></span>
                </div>
              </div>
            );
          })}
        </dl>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Conferente *
          </label>
          <input
            required
            type="text"
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
            rows={2}
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
          {isSaving ? "Salvando..." : "Confirmar inspeção"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary py-3.5">
          Cancelar
        </button>
      </div>

      {!valid && data.conferente.trim() && (
        <p className="mt-2 text-center text-xs text-amber-600">
          Responda todos os itens e descreva toda não conformidade.
        </p>
      )}
    </form>
  );
}
