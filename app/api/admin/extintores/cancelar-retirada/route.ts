import { NextResponse } from "next/server";
import {
  assertInventoryRowInManagerBase,
  getInventoryManagerFromRequest,
} from "@/lib/auth/inventory-management-server";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

type CancelarRetiradaPayload = {
  id: string;
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

    const body = (await request.json()) as CancelarRetiradaPayload;
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const scopeError = await assertInventoryRowInManagerBase("extintores", body.id, manager.base_id);
    if (scopeError) return NextResponse.json({ error: scopeError }, { status: 403 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: row } = await supabaseAdmin
      .from("extintores")
      .select("codigo,sem_equipamento")
      .eq("id", body.id)
      .eq("base_id", manager.base_id)
      .maybeSingle<{ codigo: string; sem_equipamento: boolean }>();

    if (!row) return NextResponse.json({ error: "Extintor não encontrado." }, { status: 404 });
    if (!row.sem_equipamento) {
      return NextResponse.json({ error: "Este ponto já possui equipamento instalado." }, { status: 400 });
    }

    const nome = (await actorNome(manager.id)) ?? "";

    const { error } = await supabaseAdmin.rpc("cancelar_retirada_extintor" as never, {
      p_extintor_id: body.id,
      p_base_id: manager.base_id,
      p_actor_id: manager.id,
      p_actor_nome: nome,
    } as never);

    if (error) {
      const msg = error.message.includes("cancelar_retirada")
        ? "Função de cancelamento não encontrada. Execute docs/migration_cancelar_retirada.sql."
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: nome || null,
      actorRole: manager.role,
      action: "equipment_restore",
      entityType: "extintor",
      entityId: body.id,
      entityLabel: row.codigo,
      summary: `Cancelou retirada e restaurou equipamento no ponto ${row.codigo}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}
