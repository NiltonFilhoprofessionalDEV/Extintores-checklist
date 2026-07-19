import { NextResponse } from "next/server";
import { getFloorManagerFromRequest } from "@/lib/auth/floor-management-server";
import {
  defaultQuestionsForKind,
  makeUniqueQuestionKey,
  type ChecklistKind,
} from "@/lib/checklist/default-questions";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

function parseKind(value: unknown): ChecklistKind | null {
  return value === "extintor" || value === "hidrante" ? value : null;
}

function normalizeItemKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export async function GET(request: Request) {
  try {
    const manager = await getFloorManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const url = new URL(request.url);
    const kind = parseKind(url.searchParams.get("kind"));
    if (!kind) return NextResponse.json({ error: "kind inválido (extintor|hidrante)." }, { status: 400 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("base_checklist_questions")
      .select("id,base_id,kind,item_key,label,active,sort_order")
      .eq("base_id", manager.base_id)
      .eq("kind", kind)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error: error.message.includes("base_checklist_questions")
            ? "Tabela de perguntas não existe. Execute docs/migration_base_checklist_questions.sql."
            : error.message,
        },
        { status: 400 },
      );
    }

    const defaults = defaultQuestionsForKind(kind);
    if (!data || data.length === 0) {
      return NextResponse.json({ questions: defaults, seeded: false, base_id: manager.base_id });
    }

    const questions = data.map((row, index) => ({
      item_key: String(row.item_key),
      label: String(row.label || "").trim(),
      active: Boolean(row.active),
      sort_order: Number(row.sort_order ?? index),
    }));

    return NextResponse.json({ questions, seeded: true, base_id: manager.base_id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar perguntas." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const manager = await getFloorManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as {
      kind?: string;
      questions?: Array<{ item_key?: string; label?: string; active?: boolean; sort_order?: number }>;
    };

    const kind = parseKind(body.kind);
    if (!kind) return NextResponse.json({ error: "kind inválido." }, { status: 400 });
    if (!Array.isArray(body.questions) || body.questions.length === 0) {
      return NextResponse.json({ error: "Informe ao menos uma pergunta." }, { status: 400 });
    }

    const usedKeys = new Set<string>();
    const rows = body.questions
      .map((q, index) => {
        const label = String(q.label ?? "").trim();
        if (!label) return null;

        let itemKey = normalizeItemKey(String(q.item_key ?? ""));
        if (!itemKey) {
          itemKey = makeUniqueQuestionKey(label, usedKeys);
        } else if (usedKeys.has(itemKey)) {
          itemKey = makeUniqueQuestionKey(label || itemKey, usedKeys);
        }
        usedKeys.add(itemKey);

        return {
          base_id: manager.base_id,
          kind,
          item_key: itemKey,
          label,
          active: q.active !== false,
          sort_order: Number.isFinite(Number(q.sort_order)) ? Number(q.sort_order) : index,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma pergunta válida." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Substitui o conjunto inteiro da base/kind (permite remover campos).
    const { error: deleteError } = await supabaseAdmin
      .from("base_checklist_questions")
      .delete()
      .eq("base_id", manager.base_id)
      .eq("kind", kind);
    if (deleteError) {
      return NextResponse.json(
        {
          error: deleteError.message.includes("base_checklist_questions")
            ? "Tabela de perguntas não existe. Execute docs/migration_base_checklist_questions.sql."
            : deleteError.message,
        },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin.from("base_checklist_questions").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar perguntas." },
      { status: 500 },
    );
  }
}
