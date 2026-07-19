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

  const byKey = new Map(data.map((row) => [String(row.item_key), row]));
  return defaults
    .map((fallback, index) => {
      const row = byKey.get(fallback.item_key);
      if (!row) return { ...fallback, sort_order: index };
      return {
        item_key: fallback.item_key,
        label: String(row.label || fallback.label),
        active: row.active !== false,
        sort_order: Number(row.sort_order ?? index),
      };
    })
    .filter((q) => q.active)
    .sort((a, b) => a.sort_order - b.sort_order);
}
