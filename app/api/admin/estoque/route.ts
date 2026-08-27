import { NextResponse } from "next/server";
import {
  getInventoryManagerFromRequest,
} from "@/lib/auth/inventory-management-server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { toUppercaseLabel } from "@/lib/inventario/inventory-form";

type EstoquePayload = {
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
};

function normalizePayload(body: EstoquePayload): EstoquePayload {
  return {
    tipo: toUppercaseLabel(body.tipo),
    tamanho: body.tamanho.trim(),
    capacidade_extintora: body.capacidade_extintora.trim(),
    quantidade: Math.max(0, Math.floor(body.quantidade)),
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

function configLabel(p: EstoquePayload): string {
  return `${p.tipo} — ${p.tamanho}`;
}

export async function POST(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = normalizePayload((await request.json()) as EstoquePayload);
    const supabaseAdmin = getSupabaseAdminClient();

    const { data, error } = await supabaseAdmin
      .from("estoque_extintores")
      .insert({
        ...body,
        base_id: manager.base_id,
      })
      .select("id,tipo,tamanho,capacidade_extintora,quantidade")
      .maybeSingle();

    if (error) {
      const msg = error.message.includes("estoque_extintores_config_unique")
        ? "Esta configuração já existe no estoque. Edite a quantidade existente."
        : error.message.includes("estoque_extintores")
          ? "Tabela de estoque não encontrada. Execute docs/migration_estoque_substituicao.sql."
          : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: await actorNome(manager.id),
      actorRole: manager.role,
      action: "stock_update",
      entityType: "estoque",
      entityId: data?.id != null ? String(data.id) : null,
      entityLabel: configLabel(body),
      summary: `Adicionou ao estoque: ${configLabel(body)} (${body.quantidade} un.)`,
      details: body,
    });

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as EstoquePayload & { id: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const payload = normalizePayload(body);
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: existing } = await supabaseAdmin
      .from("estoque_extintores")
      .select("id,base_id")
      .eq("id", body.id)
      .maybeSingle<{ id: string; base_id: string }>();

    if (!existing || existing.base_id !== manager.base_id) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("estoque_extintores")
      .update(payload)
      .eq("id", body.id)
      .eq("base_id", manager.base_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: await actorNome(manager.id),
      actorRole: manager.role,
      action: "stock_update",
      entityType: "estoque",
      entityId: body.id,
      entityLabel: configLabel(payload),
      summary: `Atualizou estoque: ${configLabel(payload)} (${payload.quantidade} un.)`,
      details: payload,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    if (!isAdminLikeRole(manager.role)) {
      return NextResponse.json({ error: "Apenas administradores podem remover do estoque." }, { status: 403 });
    }

    const body = (await request.json()) as { id: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: row } = await supabaseAdmin
      .from("estoque_extintores")
      .select("id,tipo,tamanho,quantidade,base_id")
      .eq("id", body.id)
      .maybeSingle<{ id: string; tipo: string; tamanho: string; quantidade: number; base_id: string }>();

    if (!row || row.base_id !== manager.base_id) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("estoque_extintores")
      .delete()
      .eq("id", body.id)
      .eq("base_id", manager.base_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: await actorNome(manager.id),
      actorRole: manager.role,
      action: "stock_update",
      entityType: "estoque",
      entityId: body.id,
      entityLabel: `${row.tipo} — ${row.tamanho}`,
      summary: `Removeu do estoque: ${row.tipo} — ${row.tamanho}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}
