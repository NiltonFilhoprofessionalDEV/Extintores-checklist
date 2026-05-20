import { NextResponse } from "next/server";
import { getInventoryManagerFromRequest } from "@/lib/auth/inventory-management-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

type ExtintorPayload = {
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
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
    tipo: body.tipo.trim().toLocaleUpperCase("pt-BR"),
    tamanho: body.tamanho.trim(),
    capacidade_extintora: body.capacidade_extintora.trim(),
    manutencao_2_nivel: body.manutencao_2_nivel?.trim() || null,
    manutencao_3_nivel: body.manutencao_3_nivel?.trim() || null,
    pavimento: body.pavimento?.trim() || null,
  };
}

export async function POST(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = normalizePayload((await request.json()) as ExtintorPayload);
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("extintores").insert(body);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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

    const payload = normalizePayload(body);
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("extintores").update(payload).eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao atualizar extintor." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as { id: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("extintores").delete().eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao excluir extintor." },
      { status: 500 },
    );
  }
}
