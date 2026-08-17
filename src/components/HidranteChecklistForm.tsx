import { useMemo, useRef } from "react";
import type { ChecklistValue } from "@/lib/checklist/types";
import type { HidranteChecklistData, HidranteItemKey } from "@/lib/checklist/hidrante-types";
import {
  HIDRANTE_ACTIVE_ITEM_KEYS,
  HIDRANTE_ITEM_LABELS,
  getHidranteAnswer,
  isBuiltinHidranteItemKey,
  isHidranteChecklistValid,
} from "@/lib/checklist/hidrante-types";
import type { HidranteImportRow } from "@/lib/rf01/hidrante-import-parser";
import { computeHidranteChecklistProgress } from "@/lib/inspecao/checklist-progress";
import ChecklistConferenteField from "@/src/components/checklist/ChecklistConferenteField";
import ChecklistDraftIndicator from "@/src/components/checklist/ChecklistDraftIndicator";
import ChecklistOperationalBar from "@/src/components/checklist/ChecklistOperationalBar";
import ChecklistProgressBar from "@/src/components/checklist/ChecklistProgressBar";
import ChecklistQuestionCard from "@/src/components/checklist/ChecklistQuestionCard";
import HidranteCompactHeader from "@/src/components/checklist/HidranteCompactHeader";
import MarkAllConformeButton from "@/src/components/checklist/MarkAllConformeButton";

const DEFAULT_FIELDS: { key: string; label: string }[] = HIDRANTE_ACTIVE_ITEM_KEYS.map((key) => ({
  key,
  label: HIDRANTE_ITEM_LABELS[key],
}));

type Props = {
  data: HidranteChecklistData;
  onChange: (data: HidranteChecklistData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isSaving: boolean;
  hidrante: Partial<HidranteImportRow> & { codigo: string };
  fields?: { key: string; label: string }[];
  draftSavedVisible?: boolean;
};

function markAllConforme(data: HidranteChecklistData, fieldKeys: string[]): HidranteChecklistData {
  const next: HidranteChecklistData = {
    ...data,
    extraAnswers: { ...data.extraAnswers },
    detalhesNaoConformidade: { ...data.detalhesNaoConformidade },
  };
  for (const key of fieldKeys) {
    if (isBuiltinHidranteItemKey(key)) {
      next[key] = "conforme";
    } else {
      next.extraAnswers[key] = "conforme";
    }
    delete next.detalhesNaoConformidade[key];
  }
  return next;
}

export default function HidranteChecklistForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  isSaving,
  hidrante,
  fields = DEFAULT_FIELDS,
  draftSavedVisible = false,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const resolvedFields = fields.length > 0 ? fields : DEFAULT_FIELDS;
  const fieldKeys = resolvedFields.map((field) => field.key);
  const valid = isHidranteChecklistValid(data, fieldKeys);
  const progress = useMemo(() => computeHidranteChecklistProgress(data, fieldKeys), [data, fieldKeys]);

  function setField(key: string, value: ChecklistValue) {
    let next: HidranteChecklistData;
    if (isBuiltinHidranteItemKey(key)) {
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
          <HidranteCompactHeader hidrante={hidrante} />
          <div className="checklist-form__meta">
            <ChecklistProgressBar progress={progress} />
            <ChecklistDraftIndicator visible={draftSavedVisible} />
            <ChecklistConferenteField
              id="checklist-conferente-hidrante"
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
              const value = getHidranteAnswer(data, field.key);
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
              <label className="checklist-notes__label" htmlFor="checklist-observacoes-hidrante">
                Observações
              </label>
              <textarea
                id="checklist-observacoes-hidrante"
                rows={2}
                className="checklist-notes__input"
                value={data.observacoes}
                onChange={(event) => onChange({ ...data, observacoes: event.target.value })}
              />
            </div>
          </div>

          {!valid && data.conferente.trim() && (
            <p className="checklist-form__hint">
              Responda todos os itens e descreva toda não conformidade.
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

export type { HidranteItemKey };
