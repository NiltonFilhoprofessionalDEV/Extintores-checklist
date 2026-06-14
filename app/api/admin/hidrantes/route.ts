import { NextResponse } from "next/server";
import { getInventoryManagerFromRequest } from "@/lib/auth/inventory-management-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

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

export async function POST(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = normalizePayload((await request.json()) as HidrantePayload);
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("hidrantes").insert(body);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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

    const payload = normalizePayload(body);
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("hidrantes").update(payload).eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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

    const body = (await request.json()) as { id: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("hidrantes").delete().eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao excluir hidrante." },
      { status: 500 },
    );
  }
}
