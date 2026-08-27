import { NextResponse } from "next/server";
import { getInventoryManagerFromRequest } from "@/lib/auth/inventory-management-server";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

type RetiradaLotePayload = {
  extintor_ids: string[];
  motivo: string;
  previsao_retorno?: string | null;
};

async function actorNome(userId: string): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("nome")
    .eq("id", userId)
    .maybeSingle<{ nome: string | null }>();
  return data?.nome ?? null;
}

export async function POST(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as RetiradaLotePayload;
    const ids = Array.isArray(body.extintor_ids)
      ? [...new Set(body.extintor_ids.filter((id) => typeof id === "string" && id.trim()))]
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um extintor." }, { status: 400 });
    }

    const motivo = body.motivo?.trim() ?? "";
    if (!motivo) return NextResponse.json({ error: "Motivo da retirada é obrigatório." }, { status: 400 });

    const supabaseAdmin = getSupabaseAdminClient();

    const { data: rows, error: scopeError } = await supabaseAdmin
      .from("extintores")
      .select("id,codigo,base_id")
      .in("id", ids)
      .eq("base_id", manager.base_id);

    if (scopeError) return NextResponse.json({ error: scopeError.message }, { status: 400 });

    const foundIds = new Set((rows ?? []).map((r) => String((r as { id: string }).id)));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Um ou mais extintores não pertencem à base ativa." },
        { status: 403 },
      );
    }

    const previsao = body.previsao_retorno?.trim() || null;
    const nome = (await actorNome(manager.id)) ?? "";

    const { data: loteId, error } = await supabaseAdmin.rpc("retirar_extintores_lote" as never, {
      p_base_id: manager.base_id,
      p_actor_id: manager.id,
      p_actor_nome: nome,
      p_motivo: motivo,
      p_previsao_retorno: previsao,
      p_extintor_ids: ids,
    } as never);

    if (error) {
      const msg = error.message.includes("retirar_extintores_lote")
        ? "Função de retirada em lote não encontrada. Execute docs/migration_manutencao_lotes.sql."
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const codigos = (rows ?? []).map((r) => (r as { codigo: string }).codigo);

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: nome,
      actorRole: manager.role,
      action: "equipment_remove_batch",
      entityType: "extintor",
      entityId: loteId != null ? String(loteId) : null,
      entityLabel: `Lote ${ids.length} extintores`,
      summary: `Criou lista de manutenção com ${ids.length} extintor(es) retirado(s)`,
      details: {
        lote_id: loteId,
        extintor_ids: ids,
        codigos,
        motivo,
        previsao_retorno: previsao,
      },
    });

    return NextResponse.json({ ok: true, lote_id: loteId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}
