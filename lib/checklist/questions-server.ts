import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultQuestionsForKind,
  type ChecklistQuestion,
} from "@/lib/checklist/default-questions";

export async function fetchActiveExtintorQuestionsForBase(
  supabase: SupabaseClient,
  baseId: string,
): Promise<ChecklistQuestion[]> {
  const defaults = defaultQuestionsForKind("extintor").filter((q) => q.active);

  const { data, error } = await supabase
    .from("base_checklist_questions")
    .select("item_key,label,active,sort_order")
    .eq("base_id", baseId)
    .eq("kind", "extintor")
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return defaults;

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
