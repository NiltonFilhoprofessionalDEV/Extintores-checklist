import { NextResponse } from "next/server";
import { getAdminUserIdFromRequest } from "@/lib/auth/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

export async function GET(request: Request) {
  try {
    const adminId = await getAdminUserIdFromRequest(request);
    if (!adminId) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,nome,role,active,created_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ users: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno no carregamento de usuários." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const adminId = await getAdminUserIdFromRequest(request);
    if (!adminId) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as {
      email: string;
      password: string;
      nome: string;
      role: "admin" | "user";
    };

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });

    if (createError || !createdUser.user) {
      return NextResponse.json({ error: createError?.message ?? "Falha ao criar usuário." }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: createdUser.user.id,
      nome: body.nome,
      role: body.role,
      active: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao criar usuário." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const adminId = await getAdminUserIdFromRequest(request);
    if (!adminId) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as {
      id: string;
      nome: string;
      role: "admin" | "user";
      active: boolean;
    };

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ nome: body.nome, role: body.role, active: body.active })
      .eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao atualizar usuário." },
      { status: 500 },
    );
  }
}
