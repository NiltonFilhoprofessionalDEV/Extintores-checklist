import { getSupabaseClient } from "@/lib/supabase/client";
import {
  defaultQuestionsForKind,
  type ChecklistKind,
  type ChecklistQuestion,
} from "@/lib/checklist/default-questions";

export async function fetchChecklistQuestionsForBase(
  baseId: string | null | undefined,
  kind: ChecklistKind,
): Promise<ChecklistQuestion[]> {
  const defaults = defaultQuestionsForKind(kind);
  if (!baseId) return defaults;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("base_checklist_questions")
    .select("item_key,label,active,sort_order")
    .eq("base_id", baseId)
    .eq("kind", kind)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return defaults;

  // Base já customizou: a lista do banco é a fonte da verdade (inclui campos novos).
  return data
    .map((row, index) => ({
      item_key: String(row.item_key),
      label: String(row.label || "").trim() || `Pergunta ${index + 1}`,
      active: row.active !== false,
      sort_order: Number(row.sort_order ?? index),
    }))
    .filter((q) => q.active)
    .sort((a, b) => a.sort_order - b.sort_order);
}
