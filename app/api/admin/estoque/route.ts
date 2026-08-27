import { NextResponse } from "next/server";
import {
  getInventoryManagerFromRequest,
} from "@/lib/auth/inventory-management-server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { toUppercaseLabel } from "@/lib/inventario/inventory-form";
import { extintorConfigsAreCompatible } from "@/lib/estoque/compatibility";

type EstoquePayload = {
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
  manutencao_2_nivel?: string | null;
  manutencao_3_nivel?: string | null;
};

function normalizePayload(body: EstoquePayload): EstoquePayload {
  return {
    tipo: toUppercaseLabel(body.tipo),
    tamanho: body.tamanho.trim(),
    capacidade_extintora: body.capacidade_extintora.trim(),
    quantidade: Math.max(0, Math.floor(body.quantidade)),
    manutencao_2_nivel: body.manutencao_2_nivel?.trim() || null,
    manutencao_3_nivel: body.manutencao_3_nivel?.trim() || null,
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

export async function GET(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const extintorId = new URL(request.url).searchParams.get("extintor_id")?.trim() || null;
    const supabaseAdmin = getSupabaseAdminClient();

    const { data, error } = await supabaseAdmin
      .from("estoque_extintores")
      .select("id,tipo,tamanho,capacidade_extintora,quantidade,manutencao_2_nivel,manutencao_3_nivel")
      .eq("base_id", manager.base_id)
      .gt("quantidade", 0)
      .order("tipo", { ascending: true });

    type EstoqueListRow = EstoquePayload & { id: string };
    let items: EstoqueListRow[];

    if (error && /manutencao_2_nivel|manutencao_3_nivel|schema cache/i.test(error.message)) {
      const fallback = await supabaseAdmin
        .from("estoque_extintores")
        .select("id,tipo,tamanho,capacidade_extintora,quantidade")
        .eq("base_id", manager.base_id)
        .gt("quantidade", 0)
        .order("tipo", { ascending: true });

      if (fallback.error) {
        const msg = fallback.error.message.includes("estoque_extintores")
          ? "Tabela de estoque não encontrada. Execute docs/migration_estoque_substituicao.sql."
          : fallback.error.message;
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      items = (fallback.data ?? []).map((row) => ({
        ...(row as EstoqueListRow),
        manutencao_2_nivel: null,
        manutencao_3_nivel: null,
      }));
    } else if (error) {
      const msg = error.message.includes("estoque_extintores")
        ? "Tabela de estoque não encontrada. Execute docs/migration_estoque_substituicao.sql."
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    } else {
      items = (data ?? []) as EstoqueListRow[];
    }

    if (extintorId) {
      const { data: ext, error: extError } = await supabaseAdmin
        .from("extintores")
        .select("id,tipo,tamanho,capacidade_extintora")
        .eq("id", extintorId)
        .eq("base_id", manager.base_id)
        .maybeSingle<{
          id: string;
          tipo: string;
          tamanho: string;
          capacidade_extintora: string;
        }>();

      if (extError) return NextResponse.json({ error: extError.message }, { status: 400 });
      if (!ext) return NextResponse.json({ error: "Extintor não encontrado." }, { status: 404 });

      items = items.filter((row) =>
        extintorConfigsAreCompatible(
          {
            tipo: ext.tipo,
            tamanho: ext.tamanho,
            capacidade_extintora: ext.capacidade_extintora,
          },
          row,
        ),
      );
    }

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
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
      .select("id,tipo,tamanho,capacidade_extintora,quantidade,manutencao_2_nivel,manutencao_3_nivel")
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
