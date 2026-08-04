import { NextResponse } from "next/server";
import { getInventoryManagerFromRequest } from "@/lib/auth/inventory-management-server";
import { runImportSyncWithRlsFallback } from "@/lib/import/import-supabase";
import { syncExtintores, syncHidrantes, type ImportMode } from "@/lib/import/spreadsheet-sync";
import type { ExtintorImportRecord } from "@/lib/rf01/import-parser";
import type { HidranteImportRow } from "@/lib/rf01/hidrante-import-parser";

type ImportBody = {
  destino: "extintores" | "hidrantes";
  mode: ImportMode;
  rows: ExtintorImportRecord[] | HidranteImportRow[];
};

const MAX_ROWS = 5000;

function extractAccessToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  return token || null;
}

export async function POST(request: Request) {
  try {
    const accessToken = extractAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if (manager.role !== "admin" && manager.role !== "admin_corporativo") {
      return NextResponse.json({ error: "Sem permissão para importação em lote." }, { status: 403 });
    }

    const body = (await request.json()) as ImportBody;
    if (!body.destino || !body.mode || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    if (body.rows.length === 0) {
      return NextResponse.json({ inserted: 0, updated: 0, error: null });
    }

    if (body.rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Limite de ${MAX_ROWS} linhas por importação.` },
        { status: 400 },
      );
    }

    if (body.destino === "extintores") {
      const result = await runImportSyncWithRlsFallback(accessToken, (client) =>
        syncExtintores(client, body.rows as ExtintorImportRecord[], body.mode, manager.base_id),
      );
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result);
    }

    if (body.destino === "hidrantes") {
      const result = await runImportSyncWithRlsFallback(accessToken, (client) =>
        syncHidrantes(client, body.rows as HidranteImportRow[], body.mode, manager.base_id),
      );
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Destino inválido." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno na importação." },
      { status: 500 },
    );
  }
}
