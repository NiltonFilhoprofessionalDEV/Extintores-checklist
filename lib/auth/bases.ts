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
  image_width: number;
  image_height: number;
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
  const { data, error } = await supabase
    .from("base_floors")
    .select("id,base_id,key,label,sort_order,image_path,image_width,image_height")
    .eq("base_id", baseId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    base_id: String(row.base_id),
    key: String(row.key),
    label: String(row.label),
    sort_order: Number(row.sort_order ?? 0),
    image_path: String(row.image_path),
    image_width: Number(row.image_width ?? 14042),
    image_height: Number(row.image_height ?? 9934),
  }));
}

/** Resolve image URL for a floor image_path (static /maps/... or Storage path). */
export function resolveFloorImageUrl(imagePath: string, preferWebp = true): string {
  if (!imagePath) return "";
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  if (imagePath.startsWith("/")) {
    return preferWebp ? `${imagePath}.webp` : `${imagePath}.jpg`;
  }
  // Storage-relative path: callers that use Storage should pass a full public URL.
  return imagePath;
}
