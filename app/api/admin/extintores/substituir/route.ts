import { NextResponse } from "next/server";
import {
  assertInventoryRowInManagerBase,
  getInventoryManagerFromRequest,
} from "@/lib/auth/inventory-management-server";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { insertChecklistAposSubstituicao } from "@/lib/checklist/substituicao-checklist";
import { extintorConfigsAreCompatible } from "@/lib/estoque/compatibility";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

type SubstituirBody = {
  extintor_id: string;
  source?: "estoque" | "direto";
  estoque_id?: string | null;
  tipo?: string;
  tamanho?: string;
  capacidade_extintora?: string;
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

    const body = (await request.json()) as SubstituirBody;
    if (!body.extintor_id) {
      return NextResponse.json({ error: "Extintor é obrigatório." }, { status: 400 });
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

    if (!ext) return NextResponse.json({ error: "Extintor não encontrado." }, { status: 404 });

    const manut2 = body.manutencao_2_nivel?.trim() || null;
    const manut3 = body.manutencao_3_nivel?.trim() || null;
    const numCilindro = body.num_cilindro?.trim() || null;
    const conferente = (await actorNome(manager.id)) ?? "";
    const estoqueId = body.estoque_id?.trim() || "";
    const isDireto = body.source === "direto" || !estoqueId;

    if (isDireto) {
      const tipo = body.tipo?.trim() ?? "";
      const tamanho = body.tamanho?.trim() ?? "";
      const capacidade = body.capacidade_extintora?.trim() ?? "";

      if (!tipo || !tamanho || !capacidade) {
        return NextResponse.json(
          { error: "Tipo, carga e capacidade extintora são obrigatórios na substituição direta." },
          { status: 400 },
        );
      }

      if (
        !extintorConfigsAreCompatible(
          {
            tipo: ext.tipo,
            tamanho: ext.tamanho,
            capacidade_extintora: ext.capacidade_extintora,
          },
          { tipo, tamanho, capacidade_extintora: capacidade },
        )
      ) {
        return NextResponse.json(
          { error: "Configuração informada incompatível com o ponto." },
          { status: 400 },
        );
      }

      const { error } = await supabaseAdmin.rpc("substituir_extintor_direto" as never, {
        p_extintor_id: body.extintor_id,
        p_base_id: manager.base_id,
        p_actor_id: manager.id,
        p_actor_nome: conferente,
        p_tipo: tipo,
        p_tamanho: tamanho,
        p_capacidade_extintora: capacidade,
        p_num_inmetro: numInmetro,
        p_num_cilindro: numCilindro,
        p_manutencao_2_nivel: manut2,
        p_manutencao_3_nivel: manut3,
      } as never);

      if (error) {
        const msg = error.message.includes("substituir_extintor_direto")
          ? "Função de substituição direta não encontrada. Execute docs/migration_substituir_direto.sql."
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
        entityLabel: ext.codigo ?? null,
        summary: `Substituiu equipamento (direto) no ponto ${ext.codigo ?? body.extintor_id}`,
        details: {
          source: "direto",
          config: `${tipo} — ${tamanho}`,
          capacidade_extintora: capacidade,
          num_inmetro: numInmetro,
          num_cilindro: numCilindro,
          manutencao_2_nivel: manut2,
          manutencao_3_nivel: manut3,
        },
      });

      return NextResponse.json({ ok: true });
    }

    const { data: est } = await supabaseAdmin
      .from("estoque_extintores")
      .select("id,tipo,tamanho,capacidade_extintora,quantidade")
      .eq("id", estoqueId)
      .eq("base_id", manager.base_id)
      .maybeSingle<{
        id: string;
        tipo: string;
        tamanho: string;
        capacidade_extintora: string;
        quantidade: number;
      }>();

    if (!est) return NextResponse.json({ error: "Item de estoque não encontrado." }, { status: 404 });

    const { error } = await supabaseAdmin.rpc("substituir_extintor_do_estoque" as never, {
      p_extintor_id: body.extintor_id,
      p_estoque_id: estoqueId,
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
      entityLabel: ext.codigo ?? null,
      summary: `Substituiu equipamento no ponto ${ext.codigo ?? body.extintor_id}`,
      details: {
        source: "estoque",
        estoque_id: estoqueId,
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
