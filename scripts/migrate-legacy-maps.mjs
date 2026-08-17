/**
 * Migração idempotente: public/maps → Supabase Storage + floor_id + coord norm.
 *
 * Uso:
 *   npm run maps:migrate-legacy -- --dry-run
 *   npm run maps:migrate-legacy -- --execute
 *   npm run maps:migrate-legacy -- --execute --base-slug=santa-genoveva
 *   npm run maps:migrate-legacy -- --execute --force   # re-upload / recalcular norms
 *
 * Requer: NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * Pré-requisito SQL: docs/fase4_migration_storage_bucket.sql
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import {
  LEGACY_BY_KEY,
  isLegacyImagePath,
  isStorageImagePath,
  legacyJpgAbsolutePath,
  pavimentoMatchesFloor,
  previewObjectPath,
  publicMapObjectUrl,
  storageObjectPath,
} from "./lib/legacy-map-catalog.mjs";

loadEnvLocal();

const ROOT = process.cwd();
const PREVIEW_MAX_SIDE = 4000;
const PREVIEW_QUALITY = 82;

function parseArgs(argv) {
  const args = {
    dryRun: true,
    force: false,
    baseSlug: null,
    reportPath: null,
  };
  for (const arg of argv) {
    if (arg === "--execute") args.dryRun = false;
    if (arg === "--dry-run") args.dryRun = true;
    if (arg === "--force") args.force = true;
    if (arg.startsWith("--base-slug=")) args.baseSlug = arg.slice("--base-slug=".length);
    if (arg.startsWith("--report=")) args.reportPath = arg.slice("--report=".length);
  }
  return args;
}

function env(name) {
  return process.env[name]?.trim() || null;
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

async function processMapBuffers(jpgBuffer) {
  const meta = await sharp(jpgBuffer).metadata();
  const width = meta.width ?? 14042;
  const height = meta.height ?? 9934;
  const maxSide = Math.max(width, height);

  let previewPipeline = sharp(jpgBuffer);
  if (maxSide > PREVIEW_MAX_SIDE) {
    previewPipeline = previewPipeline.resize({
      width: width >= height ? PREVIEW_MAX_SIDE : undefined,
      height: height > width ? PREVIEW_MAX_SIDE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const previewBuffer = await previewPipeline.webp({ quality: PREVIEW_QUALITY }).toBuffer();

  return {
    originalBuffer: jpgBuffer,
    originalContentType: "image/jpeg",
    previewBuffer,
    width,
    height,
  };
}

function coordsNeedReview(coordX, coordY, width, height) {
  if (coordX == null && coordY == null) return false;
  if (coordX == null || coordY == null) return true;
  const x = Number(coordX);
  const y = Number(coordY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  if (x < 0 || y < 0 || x > width || y > height) return true;
  return false;
}

function createReport() {
  return {
    startedAt: new Date().toISOString(),
    mode: null,
    floors: { scanned: 0, migrated: 0, skipped: 0, failed: 0, details: [] },
    storageBytesUploaded: 0,
    equipment: {
      extintores: { found: 0, alreadyComplete: 0, floorIdSet: 0, normSet: 0, reviewFlags: 0 },
      hidrantes: { found: 0, alreadyComplete: 0, floorIdSet: 0, normSet: 0, reviewFlags: 0 },
      marcadores: { found: 0, alreadyComplete: 0, floorIdSet: 0, normSet: 0, reviewFlags: 0 },
    },
    errors: [],
    finishedAt: null,
  };
}

async function uploadFloorImages(supabase, baseId, floorKey, processed, dryRun) {
  const originalPath = storageObjectPath(baseId, floorKey, "jpg");
  const previewPath = previewObjectPath(baseId, floorKey);
  let bytes = processed.originalBuffer.length + processed.previewBuffer.length;

  if (dryRun) {
    return {
      image_path: publicMapObjectUrl(env("NEXT_PUBLIC_SUPABASE_URL") ?? env("SUPABASE_URL"), originalPath),
      image_path_preview: publicMapObjectUrl(
        env("NEXT_PUBLIC_SUPABASE_URL") ?? env("SUPABASE_URL"),
        previewPath,
      ),
      image_width: processed.width,
      image_height: processed.height,
      bytes,
    };
  }

  const { error: oErr } = await supabase.storage.from("mapas").upload(originalPath, processed.originalBuffer, {
    contentType: processed.originalContentType,
    upsert: true,
  });
  if (oErr) throw oErr;

  const { error: pErr } = await supabase.storage.from("mapas").upload(previewPath, processed.previewBuffer, {
    contentType: "image/webp",
    upsert: true,
  });
  if (pErr) throw pErr;

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL") ?? env("SUPABASE_URL");
  return {
    image_path: publicMapObjectUrl(supabaseUrl, originalPath),
    image_path_preview: publicMapObjectUrl(supabaseUrl, previewPath),
    image_width: processed.width,
    image_height: processed.height,
    bytes,
  };
}

async function migrateEquipmentForFloor(supabase, floor, table, report, dryRun, force) {
  const selectCols =
    table === "marcadores_emergencia"
      ? "id,pavimento,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id"
      : "id,pavimento,setor,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id";

  const { data: rows, error } = await supabase
    .from(table)
    .select(selectCols)
    .eq("base_id", floor.base_id);

  if (error) {
    if (/coord_x_norm|floor_id|schema cache|column/i.test(error.message)) {
      report.errors.push({ table, floor_id: floor.id, message: `select ignorado: ${error.message}` });
      return false;
    }
    throw error;
  }

  const bucket =
    table === "extintores"
      ? report.equipment.extintores
      : table === "hidrantes"
        ? report.equipment.hidrantes
        : report.equipment.marcadores;

  let floorNeedsReview = false;

  for (const row of rows ?? []) {
    const updates = {};

    const matches =
      row.floor_id === floor.id ||
      (!row.floor_id && pavimentoMatchesFloor(row.pavimento, floor));

    if (!matches) continue;

    bucket.found += 1;

    if (!row.floor_id) {
      updates.floor_id = floor.id;
      bucket.floorIdSet += 1;
    }

    const w = floor.image_width;
    const h = floor.image_height;

    if (coordsNeedReview(row.coord_x, row.coord_y, w, h)) {
      floorNeedsReview = true;
    }

    const hasPixels = row.coord_x != null && row.coord_y != null;
    const hasNorm = row.coord_x_norm != null && row.coord_y_norm != null;

    if (hasPixels && (!hasNorm || force)) {
      const x = Number(row.coord_x);
      const y = Number(row.coord_y);
      if (Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0) {
        updates.coord_x_norm = clamp01(x / w);
        updates.coord_y_norm = clamp01(y / h);
        bucket.normSet += 1;
      }
    }

    if (Object.keys(updates).length === 0) {
      bucket.alreadyComplete += 1;
      continue;
    }

    if (!dryRun) {
      const { error: upErr } = await supabase.from(table).update(updates).eq("id", row.id);
      if (upErr) throw upErr;
    }
  }

  if (floorNeedsReview) bucket.reviewFlags += 1;
  return floorNeedsReview;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const report = createReport();
  report.mode = args.dryRun ? "dry-run" : "execute";

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL") ?? env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const now = new Date().toISOString();

  let basesQuery = supabase.from("bases").select("id,slug,nome").eq("active", true);
  if (args.baseSlug) basesQuery = basesQuery.eq("slug", args.baseSlug);
  const { data: bases, error: basesError } = await basesQuery;
  if (basesError) throw basesError;

  const baseIds = (bases ?? []).map((b) => b.id);
  if (baseIds.length === 0) {
    console.log("Nenhuma base encontrada.");
    return;
  }

  const { data: floors, error: floorsError } = await supabase
    .from("base_floors")
    .select(
      "id,base_id,key,label,image_path,image_path_preview,image_width,image_height,needs_position_review,legacy_migrated_at,active",
    )
    .in("base_id", baseIds)
    .eq("active", true);
  if (floorsError && /legacy_migrated_at|image_path_preview|schema cache|column/i.test(floorsError.message)) {
    console.error(
      "Colunas Fase 1/4 ausentes. Execute docs/migration_map_unified.sql e docs/fase4_migration_storage_bucket.sql",
    );
    process.exit(1);
  }
  if (floorsError) throw floorsError;

  for (const floor of floors ?? []) {
    report.floors.scanned += 1;
    const catalog = LEGACY_BY_KEY.get(floor.key);
    const legacyPath = isLegacyImagePath(floor.image_path);
    const alreadyStorage = isStorageImagePath(floor.image_path) && floor.legacy_migrated_at;

    if (!catalog && !legacyPath) {
      report.floors.skipped += 1;
      report.floors.details.push({ floor_id: floor.id, key: floor.key, action: "skip_not_legacy" });
      try {
        await migrateEquipmentForFloor(supabase, floor, "extintores", report, args.dryRun, args.force);
        await migrateEquipmentForFloor(supabase, floor, "hidrantes", report, args.dryRun, args.force);
        await migrateEquipmentForFloor(supabase, floor, "marcadores_emergencia", report, args.dryRun, args.force);
      } catch (err) {
        report.errors.push({ floor_id: floor.id, message: String(err?.message ?? err) });
      }
      continue;
    }

    if (alreadyStorage && !args.force) {
      report.floors.skipped += 1;
      report.floors.details.push({ floor_id: floor.id, key: floor.key, action: "skip_already_migrated" });
      // Ainda processar equipamentos pendentes
      try {
        let review = false;
        review = (await migrateEquipmentForFloor(supabase, floor, "extintores", report, args.dryRun, args.force)) || review;
        review = (await migrateEquipmentForFloor(supabase, floor, "hidrantes", report, args.dryRun, args.force)) || review;
        review = (await migrateEquipmentForFloor(supabase, floor, "marcadores_emergencia", report, args.dryRun, args.force)) || review;
        if (review && !args.dryRun) {
          await supabase.from("base_floors").update({ needs_position_review: true }).eq("id", floor.id);
        }
      } catch (err) {
        report.floors.failed += 1;
        report.errors.push({ floor_id: floor.id, message: String(err?.message ?? err) });
      }
      continue;
    }

    const imageBase = catalog?.imageBase ?? floor.image_path;
    const jpgPath = legacyJpgAbsolutePath(imageBase, ROOT);

    try {
      const jpgBuffer = await fs.readFile(jpgPath);
      const processed = await processMapBuffers(jpgBuffer);
      const uploaded = await uploadFloorImages(supabase, floor.base_id, floor.key, processed, args.dryRun);
      report.storageBytesUploaded += uploaded.bytes;

      const floorUpdates = {
        image_path: uploaded.image_path,
        image_path_preview: uploaded.image_path_preview,
        image_width: uploaded.image_width,
        image_height: uploaded.image_height,
        legacy_migrated_at: now,
      };

      if (!args.dryRun) {
        const { error: floorErr } = await supabase.from("base_floors").update(floorUpdates).eq("id", floor.id);
        if (floorErr) throw floorErr;
      }

      const floorForEquip = { ...floor, ...floorUpdates };
      let review = false;
      review = (await migrateEquipmentForFloor(supabase, floorForEquip, "extintores", report, args.dryRun, args.force)) || review;
      review = (await migrateEquipmentForFloor(supabase, floorForEquip, "hidrantes", report, args.dryRun, args.force)) || review;
      review = (await migrateEquipmentForFloor(supabase, floorForEquip, "marcadores_emergencia", report, args.dryRun, args.force)) || review;

      if (review) {
        floorUpdates.needs_position_review = true;
        if (!args.dryRun) {
          await supabase.from("base_floors").update({ needs_position_review: true }).eq("id", floor.id);
        }
      }

      report.floors.migrated += 1;
      report.floors.details.push({
        floor_id: floor.id,
        base_id: floor.base_id,
        key: floor.key,
        action: args.dryRun ? "would_migrate" : "migrated",
        image_path: uploaded.image_path,
        bytes: uploaded.bytes,
        needs_position_review: review,
      });
    } catch (err) {
      report.floors.failed += 1;
      report.errors.push({ floor_id: floor.id, key: floor.key, message: String(err?.message ?? err) });
      report.floors.details.push({ floor_id: floor.id, key: floor.key, action: "failed", error: String(err?.message ?? err) });
    }
  }

  report.finishedAt = new Date().toISOString();

  console.log(JSON.stringify(report, null, 2));
  console.log("\n--- Resumo ---");
  console.log(`Modo: ${report.mode}`);
  console.log(`Floors: migrados=${report.floors.migrated} ignorados=${report.floors.skipped} falhas=${report.floors.failed}`);
  console.log(`Storage (~): ${(report.storageBytesUploaded / 1024 / 1024).toFixed(2)} MB`);
  console.log("Extintores:", report.equipment.extintores);
  console.log("Hidrantes:", report.equipment.hidrantes);
  console.log("Marcadores:", report.equipment.marcadores);
  if (report.errors.length) console.log("Erros:", report.errors);

  if (args.reportPath) {
    await fs.writeFile(args.reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`Relatório salvo: ${args.reportPath}`);
  }

  if (report.floors.failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
