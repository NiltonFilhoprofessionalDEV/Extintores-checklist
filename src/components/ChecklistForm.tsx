import { useMemo, useRef } from "react";
import type { ChecklistData, ChecklistValue, InspecaoExtintorCabecalho } from "@/lib/checklist/types";
import {
  CHECKLIST_ITEM_KEYS,
  getChecklistAnswer,
  isBuiltinChecklistItemKey,
  isChecklistValid,
  type ChecklistItemKey,
} from "@/lib/checklist/types";
import { DEFAULT_EXTINTOR_QUESTION_LABELS } from "@/lib/checklist/default-questions";
import { computeChecklistProgress } from "@/lib/inspecao/checklist-progress";
import ChecklistConferenteField from "@/src/components/checklist/ChecklistConferenteField";
import ChecklistDraftIndicator from "@/src/components/checklist/ChecklistDraftIndicator";
import ChecklistOperationalBar from "@/src/components/checklist/ChecklistOperationalBar";
import ChecklistProgressBar from "@/src/components/checklist/ChecklistProgressBar";
import ChecklistQuestionCard from "@/src/components/checklist/ChecklistQuestionCard";
import ExtintorCompactHeader from "@/src/components/checklist/ExtintorCompactHeader";
import MarkAllConformeButton from "@/src/components/checklist/MarkAllConformeButton";

const DEFAULT_FIELDS: { key: string; label: string }[] = CHECKLIST_ITEM_KEYS.map((key) => ({
  key,
  label: DEFAULT_EXTINTOR_QUESTION_LABELS[key],
}));

type Props = {
  data: ChecklistData;
  onChange: (data: ChecklistData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isSaving: boolean;
  cabecalho?: InspecaoExtintorCabecalho;
  fields?: { key: string; label: string }[];
  draftSavedVisible?: boolean;
  /** @deprecated use cabecalho */
  extintor?: {
    codigo: string;
    local_detalhado: string;
    tipo?: string;
    tamanho?: string;
    setor?: string;
  };
};

function markAllConforme(data: ChecklistData, fieldKeys: string[]): ChecklistData {
  const next: ChecklistData = {
    ...data,
    extraAnswers: { ...data.extraAnswers },
    detalhesNaoConformidade: { ...data.detalhesNaoConformidade },
  };
  for (const key of fieldKeys) {
    if (isBuiltinChecklistItemKey(key)) {
      next[key] = "conforme";
    } else {
      next.extraAnswers[key] = "conforme";
    }
    delete next.detalhesNaoConformidade[key];
  }
  return next;
}

export default function ChecklistForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  isSaving,
  cabecalho,
  fields = DEFAULT_FIELDS,
  draftSavedVisible = false,
  extintor,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const resolvedFields = fields.length > 0 ? fields : DEFAULT_FIELDS;
  const fieldKeys = resolvedFields.map((field) => field.key);
  const valid = isChecklistValid(data, fieldKeys);
  const progress = useMemo(() => computeChecklistProgress(data, fieldKeys), [data, fieldKeys]);

  function setField(key: string, value: ChecklistValue) {
    let next: ChecklistData;
    if (isBuiltinChecklistItemKey(key)) {
      next = { ...data, [key]: value };
    } else {
      next = {
        ...data,
        extraAnswers: { ...data.extraAnswers, [key]: value },
      };
    }
    if (value !== "nao_conforme") {
      const nextNc = { ...next.detalhesNaoConformidade };
      delete nextNc[key];
      next.detalhesNaoConformidade = nextNc;
    }
    onChange(next);
  }

  function setDetalheNc(key: string, text: string) {
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
          num_cilindro: null,
          tipo: extintor.tipo ?? "—",
          tamanho: extintor.tamanho ?? "—",
          capacidade_extintora: "—",
          manutencao_2_nivel: null,
          manutencao_3_nivel: null,
        }
      : null;

  function scrollToNextUnanswered() {
    const el = formRef.current?.querySelector('[data-checklist-unanswered="true"]');
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    formRef.current?.querySelector(".checklist-question-card")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleFinalize() {
    if (!formRef.current) return;
    if (typeof formRef.current.requestSubmit === "function") {
      formRef.current.requestSubmit();
    } else {
      formRef.current.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="checklist-form">
      <div className="checklist-form__layout">
        <aside className="checklist-form__aside">
          {headerResolved && <ExtintorCompactHeader info={headerResolved} />}
          <div className="checklist-form__meta">
            <ChecklistProgressBar progress={progress} />
            <ChecklistDraftIndicator visible={draftSavedVisible} />
            <ChecklistConferenteField
              id="checklist-conferente-extintor"
              value={data.conferente}
              onChange={(conferente) => onChange({ ...data, conferente })}
            />
            <MarkAllConformeButton
              disabled={isSaving}
              onConfirm={() => onChange(markAllConforme(data, fieldKeys))}
            />
          </div>
        </aside>

        <div className="checklist-form__main">
          <div className="checklist-form__questions">
            {resolvedFields.map((field, index) => {
              const value = getChecklistAnswer(data, field.key);
              return (
                <ChecklistQuestionCard
                  key={field.key}
                  index={index + 1}
                  label={field.label}
                  value={value}
                  unanswered={value === null}
                  onChange={(v) => setField(field.key, v)}
                  detalheNc={data.detalhesNaoConformidade[field.key] ?? ""}
                  onDetalheNcChange={(text) => setDetalheNc(field.key, text)}
                />
              );
            })}

            <div className="checklist-notes">
              <label className="checklist-notes__label" htmlFor="checklist-observacoes-extintor">
                Observações
              </label>
              <textarea
                id="checklist-observacoes-extintor"
                rows={3}
                placeholder="Observações adicionais (opcional)..."
                className="checklist-notes__input"
                value={data.observacoes}
                onChange={(event) => onChange({ ...data, observacoes: event.target.value })}
              />
            </div>
          </div>

          {!valid && data.conferente.trim() && (
            <p className="checklist-form__hint">
              Responda todos os itens e preencha a descrição em todo item marcado como não conforme.
            </p>
          )}

          <div className="checklist-form__back">
            <button type="button" onClick={onCancel} className="btn-secondary w-full py-3">
              Voltar à lista
            </button>
          </div>
        </div>
      </div>

      <ChecklistOperationalBar
        progress={progress}
        isSaving={isSaving}
        isValid={valid}
        onFinalize={handleFinalize}
        onContinue={scrollToNextUnanswered}
      />
    </form>
  );
}

export type { ChecklistItemKey };
