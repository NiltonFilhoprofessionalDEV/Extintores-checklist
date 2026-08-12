import { NextResponse } from "next/server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { getInventoryManagerFromRequest } from "@/lib/auth/inventory-management-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { SOFT_DELETE_CONFIRM_PHRASE, writeAuditLog } from "@/lib/audit/write-audit-log";

type Body = {
  tipo?: "extintor" | "hidrante";
  ids?: string[];
  confirmacao?: string;
  mode?: "soft_delete" | "restore";
};

export async function POST(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    if (!isAdminLikeRole(manager.role)) {
      return NextResponse.json(
        { error: "Apenas administradores podem inativar ou recuperar itens." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;
    const tipo = body.tipo === "hidrante" ? "hidrante" : body.tipo === "extintor" ? "extintor" : null;
    const mode = body.mode === "restore" ? "restore" : "soft_delete";
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    if (!tipo) return NextResponse.json({ error: "Informe tipo: extintor ou hidrante." }, { status: 400 });
    if (ids.length === 0) return NextResponse.json({ error: "Selecione ao menos um item." }, { status: 400 });

    if (mode === "soft_delete") {
      const confirmacao = String(body.confirmacao ?? "")
        .trim()
        .toLocaleUpperCase("pt-BR");
      if (confirmacao !== SOFT_DELETE_CONFIRM_PHRASE) {
        return NextResponse.json(
          {
            error: `Para confirmar, digite exatamente: ${SOFT_DELETE_CONFIRM_PHRASE}`,
          },
          { status: 400 },
        );
      }
    }

    const table = tipo === "extintor" ? "extintores" : "hidrantes";
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: rows, error: fetchError } = await supabaseAdmin
      .from(table)
      .select("id,codigo,base_id,active")
      .eq("base_id", manager.base_id)
      .in("id", ids);

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });
    const scoped = (rows ?? []).filter((row) => String(row.base_id) === manager.base_id);
    if (scoped.length === 0) {
      return NextResponse.json({ error: "Nenhum item encontrado nesta base." }, { status: 404 });
    }

    const scopedIds = scoped.map((row) => String(row.id));
    const patch =
      mode === "soft_delete"
        ? {
            active: false,
            deactivated_at: new Date().toISOString(),
            deactivated_by: manager.id,
          }
        : {
            active: true,
            deactivated_at: null,
            deactivated_by: null,
          };

    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update(patch)
      .eq("base_id", manager.base_id)
      .in("id", scopedIds);

    if (updateError) {
      const msg = updateError.message.includes("active")
        ? "Coluna active não existe. Execute docs/migration_soft_delete_auditoria.sql."
        : updateError.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome")
      .eq("id", manager.id)
      .maybeSingle<{ nome: string | null }>();

    const labels = scoped.map((row) => String(row.codigo)).join(", ");
    const count = scoped.length;
    const tipoLabel = tipo === "extintor" ? "extintor(es)" : "hidrante(s)";

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: profile?.nome ?? null,
      actorRole: manager.role,
      action: mode === "soft_delete" ? "soft_delete" : "restore",
      entityType: tipo,
      entityId: scopedIds.join(","),
      entityLabel: labels.slice(0, 200),
      summary:
        mode === "soft_delete"
          ? `Removeu da lista ${count} ${tipoLabel}: ${labels}`
          : `Recuperou ${count} ${tipoLabel}: ${labels}`,
      details: {
        count,
        ids: scopedIds,
        codigos: scoped.map((row) => String(row.codigo)),
        mode,
      },
    });

    return NextResponse.json({
      ok: true,
      count,
      mode,
      confirmPhrase: SOFT_DELETE_CONFIRM_PHRASE,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao processar inventário." },
      { status: 500 },
    );
  }
}
