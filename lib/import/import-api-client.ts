import type { ExtintorImportRecord } from "@/lib/rf01/import-parser";
import type { HidranteImportRow } from "@/lib/rf01/hidrante-import-parser";
import type { ImportMode, ImportSyncResult } from "@/lib/import/spreadsheet-sync";

type ImportDestino = "extintores" | "hidrantes";

export async function importSpreadsheetViaApi(params: {
  accessToken: string;
  activeBaseId: string | null;
  destino: ImportDestino;
  mode: ImportMode;
  rows: ExtintorImportRecord[] | HidranteImportRow[];
}): Promise<ImportSyncResult> {
  const response = await fetch("/api/admin/import", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
      ...(params.activeBaseId ? { "X-Active-Base-Id": params.activeBaseId } : {}),
    },
    body: JSON.stringify({
      destino: params.destino,
      mode: params.mode,
      rows: params.rows,
    }),
  });

  const payload = (await response.json()) as ImportSyncResult & { error?: string };
  if (!response.ok) {
    return {
      inserted: 0,
      updated: 0,
      error: payload.error ?? "Falha na importação.",
    };
  }

  return {
    inserted: payload.inserted ?? 0,
    updated: payload.updated ?? 0,
    error: payload.error ?? null,
  };
}
