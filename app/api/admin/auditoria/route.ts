import { NextResponse } from "next/server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { getInventoryManagerFromRequest } from "@/lib/auth/inventory-management-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

export async function GET(request: Request) {
  try {
    const manager = await getInventoryManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    if (!isAdminLikeRole(manager.role)) {
      return NextResponse.json({ error: "Apenas administradores podem ver a auditoria." }, { status: 403 });
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
      .eq("base_id", manager.base_id)
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

    return NextResponse.json({ logs, base_id: manager.base_id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar auditoria." },
      { status: 500 },
    );
  }
}
