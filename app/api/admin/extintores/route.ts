import { NextResponse } from "next/server";
import {
  assertInventoryRowInManagerBase,
  getInventoryManagerFromRequest,
} from "@/lib/auth/inventory-management-server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { writeAuditLog } from "@/lib/audit/write-audit-log";

type ExtintorPayload = {
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
  num_cilindro?: string | null;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  pavimento: string | null;
};

function normalizePayload(body: ExtintorPayload): ExtintorPayload {
  return {
    codigo: body.codigo.trim(),
    setor: body.setor.trim().toLocaleUpperCase("pt-BR"),
    local_detalhado: body.local_detalhado.trim(),
    num_inmetro: body.num_inmetro.trim(),
    num_cilindro: body.num_cilindro?.trim() || null,
    tipo: body.tipo.trim().toLocaleUpperCase("pt-BR"),
    tamanho: body.tamanho.trim(),
    capacidade_extintora: body.capacidade_extintora.trim(),
    manutencao_2_nivel: body.manutencao_2_nivel?.trim() || null,
    manutencao_3_nivel: body.manutencao_3_nivel?.trim() || null,
    pavimento: body.pavimento?.trim() || null,
  };
}

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

    const body = normalizePayload((await request.json()) as ExtintorPayload);
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("extintores")
      .insert({
        ...body,
        base_id: manager.base_id,
        active: true,
      })
      .select("id,codigo")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: await actorNome(manager.id),
      actorRole: manager.role,
      action: "create",
      entityType: "extintor",
      entityId: data?.id != null ? String(data.id) : null,
      entityLabel: data?.codigo != null ? String(data.codigo) : String(body.codigo),
      summary: `Cadastrou o extintor ${body.codigo}`,
      details: { codigo: body.codigo, setor: body.setor },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao criar extintor." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as ExtintorPayload & { id: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const scopeError = await assertInventoryRowInManagerBase("extintores", body.id, manager.base_id);
    if (scopeError) return NextResponse.json({ error: scopeError }, { status: 403 });

    const payload = normalizePayload(body);
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("extintores")
      .update(payload)
      .eq("id", body.id)
      .eq("base_id", manager.base_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: await actorNome(manager.id),
      actorRole: manager.role,
      action: "update",
      entityType: "extintor",
      entityId: body.id,
      entityLabel: payload.codigo,
      summary: `Alterou o cadastro do extintor ${payload.codigo}`,
      details: { codigo: payload.codigo, setor: payload.setor },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao atualizar extintor." },
      { status: 500 },
    );
  }
}

/** Soft-delete: não remove do banco. Prefira /api/admin/inventario/soft-delete para lote. */
export async function DELETE(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    if (!isAdminLikeRole(manager.role)) {
      return NextResponse.json(
        { error: "Apenas administradores podem remover itens da lista." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { id: string; confirmacao?: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const scopeError = await assertInventoryRowInManagerBase("extintores", body.id, manager.base_id);
    if (scopeError) return NextResponse.json({ error: scopeError }, { status: 403 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: row } = await supabaseAdmin
      .from("extintores")
      .select("id,codigo")
      .eq("id", body.id)
      .eq("base_id", manager.base_id)
      .maybeSingle<{ id: string; codigo: string }>();

    const { error } = await supabaseAdmin
      .from("extintores")
      .update({
        active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: manager.id,
      })
      .eq("id", body.id)
      .eq("base_id", manager.base_id);

    if (error) {
      const msg = error.message.includes("active")
        ? "Coluna active não existe. Execute docs/migration_soft_delete_auditoria.sql."
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: await actorNome(manager.id),
      actorRole: manager.role,
      action: "soft_delete",
      entityType: "extintor",
      entityId: body.id,
      entityLabel: row?.codigo ?? null,
      summary: `Removeu da lista o extintor ${row?.codigo ?? body.id}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao inativar extintor." },
      { status: 500 },
    );
  }
}
