import { NextResponse } from "next/server";
import {
  assertInventoryRowInManagerBase,
  getInventoryManagerFromRequest,
} from "@/lib/auth/inventory-management-server";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

type RetiradaPayload = {
  id: string;
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

    const body = (await request.json()) as RetiradaPayload;
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const motivo = body.motivo?.trim() ?? "";
    if (!motivo) return NextResponse.json({ error: "Motivo da retirada é obrigatório." }, { status: 400 });

    const scopeError = await assertInventoryRowInManagerBase("extintores", body.id, manager.base_id);
    if (scopeError) return NextResponse.json({ error: scopeError }, { status: 403 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: row } = await supabaseAdmin
      .from("extintores")
      .select("codigo,tipo,tamanho,num_inmetro")
      .eq("id", body.id)
      .eq("base_id", manager.base_id)
      .maybeSingle<{ codigo: string; tipo: string; tamanho: string; num_inmetro: string | null }>();

    const previsao = body.previsao_retorno?.trim() || null;

    const { error } = await supabaseAdmin.rpc("retirar_extintor_para_manutencao" as never, {
      p_extintor_id: body.id,
      p_base_id: manager.base_id,
      p_actor_id: manager.id,
      p_actor_nome: (await actorNome(manager.id)) ?? "",
      p_motivo: motivo,
      p_previsao_retorno: previsao,
    } as never);

    if (error) {
      const msg = error.message.includes("retirar_extintor")
        ? "Função de retirada não encontrada. Execute docs/migration_estoque_substituicao.sql."
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: await actorNome(manager.id),
      actorRole: manager.role,
      action: "equipment_remove",
      entityType: "extintor",
      entityId: body.id,
      entityLabel: row?.codigo ?? null,
      summary: `Retirou equipamento do ponto ${row?.codigo ?? body.id} para manutenção`,
      details: {
        motivo,
        previsao_retorno: previsao,
        equipamento_anterior: {
          tipo: row?.tipo,
          tamanho: row?.tamanho,
          num_inmetro: row?.num_inmetro,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}
