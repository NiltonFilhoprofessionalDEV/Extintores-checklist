import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type { UserRole } from "@/lib/auth/roles";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { processMapImageUpload } from "@/lib/map/map-image-processing";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FloorManager = {
  id: string;
  role: UserRole;
  base_id: string;
};

export async function getFloorManagerFromRequest(request: Request): Promise<FloorManager | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role,active,base_id")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: UserRole; active: boolean; base_id: string | null }>();

  if (profileError || !profile || !profile.active || !isAdminLikeRole(profile.role)) {
    return null;
  }

  if (profile.role === "admin_corporativo") {
    const activeBaseId = request.headers.get("x-active-base-id")?.trim() || null;
    if (!activeBaseId) return null;

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("base_memberships")
      .select("base_id")
      .eq("user_id", authData.user.id)
      .eq("base_id", activeBaseId)
      .maybeSingle<{ base_id: string }>();

    if (membershipError || !membership) return null;
    return { id: authData.user.id, role: profile.role, base_id: activeBaseId };
  }

  if (!profile.base_id) return null;
  return { id: authData.user.id, role: profile.role, base_id: profile.base_id };
}

export function slugifyFloorKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function publicMapObjectUrl(objectPath: string): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const base = raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/g, "");
  if (!base) return objectPath;
  return `${base}/storage/v1/object/public/mapas/${objectPath.replace(/^\/+/, "")}`;
}

export function extensionForMime(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

/** Valor persistido quando o setor ainda não tem planta enviada. */
export const FLOOR_NO_MAP_PATH = "";

export function floorHasMap(imagePath: string | null | undefined): boolean {
  const value = imagePath?.trim() ?? "";
  return value.length > 0;
}

export async function uploadMapImagesToStorage(
  supabaseAdmin: SupabaseClient,
  baseId: string,
  floorKey: string,
  fileBuffer: Buffer,
  contentType: string,
): Promise<{
  image_path: string;
  image_path_preview: string;
  image_width: number;
  image_height: number;
}> {
  const processed = await processMapImageUpload(fileBuffer, contentType);
  const ext = extensionForMime(contentType) ?? "jpg";
  const originalObjectPath = `${baseId}/${floorKey}.${ext}`;
  const previewObjectPath = `${baseId}/${floorKey}_preview.webp`;

  const { error: originalError } = await supabaseAdmin.storage
    .from("mapas")
    .upload(originalObjectPath, processed.originalBuffer, {
      contentType: processed.originalContentType,
      upsert: true,
    });
  if (originalError) throw originalError;

  const { error: previewError } = await supabaseAdmin.storage
    .from("mapas")
    .upload(previewObjectPath, processed.previewBuffer, {
      contentType: "image/webp",
      upsert: true,
    });
  if (previewError) throw previewError;

  return {
    image_path: publicMapObjectUrl(originalObjectPath),
    image_path_preview: publicMapObjectUrl(previewObjectPath),
    image_width: processed.width,
    image_height: processed.height,
  };
}

/** Equipamentos com posição no mapa deste setor (para aviso ao substituir planta). */
export async function countPositionedEquipmentOnFloor(
  supabaseAdmin: SupabaseClient,
  baseId: string,
  floorId: string,
  floorLabel: string,
): Promise<number> {
  const label = floorLabel.trim();
  let total = 0;

  const extByFloor = await supabaseAdmin
    .from("extintores")
    .select("id", { count: "exact", head: true })
    .eq("base_id", baseId)
    .eq("floor_id", floorId)
    .not("coord_x", "is", null)
    .not("coord_y", "is", null);
  if (!extByFloor.error) total += extByFloor.count ?? 0;

  const hidByFloor = await supabaseAdmin
    .from("hidrantes")
    .select("id", { count: "exact", head: true })
    .eq("base_id", baseId)
    .eq("floor_id", floorId)
    .not("coord_x", "is", null)
    .not("coord_y", "is", null);
  if (!hidByFloor.error) total += hidByFloor.count ?? 0;

  if (total > 0) return total;

  if (!label) return 0;

  const extByLabel = await supabaseAdmin
    .from("extintores")
    .select("id", { count: "exact", head: true })
    .eq("base_id", baseId)
    .is("floor_id", null)
    .ilike("pavimento", label)
    .not("coord_x", "is", null)
    .not("coord_y", "is", null);
  if (!extByLabel.error) total += extByLabel.count ?? 0;

  const hidByLabel = await supabaseAdmin
    .from("hidrantes")
    .select("id", { count: "exact", head: true })
    .eq("base_id", baseId)
    .is("floor_id", null)
    .ilike("pavimento", label)
    .not("coord_x", "is", null)
    .not("coord_y", "is", null);
  if (!hidByLabel.error) total += hidByLabel.count ?? 0;

  return total;
}
