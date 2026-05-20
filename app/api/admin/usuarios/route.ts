import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/auth/roles";
import {
  assertCanAssignRole,
  assertCanManageTarget,
  getTargetProfile,
  getUserManagerFromRequest,
} from "@/lib/auth/user-management-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

export async function GET(request: Request) {
  try {
    const manager = await getUserManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,nome,role,active,created_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ users: data ?? [], managerRole: manager.role });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno no carregamento de usuários." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const manager = await getUserManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as {
      email: string;
      password: string;
      nome: string;
      role: UserRole;
    };

    const role = body.role ?? "user";
    const assignError = assertCanAssignRole(manager, role);
    if (assignError) return NextResponse.json({ error: assignError }, { status: 403 });

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
      role,
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
    const manager = await getUserManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as {
      id: string;
      nome: string;
      role: UserRole;
      active: boolean;
      password?: string;
    };

    const target = await getTargetProfile(body.id);
    if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    const manageError = assertCanManageTarget(manager, target.role);
    if (manageError) return NextResponse.json({ error: manageError }, { status: 403 });

    const assignError = assertCanAssignRole(manager, body.role);
    if (assignError) return NextResponse.json({ error: assignError }, { status: 403 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ nome: body.nome, role: body.role, active: body.active })
      .eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (body.password && body.password.length >= 6) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(body.id, {
        password: body.password,
      });
      if (passwordError) {
        return NextResponse.json({ error: passwordError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao atualizar usuário." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const manager = await getUserManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as { id: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    if (body.id === manager.id) {
      return NextResponse.json({ error: "Você não pode excluir sua própria conta." }, { status: 400 });
    }

    const target = await getTargetProfile(body.id);
    if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    const manageError = assertCanManageTarget(manager, target.role);
    if (manageError) return NextResponse.json({ error: manageError }, { status: 403 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(body.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao excluir usuário." },
      { status: 500 },
    );
  }
}
