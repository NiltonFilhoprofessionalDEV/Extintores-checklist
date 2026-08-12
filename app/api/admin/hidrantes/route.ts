import { NextResponse } from "next/server";
import {
  assertInventoryRowInManagerBase,
  getInventoryManagerFromRequest,
} from "@/lib/auth/inventory-management-server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { writeAuditLog } from "@/lib/audit/write-audit-log";

type HidrantePayload = {
  codigo: string;
  pavimento: string | null;
  local_detalhado: string;
  quantidade_mangueiras: number | null;
  teste_hidrostatico_m1: string | null;
  teste_hidrostatico_m2: string | null;
  teste_hidrostatico_m3: string | null;
  teste_hidrostatico_m4: string | null;
  quantidade_chaves_storz: number | null;
  quantidade_esguichos: number | null;
};

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizePayload(body: HidrantePayload): HidrantePayload {
  return {
    codigo: body.codigo.trim(),
    pavimento: body.pavimento?.trim() ? body.pavimento.trim().toLocaleUpperCase("pt-BR") : null,
    local_detalhado: body.local_detalhado.trim(),
    quantidade_mangueiras: parseOptionalInt(body.quantidade_mangueiras),
    teste_hidrostatico_m1: body.teste_hidrostatico_m1?.trim() || null,
    teste_hidrostatico_m2: body.teste_hidrostatico_m2?.trim() || null,
    teste_hidrostatico_m3: body.teste_hidrostatico_m3?.trim() || null,
    teste_hidrostatico_m4: body.teste_hidrostatico_m4?.trim() || null,
    quantidade_chaves_storz: parseOptionalInt(body.quantidade_chaves_storz),
    quantidade_esguichos: parseOptionalInt(body.quantidade_esguichos),
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

    const body = normalizePayload((await request.json()) as HidrantePayload);
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("hidrantes")
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
      entityType: "hidrante",
      entityId: data?.id != null ? String(data.id) : null,
      entityLabel: data?.codigo != null ? String(data.codigo) : String(body.codigo),
      summary: `Cadastrou o hidrante ${body.codigo}`,
      details: { codigo: body.codigo, pavimento: body.pavimento },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao criar hidrante." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as HidrantePayload & { id: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const scopeError = await assertInventoryRowInManagerBase("hidrantes", body.id, manager.base_id);
    if (scopeError) return NextResponse.json({ error: scopeError }, { status: 403 });

    const payload = normalizePayload(body);
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("hidrantes")
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
      entityType: "hidrante",
      entityId: body.id,
      entityLabel: payload.codigo,
      summary: `Alterou o cadastro do hidrante ${payload.codigo}`,
      details: { codigo: payload.codigo, pavimento: payload.pavimento },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao atualizar hidrante." },
      { status: 500 },
    );
  }
}

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

    const body = (await request.json()) as { id: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const scopeError = await assertInventoryRowInManagerBase("hidrantes", body.id, manager.base_id);
    if (scopeError) return NextResponse.json({ error: scopeError }, { status: 403 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: row } = await supabaseAdmin
      .from("hidrantes")
      .select("id,codigo")
      .eq("id", body.id)
      .eq("base_id", manager.base_id)
      .maybeSingle<{ id: string; codigo: string }>();

    const { error } = await supabaseAdmin
      .from("hidrantes")
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
      entityType: "hidrante",
      entityId: body.id,
      entityLabel: row?.codigo ?? null,
      summary: `Removeu da lista o hidrante ${row?.codigo ?? body.id}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao inativar hidrante." },
      { status: 500 },
    );
  }
}
