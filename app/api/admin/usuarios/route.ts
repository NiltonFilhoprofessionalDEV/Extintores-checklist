import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/auth/roles";
import { isMultiBaseRole } from "@/lib/auth/roles";
import {
  assertCanAssignRole,
  assertCanManageTarget,
  getManagerAccessibleBaseIds,
  getTargetProfile,
  getUserManagerFromRequest,
  replaceBaseMemberships,
  resolveBaseForWrite,
  resolveTeamForWrite,
} from "@/lib/auth/user-management-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

export async function GET(request: Request) {
  try {
    const manager = await getUserManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const supabaseAdmin = getSupabaseAdminClient();

    if (manager.role === "leadership") {
      if (!manager.team || !manager.base_id) {
        return NextResponse.json({ error: "Líder sem equipe/base definida." }, { status: 403 });
      }
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id,nome,role,team,active,base_id,created_at")
        .eq("role", "user")
        .eq("team", manager.team)
        .eq("base_id", manager.base_id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[admin/usuarios] GET leadership", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({
        users: data ?? [],
        managerRole: manager.role,
        managerTeam: manager.team,
        managerBaseId: manager.base_id,
      });
    }

    // Isolamento por base: admin vê a home base; corporativo vê a base ativa (ou a primeira acessível).
    let scopeBaseId: string | null = null;
    if (manager.role === "admin") {
      scopeBaseId = manager.base_id;
    } else if (manager.role === "admin_corporativo") {
      const accessibleBaseIds = await getManagerAccessibleBaseIds(manager);
      const requestedActive = request.headers.get("x-active-base-id")?.trim() || null;
      if (requestedActive && !accessibleBaseIds.includes(requestedActive)) {
        return NextResponse.json({ error: "Base fora do seu escopo de acesso." }, { status: 403 });
      }
      scopeBaseId =
        requestedActive && accessibleBaseIds.includes(requestedActive)
          ? requestedActive
          : (accessibleBaseIds[0] ?? null);
    }

    if (!scopeBaseId) {
      return NextResponse.json({ error: "Nenhuma base acessível para listar usuários." }, { status: 403 });
    }

    const { data: staffUsers, error: staffError } = await supabaseAdmin
      .from("profiles")
      .select("id,nome,role,team,active,base_id,created_at")
      .eq("base_id", scopeBaseId)
      .in("role", ["admin", "leadership", "user", "cliente"])
      .order("created_at", { ascending: false });
    if (staffError) {
      console.error("[admin/usuarios] GET staff", staffError);
      return NextResponse.json({ error: staffError.message }, { status: 400 });
    }

    // Admin corporativo: também lista outros admin_corporativo com membership NESTA base.
    let corpUsers: typeof staffUsers = [];
    if (manager.role === "admin_corporativo") {
      const { data: membershipUserIds, error: membershipError } = await supabaseAdmin
        .from("base_memberships")
        .select("user_id")
        .eq("base_id", scopeBaseId);
      if (membershipError) {
        console.error("[admin/usuarios] GET memberships", membershipError);
        return NextResponse.json({ error: membershipError.message }, { status: 400 });
      }
      const corpIds = [...new Set((membershipUserIds ?? []).map((row) => String(row.user_id)))];
      if (corpIds.length > 0) {
        const { data: corps, error: corpError } = await supabaseAdmin
          .from("profiles")
          .select("id,nome,role,team,active,base_id,created_at")
          .eq("role", "admin_corporativo")
          .in("id", corpIds)
          .order("created_at", { ascending: false });
        if (corpError) {
          console.error("[admin/usuarios] GET corporativo", corpError);
          return NextResponse.json({ error: corpError.message }, { status: 400 });
        }
        corpUsers = corps ?? [];
      }
    }

    const byId = new Map<string, (typeof staffUsers)[number]>();
    for (const user of [...(staffUsers ?? []), ...corpUsers]) {
      byId.set(String(user.id), user);
    }

    return NextResponse.json({
      users: Array.from(byId.values()),
      managerRole: manager.role,
      managerTeam: manager.team,
      managerBaseId: scopeBaseId,
      managerAccessibleBaseIds: [scopeBaseId],
    });
  } catch (error) {
    console.error("[admin/usuarios] GET", error);
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
      team?: string | null;
      base_ids?: string[];
    };

    const role = body.role ?? "user";
    const assignError = assertCanAssignRole(manager, role);
    if (assignError) return NextResponse.json({ error: assignError }, { status: 403 });

    const { team, error: teamError } = resolveTeamForWrite(manager, role, body.team);
    if (teamError) return NextResponse.json({ error: teamError }, { status: 400 });

    const { base_id, membershipBaseIds, error: baseError } = resolveBaseForWrite(
      manager,
      role,
      body.base_ids,
    );
    if (baseError) return NextResponse.json({ error: baseError }, { status: 400 });

    if (manager.role === "admin_corporativo") {
      const accessible = await getManagerAccessibleBaseIds(manager);
      const activeBaseId = request.headers.get("x-active-base-id")?.trim() || null;
      const requested = isMultiBaseRole(role) ? membershipBaseIds : base_id ? [base_id] : [];
      if (requested.some((id) => !accessible.includes(id))) {
        return NextResponse.json({ error: "Base fora do seu escopo de acesso." }, { status: 403 });
      }
      // Staff single-base: obrigatório na base ativa (isolamento entre aeroportos).
      if (!isMultiBaseRole(role)) {
        if (!activeBaseId) {
          return NextResponse.json({ error: "Base ativa obrigatória para criar usuários." }, { status: 400 });
        }
        if (!accessible.includes(activeBaseId)) {
          return NextResponse.json({ error: "Base fora do seu escopo de acesso." }, { status: 403 });
        }
        if (base_id !== activeBaseId) {
          return NextResponse.json(
            { error: "Usuários desta base só podem ser criados com a base ativa correspondente." },
            { status: 403 },
          );
        }
      }
    }

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
      team,
      base_id,
      active: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    if (isMultiBaseRole(role)) {
      try {
        await replaceBaseMemberships(createdUser.user.id, membershipBaseIds);
      } catch (membershipError) {
        await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
        return NextResponse.json(
          {
            error:
              membershipError instanceof Error
                ? membershipError.message
                : "Falha ao vincular bases do usuário.",
          },
          { status: 400 },
        );
      }
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
      team?: string | null;
      active: boolean;
      password?: string;
      base_ids?: string[];
    };

    const target = await getTargetProfile(body.id);
    if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    const activeBaseId = request.headers.get("x-active-base-id")?.trim() || null;
    const manageError = assertCanManageTarget(manager, target, activeBaseId);
    if (manageError) return NextResponse.json({ error: manageError }, { status: 403 });

    const assignError = assertCanAssignRole(manager, body.role);
    if (assignError) return NextResponse.json({ error: assignError }, { status: 403 });

    const { team, error: teamError } = resolveTeamForWrite(manager, body.role, body.team);
    if (teamError) return NextResponse.json({ error: teamError }, { status: 400 });

    const { base_id, membershipBaseIds, error: baseError } = resolveBaseForWrite(
      manager,
      body.role,
      body.base_ids,
    );
    if (baseError) return NextResponse.json({ error: baseError }, { status: 400 });

    if (manager.role === "admin_corporativo") {
      const accessible = await getManagerAccessibleBaseIds(manager);
      const requested = isMultiBaseRole(body.role) ? membershipBaseIds : base_id ? [base_id] : [];
      if (requested.some((id) => !accessible.includes(id))) {
        return NextResponse.json({ error: "Base fora do seu escopo de acesso." }, { status: 403 });
      }
      if (!isMultiBaseRole(body.role)) {
        if (!activeBaseId || !accessible.includes(activeBaseId)) {
          return NextResponse.json({ error: "Base ativa obrigatória para editar usuários." }, { status: 400 });
        }
        if (base_id !== activeBaseId) {
          return NextResponse.json(
            { error: "Não é permitido mover usuário para outra base por esta tela." },
            { status: 403 },
          );
        }
      }
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ nome: body.nome, role: body.role, team, base_id, active: body.active })
      .eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (isMultiBaseRole(body.role)) {
      await replaceBaseMemberships(body.id, membershipBaseIds);
    } else {
      await replaceBaseMemberships(body.id, []);
    }

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

    const activeBaseId = request.headers.get("x-active-base-id")?.trim() || null;
    const manageError = assertCanManageTarget(manager, target, activeBaseId);
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
