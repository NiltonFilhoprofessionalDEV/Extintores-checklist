"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChecklistData } from "@/lib/checklist/types";
import type { HidranteChecklistData } from "@/lib/checklist/hidrante-types";
import {
  computeChecklistProgress,
  computeHidranteChecklistProgress,
  hasMeaningfulChecklistAnswers,
} from "@/lib/inspecao/checklist-progress";
import { getChecklistAnswer } from "@/lib/checklist/types";
import { getHidranteAnswer } from "@/lib/checklist/hidrante-types";
import {
  saveInspecaoDraft,
  type InspecaoDraftField,
  type InspecaoDraftKind,
  type InspecaoDraftRecord,
} from "@/lib/inspecao/draft-storage";

type UseInspecaoDraftPersistenceParams = {
  active: boolean;
  userId: string | null;
  baseId: string | null;
  kind: InspecaoDraftKind;
  equipmentId: string | null;
  equipmentCodigo: string | null;
  checklistData: ChecklistData | HidranteChecklistData;
  activeFields: InspecaoDraftField[];
  onDraftSaved?: () => void;
};

function buildDraftRecord(params: UseInspecaoDraftPersistenceParams): InspecaoDraftRecord | null {
  if (!params.userId || !params.baseId || !params.equipmentId || !params.equipmentCodigo) {
    return null;
  }

  const fieldKeys = params.activeFields.map((field) => field.key);
  const progress =
    params.kind === "extintor"
      ? computeChecklistProgress(params.checklistData as ChecklistData, fieldKeys)
      : computeHidranteChecklistProgress(params.checklistData as HidranteChecklistData, fieldKeys);

  const hasAnswers =
    params.kind === "extintor"
      ? hasMeaningfulChecklistAnswers(
          params.checklistData as ChecklistData,
          fieldKeys,
          (key) => getChecklistAnswer(params.checklistData as ChecklistData, key),
        )
      : hasMeaningfulChecklistAnswers(
          params.checklistData as HidranteChecklistData,
          fieldKeys,
          (key) => getHidranteAnswer(params.checklistData as HidranteChecklistData, key),
        );

  if (!hasAnswers) return null;

  return {
    version: 1,
    userId: params.userId,
    baseId: params.baseId,
    kind: params.kind,
    equipmentId: params.equipmentId,
    equipmentCodigo: params.equipmentCodigo,
    checklistData: params.checklistData,
    activeFields: params.activeFields,
    answeredCount: progress.answered,
    totalCount: progress.total,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Persiste rascunho local com debounce e flush imediato em eventos de ciclo de vida.
 */
export function useInspecaoDraftPersistence(params: UseInspecaoDraftPersistenceParams) {
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const debounceRef = useRef<number | null>(null);

  const flushDraft = useCallback(() => {
    const current = paramsRef.current;
    if (!current.active) return;
    const draft = buildDraftRecord(current);
    if (!draft) return;
    saveInspecaoDraft(draft);
    current.onDraftSaved?.();
  }, []);

  const scheduleDraftSave = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      flushDraft();
    }, 300);
  }, [flushDraft]);

  useEffect(() => {
    if (!params.active) return;
    scheduleDraftSave();
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [params.active, params.checklistData, params.activeFields, scheduleDraftSave]);

  useEffect(() => {
    if (!params.active) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    const onPageHide = () => flushDraft();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flushDraft();
    };
  }, [params.active, flushDraft]);

  return { flushDraft, scheduleDraftSave };
}
