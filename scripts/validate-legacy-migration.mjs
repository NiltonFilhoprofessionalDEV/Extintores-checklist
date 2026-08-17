/**
 * Validação pós-migração Fase 4 — SOMENTE leitura.
 * Não faz upload, não faz UPDATE.
 *
 * Uso: node scripts/validate-legacy-migration.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import { isStorageImagePath } from "./lib/legacy-map-catalog.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Credenciais ausentes.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const EXECUTE_STARTED = "2026-08-17T17:06:03.214Z";

async function fetchAll(table, select, eq) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = supabase.from(table).select(select);
    if (eq) q = q.eq(eq.col, eq.val);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function objectPathFromPublicUrl(imagePath) {
  const marker = "/storage/v1/object/public/mapas/";
  const i = String(imagePath).indexOf(marker);
  if (i < 0) return null;
  return String(imagePath).slice(i + marker.length);
}

async function headOk(href) {
  try {
    const res = await fetch(href, { method: "HEAD" });
    return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type"), bytes: res.headers.get("content-length") };
  } catch (err) {
    return { ok: false, status: 0, error: String(err.message ?? err) };
  }
}

const { data: colsProbe, error: colsErr } = await supabase.from("hidrantes").select("*").limit(1);
if (colsErr) throw colsErr;
const hidranteColumns = colsProbe?.[0] ? Object.keys(colsProbe[0]).sort() : [];

const { data: base } = await supabase
  .from("bases")
  .select("id,slug,nome")
  .eq("slug", "santa-genoveva")
  .maybeSingle();

const floors = await fetchAll(
  "base_floors",
  "id,base_id,key,label,image_path,image_path_preview,image_width,image_height,legacy_migrated_at,needs_position_review,active",
);
const sgFloors = floors.filter((f) => f.base_id === base.id);
const migrated = floors.filter((f) => f.legacy_migrated_at);
const floorIds = new Set(floors.map((f) => f.id));

const hidAll = await fetchAll(
  "hidrantes",
  "id,codigo,base_id,pavimento,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id,updated_at,created_at,active",
);
const extAll = await fetchAll(
  "extintores",
  "id,codigo,base_id,pavimento,setor,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id,updated_at,active",
);

function stats(rows, baseId) {
  const focus = rows.filter((r) => r.base_id === baseId);
  const isValidNorm = (n) => {
    const v = Number(n);
    return Number.isFinite(v) && v >= 0 && v <= 1;
  };
  const withFloor = focus.filter((r) => r.floor_id);
  const withPixels = focus.filter((r) => r.coord_x != null && r.coord_y != null);
  const withNorm = focus.filter((r) => r.coord_x_norm != null && r.coord_y_norm != null);
  const noPos = focus.filter(
    (r) =>
      (r.coord_x == null || r.coord_y == null) && (r.coord_x_norm == null || r.coord_y_norm == null),
  );
  const orphan = withFloor.filter((r) => !floorIds.has(r.floor_id));
  const invalidNorm = withNorm.filter((r) => !isValidNorm(r.coord_x_norm) || !isValidNorm(r.coord_y_norm));
  const updatedDuringExecute = focus.filter((r) => r.updated_at && r.updated_at >= EXECUTE_STARTED);
  return {
    totalAllBases: rows.length,
    santaGenoveva: focus.length,
    withFloorId: withFloor.length,
    withoutFloorId: focus.length - withFloor.length,
    withPixels: withPixels.length,
    withNorm: withNorm.length,
    withoutPosition: noPos.length,
    orphanFloorId: orphan.length,
    invalidNorm: invalidNorm.length,
    updatedAtOrAfterExecute: updatedDuringExecute.length,
    updatedSamples: updatedDuringExecute.slice(0, 5).map((r) => ({ id: r.id, codigo: r.codigo, updated_at: r.updated_at })),
  };
}

const storageChecks = [];
for (const floor of migrated) {
  const origPath = objectPathFromPublicUrl(floor.image_path);
  const prevPath = objectPathFromPublicUrl(floor.image_path_preview);
  const origHead = floor.image_path ? await headOk(floor.image_path) : { ok: false, status: 0 };
  const prevHead = floor.image_path_preview ? await headOk(floor.image_path_preview) : { ok: false, status: 0 };
  let origInBucket = false;
  let prevInBucket = false;
  if (origPath) {
    const { data } = await supabase.storage.from("mapas").list(origPath.split("/").slice(0, -1).join("/"), {
      search: origPath.split("/").pop(),
    });
    origInBucket = (data ?? []).some((o) => o.name === origPath.split("/").pop());
  }
  if (prevPath) {
    const { data } = await supabase.storage.from("mapas").list(prevPath.split("/").slice(0, -1).join("/"), {
      search: prevPath.split("/").pop(),
    });
    prevInBucket = (data ?? []).some((o) => o.name === prevPath.split("/").pop());
  }
  storageChecks.push({
    key: floor.key,
    base_id: floor.base_id,
    image_path_storage: isStorageImagePath(floor.image_path),
    preview_storage: isStorageImagePath(floor.image_path_preview),
    legacy_migrated_at: floor.legacy_migrated_at,
    image_width: floor.image_width,
    image_height: floor.image_height,
    needs_position_review: floor.needs_position_review,
    original_head: origHead,
    preview_head: prevHead,
    original_in_bucket: origInBucket,
    preview_in_bucket: prevInBucket,
  });
}

const report = {
  hidranteColumns,
  hidrantesHasSetor: hidranteColumns.includes("setor"),
  floors: {
    total: floors.length,
    santaGenoveva: sgFloors.length,
    withLegacyMigratedAt: migrated.length,
    stillLegacyPath: floors.filter((f) => String(f.image_path).startsWith("/maps/")).length,
  },
  hidrantes: stats(hidAll, base.id),
  extintores: stats(extAll, base.id),
  migratedFloors: storageChecks,
};

console.log(JSON.stringify(report, null, 2));
