import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole } from "@/lib/auth/roles";
import { ROLE_LABELS } from "@/lib/auth/roles";

export type AuditAction =
  | "create"
  | "update"
  | "soft_delete"
  | "restore"
  | "map_place"
  | "map_remove"
  | "checklist"
  | "import"
  | "user_create"
  | "user_update"
  | "user_delete"
  | "config"
  | "equipment_remove"
  | "equipment_remove_batch"
  | "equipment_replace"
  | "equipment_restore"
  | "stock_update";

export type AuditEntityType =
  | "extintor"
  | "hidrante"
  | "usuario"
  | "checklist"
  | "checklist_hidrante"
  | "mapa"
  | "base"
  | "importacao"
  | "configuracao"
  | "estoque";

export type WriteAuditLogInput = {
  baseId?: string | null;
  actorId?: string | null;
  actorNome?: string | null;
  actorRole?: UserRole | string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  details?: Record<string, unknown>;
};

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      base_id: input.baseId ?? null,
      actor_id: input.actorId ?? null,
      actor_nome: input.actorNome?.trim() || null,
      actor_role: input.actorRole ? String(input.actorRole) : null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      summary: input.summary.trim(),
      details: input.details ?? {},
    });
    if (error) {
      console.error("[audit_logs]", error.message);
    }
  } catch (error) {
    console.error("[audit_logs]", error);
  }
}

export function roleLabelPt(role: string | null | undefined): string {
  if (!role) return "Usuário";
  return ROLE_LABELS[role as UserRole] ?? role;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "Cadastrou",
  update: "Alterou",
  soft_delete: "Removeu da lista (inativou)",
  restore: "Recuperou",
  map_place: "Posicionou no mapa",
  map_remove: "Removeu do mapa",
  checklist: "Fez inspeção",
  import: "Importou dados",
  user_create: "Criou usuário",
  user_update: "Alterou usuário",
  user_delete: "Excluiu usuário",
  config: "Alterou configuração",
  equipment_remove: "Retirou equipamento para manutenção",
  equipment_remove_batch: "Criou lista de manutenção em lote",
  equipment_replace: "Substituiu equipamento",
  equipment_restore: "Cancelou retirada e restaurou equipamento",
  stock_update: "Alterou estoque",
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  extintor: "Extintor",
  hidrante: "Hidrante",
  usuario: "Usuário",
  checklist: "Checklist de extintor",
  checklist_hidrante: "Checklist de hidrante",
  mapa: "Mapa / setor",
  base: "Base",
  importacao: "Importação",
  configuracao: "Configuração",
  estoque: "Estoque de extintores",
};

/** Frase que o administrador deve digitar para confirmar a remoção (soft-delete). */
export const SOFT_DELETE_CONFIRM_PHRASE = "QUERO APAGAR ESTES ITENS";
