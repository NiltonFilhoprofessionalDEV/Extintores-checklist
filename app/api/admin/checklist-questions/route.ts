import { NextResponse } from "next/server";
import { getFloorManagerFromRequest } from "@/lib/auth/floor-management-server";
import {
  defaultQuestionsForKind,
  type ChecklistKind,
} from "@/lib/checklist/default-questions";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

function parseKind(value: unknown): ChecklistKind | null {
  return value === "extintor" || value === "hidrante" ? value : null;
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

    const byKey = new Map(data.map((row) => [String(row.item_key), row]));
    const questions = defaults.map((fallback, index) => {
      const row = byKey.get(fallback.item_key);
      if (!row) return { ...fallback, sort_order: index };
      return {
        item_key: fallback.item_key,
        label: String(row.label || fallback.label),
        active: Boolean(row.active),
        sort_order: Number(row.sort_order ?? index),
      };
    });

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
      return NextResponse.json({ error: "Informe as perguntas." }, { status: 400 });
    }

    const defaults = defaultQuestionsForKind(kind);
    const allowedKeys = new Set(defaults.map((q) => q.item_key));
    const rows = body.questions
      .map((q, index) => ({
        base_id: manager.base_id,
        kind,
        item_key: String(q.item_key ?? "").trim(),
        label: String(q.label ?? "").trim(),
        active: q.active !== false,
        sort_order: Number.isFinite(Number(q.sort_order)) ? Number(q.sort_order) : index,
      }))
      .filter((q) => allowedKeys.has(q.item_key) && q.label.length > 0);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma pergunta válida." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("base_checklist_questions").upsert(rows, {
      onConflict: "base_id,kind,item_key",
    });

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

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar perguntas." },
      { status: 500 },
    );
  }
}
