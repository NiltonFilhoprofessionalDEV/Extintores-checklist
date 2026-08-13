import type { ChecklistData } from "@/lib/checklist/types";
import type { HidranteChecklistData } from "@/lib/checklist/hidrante-types";

export type InspecaoDraftKind = "extintor" | "hidrante";

export type InspecaoDraftField = { key: string; label: string };

export type InspecaoDraftRecord = {
  version: 1;
  userId: string;
  baseId: string;
  kind: InspecaoDraftKind;
  equipmentId: string;
  equipmentCodigo: string;
  checklistData: ChecklistData | HidranteChecklistData;
  activeFields: InspecaoDraftField[];
  answeredCount: number;
  totalCount: number;
  updatedAt: string;
};

const DRAFT_STORAGE_VERSION = "v1";
const DRAFT_KEY_PREFIX = `firecheck_inspecao_draft_${DRAFT_STORAGE_VERSION}`;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function draftKey(userId: string, kind: InspecaoDraftKind, equipmentId: string): string {
  return `${DRAFT_KEY_PREFIX}:${userId}:${kind}:${equipmentId}`;
}

function draftIndexKey(userId: string): string {
  return `${DRAFT_KEY_PREFIX}:index:${userId}`;
}

export type DraftIndexEntry = {
  kind: InspecaoDraftKind;
  equipmentId: string;
  equipmentCodigo: string;
  baseId: string;
  answeredCount: number;
  totalCount: number;
  updatedAt: string;
};

function readIndex(userId: string): DraftIndexEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(draftIndexKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DraftIndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(userId: string, entries: DraftIndexEntry[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(draftIndexKey(userId), JSON.stringify(entries));
  } catch {
    // quota ou modo privado
  }
}

export function saveInspecaoDraft(draft: InspecaoDraftRecord): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      draftKey(draft.userId, draft.kind, draft.equipmentId),
      JSON.stringify(draft),
    );
    const index = readIndex(draft.userId).filter(
      (entry) => entry.kind !== draft.kind || entry.equipmentId !== draft.equipmentId,
    );
    index.push({
      kind: draft.kind,
      equipmentId: draft.equipmentId,
      equipmentCodigo: draft.equipmentCodigo,
      baseId: draft.baseId,
      answeredCount: draft.answeredCount,
      totalCount: draft.totalCount,
      updatedAt: draft.updatedAt,
    });
    writeIndex(draft.userId, index);
  } catch {
    // não bloqueia inspeção
  }
}

export function loadInspecaoDraft(
  userId: string,
  kind: InspecaoDraftKind,
  equipmentId: string,
): InspecaoDraftRecord | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(draftKey(userId, kind, equipmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InspecaoDraftRecord;
    if (parsed?.version !== 1) return null;
    return {
      ...parsed,
      answeredCount: parsed.answeredCount ?? 0,
      totalCount: parsed.totalCount ?? parsed.activeFields?.length ?? 0,
    };
  } catch {
    return null;
  }
}

export function getInspecaoDraftIndexEntry(
  userId: string,
  kind: InspecaoDraftKind,
  equipmentId: string,
): DraftIndexEntry | null {
  return readIndex(userId).find(
    (entry) => entry.kind === kind && entry.equipmentId === equipmentId,
  ) ?? null;
}

export function clearInspecaoDraft(
  userId: string,
  kind: InspecaoDraftKind,
  equipmentId: string,
): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(draftKey(userId, kind, equipmentId));
    const index = readIndex(userId).filter(
      (entry) => entry.kind !== kind || entry.equipmentId !== equipmentId,
    );
    writeIndex(userId, index);
  } catch {
    // noop
  }
}

export function getLatestInspecaoDraft(userId: string): DraftIndexEntry | null {
  const index = readIndex(userId);
  if (index.length === 0) return null;
  return [...index].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
}

export function listInspecaoDrafts(userId: string): DraftIndexEntry[] {
  return [...readIndex(userId)].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function isDraftIncomplete(entry: DraftIndexEntry): boolean {
  return entry.totalCount > 0 && entry.answeredCount < entry.totalCount;
}
