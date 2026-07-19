import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserManager } from "@/lib/auth/user-management-server";
import { getManagerAccessibleBaseIds, getUserManagerFromRequest } from "@/lib/auth/user-management-server";

export async function requireAdminCorporativo(request: Request): Promise<UserManager | null> {
  const manager = await getUserManagerFromRequest(request);
  if (!manager || manager.role !== "admin_corporativo") return null;
  return manager;
}

export function slugifyBaseName(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type CreateBaseInput = {
  nome: string;
  slug?: string;
  empresa_tabs?: boolean;
  equipes_conferencia?: boolean;
  admin:
    | {
        mode: "create";
        nome: string;
        email: string;
        password: string;
      }
    | {
        mode: "existing";
        user_id: string;
      };
};

export type CreateBaseResult =
  | { ok: true; base_id: string; slug: string; admin_user_id: string }
  | { ok: false; error: string; status: number };

export async function createBaseWithAdmin(
  manager: UserManager,
  input: CreateBaseInput,
): Promise<CreateBaseResult> {
  const nome = input.nome.trim();
  if (!nome) return { ok: false, error: "Informe o nome da base.", status: 400 };

  const slug = (input.slug?.trim() ? slugifyBaseName(input.slug) : slugifyBaseName(nome)) || "";
  if (!slug) return { ok: false, error: "Slug inválido.", status: 400 };

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: existingSlug } = await supabaseAdmin
    .from("bases")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existingSlug) {
    return { ok: false, error: "Já existe uma base com este slug.", status: 400 };
  }

  const config = {
    empresa_tabs: Boolean(input.empresa_tabs),
    equipes_conferencia: Boolean(input.equipes_conferencia),
  };

  const { data: base, error: baseError } = await supabaseAdmin
    .from("bases")
    .insert({
      slug,
      nome,
      active: true,
      config,
    })
    .select("id,slug")
    .single<{ id: string; slug: string }>();

  if (baseError || !base) {
    return { ok: false, error: baseError?.message ?? "Falha ao criar a base.", status: 400 };
  }

  const baseId = String(base.id);

  // Mapas/setores são cadastrados depois em /admin/configuracoes (com upload da planta).

  // Corporativo criador ganha acesso à nova base
  const { error: membershipSelfError } = await supabaseAdmin.from("base_memberships").upsert(
    { user_id: manager.id, base_id: baseId },
    { onConflict: "user_id,base_id" },
  );
  if (membershipSelfError) {
    await supabaseAdmin.from("bases").delete().eq("id", baseId);
    return { ok: false, error: membershipSelfError.message, status: 400 };
  }

  let adminUserId: string;

  if (input.admin.mode === "create") {
    const adminNome = input.admin.nome.trim();
    const email = input.admin.email.trim().toLowerCase();
    const password = input.admin.password;
    if (!adminNome || !email || password.length < 6) {
      await supabaseAdmin.from("bases").delete().eq("id", baseId);
      return {
        ok: false,
        error: "Dados do administrador inválidos (nome, e-mail e senha com 6+ caracteres).",
        status: 400,
      };
    }

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !createdUser.user) {
      await supabaseAdmin.from("bases").delete().eq("id", baseId);
      return { ok: false, error: createError?.message ?? "Falha ao criar administrador.", status: 400 };
    }

    adminUserId = createdUser.user.id;
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: adminUserId,
      nome: adminNome,
      role: "admin",
      team: null,
      base_id: baseId,
      active: true,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(adminUserId);
      await supabaseAdmin.from("bases").delete().eq("id", baseId);
      return { ok: false, error: profileError.message, status: 400 };
    }
  } else {
    adminUserId = input.admin.user_id;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,role,base_id,active")
      .eq("id", adminUserId)
      .maybeSingle<{ id: string; role: string; base_id: string | null; active: boolean }>();

    if (profileError || !profile || !profile.active) {
      await supabaseAdmin.from("bases").delete().eq("id", baseId);
      return { ok: false, error: "Usuário selecionado não encontrado.", status: 404 };
    }

    if (profile.role === "admin_corporativo" || profile.role === "corporativo") {
      await supabaseAdmin.from("bases").delete().eq("id", baseId);
      return {
        ok: false,
        error: "Selecione um usuário de base (não corporativo) para ser o administrador.",
        status: 400,
      };
    }

    // Se já tem base, só permite se estiver no escopo do corporativo
    if (profile.base_id) {
      const accessible = await getManagerAccessibleBaseIds(manager);
      if (!accessible.includes(profile.base_id) && profile.base_id !== baseId) {
        await supabaseAdmin.from("bases").delete().eq("id", baseId);
        return {
          ok: false,
          error: "Sem permissão para reatribuir este usuário de outra base.",
          status: 403,
        };
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: "admin", team: null, base_id: baseId, active: true })
      .eq("id", adminUserId);
    if (updateError) {
      await supabaseAdmin.from("bases").delete().eq("id", baseId);
      return { ok: false, error: updateError.message, status: 400 };
    }

    await supabaseAdmin.from("base_memberships").delete().eq("user_id", adminUserId);
  }

  return { ok: true, base_id: baseId, slug: String(base.slug), admin_user_id: adminUserId };
}
