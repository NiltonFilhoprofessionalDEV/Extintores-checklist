import { NextResponse } from "next/server";
import {
  createBaseWithAdmin,
  deleteBase,
  requireAdminCorporativo,
  updateBase,
  type CreateBaseInput,
} from "@/lib/auth/base-management-server";
import { getManagerAccessibleBaseIds } from "@/lib/auth/user-management-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

export async function GET(request: Request) {
  try {
    const manager = await requireAdminCorporativo(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const supabaseAdmin = getSupabaseAdminClient();
    const baseIds = await getManagerAccessibleBaseIds(manager);

    let basesQuery = supabaseAdmin
      .from("bases")
      .select("id,slug,nome,active,config,created_at")
      .order("nome", { ascending: true });

    if (baseIds.length > 0) {
      basesQuery = basesQuery.in("id", baseIds);
    } else {
      return NextResponse.json({ bases: [], candidateAdmins: [] });
    }

    const { data: bases, error: basesError } = await basesQuery;
    if (basesError) {
      console.error("[admin/bases] GET bases", basesError);
      return NextResponse.json({ error: basesError.message }, { status: 400 });
    }

    const { data: staff, error: staffError } = await supabaseAdmin
      .from("profiles")
      .select("id,nome,role,base_id,active")
      .in("base_id", baseIds)
      .in("role", ["admin", "leadership", "user", "cliente"])
      .eq("active", true)
      .order("nome", { ascending: true });
    if (staffError) {
      console.error("[admin/bases] GET staff", staffError);
      return NextResponse.json({ error: staffError.message }, { status: 400 });
    }

    return NextResponse.json({
      bases: bases ?? [],
      candidateAdmins: staff ?? [],
    });
  } catch (error) {
    console.error("[admin/bases] GET", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar bases." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const manager = await requireAdminCorporativo(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as {
      nome?: string;
      slug?: string;
      empresa_tabs?: boolean;
      equipes_conferencia?: boolean;
      admin_mode?: "create" | "existing";
      admin_nome?: string;
      admin_email?: string;
      admin_password?: string;
      admin_user_id?: string;
    };

    const adminMode = body.admin_mode === "existing" ? "existing" : "create";
    const input: CreateBaseInput = {
      nome: body.nome ?? "",
      slug: body.slug,
      empresa_tabs: body.empresa_tabs,
      equipes_conferencia: body.equipes_conferencia,
      admin:
        adminMode === "create"
          ? {
              mode: "create",
              nome: body.admin_nome ?? "",
              email: body.admin_email ?? "",
              password: body.admin_password ?? "",
            }
          : {
              mode: "existing",
              user_id: body.admin_user_id ?? "",
            },
    };

    if (adminMode === "existing" && !body.admin_user_id) {
      return NextResponse.json({ error: "Selecione o administrador da base." }, { status: 400 });
    }

    const result = await createBaseWithAdmin(manager, input);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      base_id: result.base_id,
      slug: result.slug,
      admin_user_id: result.admin_user_id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar base." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const manager = await requireAdminCorporativo(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as {
      id?: string;
      nome?: string;
      slug?: string;
      active?: boolean;
      empresa_tabs?: boolean;
      equipes_conferencia?: boolean;
    };

    if (!body.id?.trim()) {
      return NextResponse.json({ error: "ID da base é obrigatório." }, { status: 400 });
    }

    const result = await updateBase(manager, {
      id: body.id,
      nome: body.nome,
      slug: body.slug,
      active: body.active,
      empresa_tabs: body.empresa_tabs,
      equipes_conferencia: body.equipes_conferencia,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, base: result.base });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar base." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const manager = await requireAdminCorporativo(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as {
      id?: string;
      confirm_name?: string;
    };

    if (!body.id?.trim()) {
      return NextResponse.json({ error: "ID da base é obrigatório." }, { status: 400 });
    }

    const result = await deleteBase(manager, {
      id: body.id,
      confirm_name: body.confirm_name ?? "",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir base." },
      { status: 500 },
    );
  }
}
