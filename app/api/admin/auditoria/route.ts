import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole } from "@/lib/auth/roles";

async function resolveCorporativoAuditor(
  request: Request,
): Promise<{ id: string; baseId: string } | { error: string; status: number }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Não autorizado.", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { error: "Não autorizado.", status: 401 };

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return { error: "Não autorizado.", status: 401 };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role,active")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: UserRole; active: boolean }>();

  if (profileError || !profile || !profile.active) {
    return { error: "Não autorizado.", status: 401 };
  }

  if (profile.role !== "admin_corporativo") {
    return {
      error: "Apenas administradores corporativos podem ver a auditoria.",
      status: 403,
    };
  }

  const url = new URL(request.url);
  const requestedBaseId =
    url.searchParams.get("base_id")?.trim() ||
    request.headers.get("x-active-base-id")?.trim() ||
    "";

  if (!requestedBaseId) {
    return { error: "Selecione uma base para ver a auditoria.", status: 400 };
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("base_memberships")
    .select("base_id")
    .eq("user_id", authData.user.id)
    .eq("base_id", requestedBaseId)
    .maybeSingle<{ base_id: string }>();

  if (membershipError || !membership) {
    return { error: "Sem acesso à base selecionada.", status: 403 };
  }

  return { id: authData.user.id, baseId: requestedBaseId };
}

export async function GET(request: Request) {
  try {
    const auditor = await resolveCorporativoAuditor(request);
    if ("error" in auditor) {
      return NextResponse.json({ error: auditor.error }, { status: auditor.status });
    }

    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 300) : 100;
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const action = (url.searchParams.get("action") ?? "").trim();

    const supabaseAdmin = getSupabaseAdminClient();
    let query = supabaseAdmin
      .from("audit_logs")
      .select(
        "id,base_id,actor_id,actor_nome,actor_role,action,entity_type,entity_id,entity_label,summary,details,created_at",
      )
      .eq("base_id", auditor.baseId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (action) query = query.eq("action", action);

    const { data, error } = await query;
    if (error) {
      const msg = error.message.includes("audit_logs")
        ? "Tabela de auditoria não existe. Execute docs/migration_soft_delete_auditoria.sql."
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    let logs = data ?? [];
    if (q) {
      logs = logs.filter((row) => {
        const blob = [
          row.summary,
          row.actor_nome,
          row.entity_label,
          row.action,
          row.entity_type,
        ]
          .map((v) => String(v ?? "").toLowerCase())
          .join(" ");
        return blob.includes(q);
      });
    }

    return NextResponse.json({ logs, base_id: auditor.baseId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar auditoria." },
      { status: 500 },
    );
  }
}
