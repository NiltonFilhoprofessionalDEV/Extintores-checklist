import { NextResponse } from "next/server";
import {
  assertInventoryRowInManagerBase,
  getInventoryManagerFromRequest,
} from "@/lib/auth/inventory-management-server";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { insertChecklistAposSubstituicao } from "@/lib/checklist/substituicao-checklist";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

type SubstituirPayload = {
  extintor_id: string;
  estoque_id: string;
  num_inmetro: string;
  num_cilindro?: string | null;
  manutencao_2_nivel?: string | null;
  manutencao_3_nivel?: string | null;
};

async function actorNome(userId: string): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("nome")
    .eq("id", userId)
    .maybeSingle<{ nome: string | null }>();
  const nome = data?.nome?.trim();
  if (nome) return nome;

  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = authData.user?.email ?? "";
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return local || null;
}

export async function POST(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as SubstituirPayload;
    if (!body.extintor_id || !body.estoque_id) {
      return NextResponse.json({ error: "Extintor e item de estoque são obrigatórios." }, { status: 400 });
    }

    const numInmetro = body.num_inmetro?.trim() ?? "";
    if (!numInmetro) return NextResponse.json({ error: "Nº do INMETRO é obrigatório." }, { status: 400 });

    const scopeError = await assertInventoryRowInManagerBase("extintores", body.extintor_id, manager.base_id);
    if (scopeError) return NextResponse.json({ error: scopeError }, { status: 403 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: ext } = await supabaseAdmin
      .from("extintores")
      .select("codigo,tipo,tamanho,capacidade_extintora")
      .eq("id", body.extintor_id)
      .eq("base_id", manager.base_id)
      .maybeSingle<{
        codigo: string;
        tipo: string;
        tamanho: string;
        capacidade_extintora: string;
      }>();

    const { data: est } = await supabaseAdmin
      .from("estoque_extintores")
      .select("id,tipo,tamanho,capacidade_extintora,quantidade")
      .eq("id", body.estoque_id)
      .eq("base_id", manager.base_id)
      .maybeSingle<{
        id: string;
        tipo: string;
        tamanho: string;
        capacidade_extintora: string;
        quantidade: number;
      }>();

    if (!est) return NextResponse.json({ error: "Item de estoque não encontrado." }, { status: 404 });

    const manut2 = body.manutencao_2_nivel?.trim() || null;
    const manut3 = body.manutencao_3_nivel?.trim() || null;
    const numCilindro = body.num_cilindro?.trim() || null;
    const conferente = (await actorNome(manager.id)) ?? "";

    const { error } = await supabaseAdmin.rpc("substituir_extintor_do_estoque" as never, {
      p_extintor_id: body.extintor_id,
      p_estoque_id: body.estoque_id,
      p_base_id: manager.base_id,
      p_actor_id: manager.id,
      p_actor_nome: conferente,
      p_num_inmetro: numInmetro,
      p_num_cilindro: numCilindro,
      p_manutencao_2_nivel: manut2,
      p_manutencao_3_nivel: manut3,
    } as never);

    if (error) {
      const msg = error.message.includes("substituir_extintor")
        ? "Função de substituição não encontrada. Execute docs/migration_estoque_substituicao.sql."
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const checklistResult = await insertChecklistAposSubstituicao({
      supabase: supabaseAdmin,
      extintorId: body.extintor_id,
      baseId: manager.base_id,
      conferente,
    });

    if (!checklistResult.ok) {
      return NextResponse.json(
        {
          error: `Equipamento substituído, mas falhou ao registrar checklist: ${checklistResult.error}`,
        },
        { status: 500 },
      );
    }

    await writeAuditLog({
      baseId: manager.base_id,
      actorId: manager.id,
      actorNome: conferente || null,
      actorRole: manager.role,
      action: "equipment_replace",
      entityType: "extintor",
      entityId: body.extintor_id,
      entityLabel: ext?.codigo ?? null,
      summary: `Substituiu equipamento no ponto ${ext?.codigo ?? body.extintor_id}`,
      details: {
        estoque_id: body.estoque_id,
        config: `${est.tipo} — ${est.tamanho}`,
        num_inmetro: numInmetro,
        num_cilindro: numCilindro,
        manutencao_2_nivel: manut2,
        manutencao_3_nivel: manut3,
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
