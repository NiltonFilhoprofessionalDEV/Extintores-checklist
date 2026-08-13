import { getSupabaseClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/auth/roles";

export const ACTIVE_BASE_STORAGE_KEY = "firecheck-active-base";
export const SANTA_GENOVEVA_SLUG = "santa-genoveva";

export type BaseRecord = {
  id: string;
  slug: string;
  nome: string;
  active: boolean;
  config: Record<string, unknown> | null;
};

export type BaseFloor = {
  id: string;
  base_id: string;
  key: string;
  label: string;
  sort_order: number;
  image_path: string;
  image_path_preview: string | null;
  image_width: number;
  image_height: number;
  needs_position_review: boolean;
  active: boolean;
};

export type AccessibleBase = BaseRecord;

export function readStoredActiveBaseId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ACTIVE_BASE_STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function storeActiveBaseId(baseId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_BASE_STORAGE_KEY, baseId);
  } catch {
    // ignore quota / private mode
  }
}

export function resolveActiveBaseId(
  accessibleBases: AccessibleBase[],
  homeBaseId: string | null,
  role: UserRole,
): string | null {
  if (accessibleBases.length === 0) return null;

  const stored = readStoredActiveBaseId();
  if (stored && accessibleBases.some((b) => b.id === stored)) {
    return stored;
  }

  if (homeBaseId && accessibleBases.some((b) => b.id === homeBaseId)) {
    return homeBaseId;
  }

  if (role === "corporativo" || role === "admin_corporativo") {
    return accessibleBases[0]?.id ?? null;
  }

  return homeBaseId ?? accessibleBases[0]?.id ?? null;
}

export function baseHasEmpresaTabs(base: AccessibleBase | null | undefined): boolean {
  if (!base) return false;
  if (base.slug === SANTA_GENOVEVA_SLUG) return true;
  const config = base.config ?? {};
  return config.empresa_tabs === true;
}

export function baseHasEquipesConferencia(base: AccessibleBase | null | undefined): boolean {
  if (!base) return false;
  if (base.slug === SANTA_GENOVEVA_SLUG) return true;
  const config = base.config ?? {};
  return config.equipes_conferencia === true;
}

export async function fetchAccessibleBasesForUser(
  userId: string,
  homeBaseId: string | null,
): Promise<AccessibleBase[]> {
  const supabase = getSupabaseClient();
  const ids = new Set<string>();
  if (homeBaseId) ids.add(homeBaseId);

  const { data: memberships, error: membershipError } = await supabase
    .from("base_memberships")
    .select("base_id")
    .eq("user_id", userId);

  if (membershipError) throw membershipError;
  for (const row of memberships ?? []) {
    if (row.base_id) ids.add(String(row.base_id));
  }

  if (ids.size === 0) return [];

  const { data: bases, error: basesError } = await supabase
    .from("bases")
    .select("id,slug,nome,active,config")
    .in("id", Array.from(ids))
    .eq("active", true)
    .order("nome", { ascending: true });

  if (basesError) throw basesError;

  return (bases ?? []).map((base) => ({
    id: String(base.id),
    slug: String(base.slug),
    nome: String(base.nome),
    active: Boolean(base.active),
    config: (base.config as Record<string, unknown> | null) ?? {},
  }));
}

export async function fetchBaseFloors(baseId: string): Promise<BaseFloor[]> {
  const supabase = getSupabaseClient();
  const fullSelect =
    "id,base_id,key,label,sort_order,image_path,image_path_preview,image_width,image_height,needs_position_review,active";
  const legacySelect = "id,base_id,key,label,sort_order,image_path,image_width,image_height";

  let { data, error } = await supabase
    .from("base_floors")
    .select(fullSelect)
    .eq("base_id", baseId)
    .order("sort_order", { ascending: true });

  if (error && /image_path_preview|needs_position_review|active|schema cache|column/i.test(error.message)) {
    const retry = await supabase
      .from("base_floors")
      .select(legacySelect)
      .eq("base_id", baseId)
      .order("sort_order", { ascending: true });
    if (!retry.error) {
      data = retry.data as typeof data;
      error = retry.error;
    }
  }

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    base_id: String(row.base_id),
    key: String(row.key),
    label: String(row.label),
    sort_order: Number(row.sort_order ?? 0),
    image_path: String(row.image_path),
    image_path_preview:
      "image_path_preview" in row && row.image_path_preview
        ? String(row.image_path_preview)
        : null,
    image_width: Number(row.image_width ?? 14042),
    image_height: Number(row.image_height ?? 9934),
    needs_position_review:
      "needs_position_review" in row ? Boolean(row.needs_position_review ?? false) : false,
    active: "active" in row ? Boolean(row.active ?? true) : true,
  }));
}

/** Resolve image URL for a floor image_path (static /maps/..., URL pública ou path no bucket mapas). */
export function floorHasMap(imagePath: string | null | undefined): boolean {
  return Boolean(imagePath?.trim());
}

/** URL da planta para exibição — prefere preview otimizado quando disponível. */
export function resolveFloorDisplayImageUrl(
  imagePath: string,
  imagePathPreview?: string | null,
  preferWebp = true,
): string {
  if (imagePathPreview?.trim()) {
    return resolveFloorImageUrl(imagePathPreview, preferWebp);
  }
  return resolveFloorImageUrl(imagePath, preferWebp);
}

export function resolveFloorImageUrl(imagePath: string, preferWebp = true): string {
  if (!floorHasMap(imagePath)) return "";
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  if (imagePath.startsWith("/")) {
    // Já é arquivo estático completo (.webp/.jpg) ou base sem extensão
    if (/\.(webp|jpg|jpeg|png)$/i.test(imagePath)) return imagePath;
    return preferWebp ? `${imagePath}.webp` : `${imagePath}.jpg`;
  }
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const base = raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/g, "");
  if (!base) return imagePath;
  return `${base}/storage/v1/object/public/mapas/${imagePath.replace(/^\/+/, "")}`;
}
