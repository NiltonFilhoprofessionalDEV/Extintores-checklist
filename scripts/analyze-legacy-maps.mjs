/**
 * Análise de mapas legados — NÃO altera dados.
 *
 * Uso:
 *   npm run maps:analyze-legacy
 *   node scripts/analyze-legacy-maps.mjs --base-slug=santa-genoveva
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import {
  LEGACY_FLOOR_MAPS,
  LEGACY_BY_KEY,
  isLegacyImagePath,
  isStorageImagePath,
  legacyJpgAbsolutePath,
  normalizeFloorText,
  pavimentoMatchesFloor,
} from "./lib/legacy-map-catalog.mjs";

const ROOT = process.cwd();

function parseArgs(argv) {
  const args = { baseSlug: null };
  for (const arg of argv) {
    if (arg.startsWith("--base-slug=")) args.baseSlug = arg.slice("--base-slug=".length);
  }
  return args;
}

function env(name) {
  const v = process.env[name]?.trim();
  return v || null;
}

async function analyzeLocalFiles() {
  const rows = [];
  let totalJpgBytes = 0;

  for (const entry of LEGACY_FLOOR_MAPS) {
    const jpgPath = legacyJpgAbsolutePath(entry.imageBase, ROOT);
    let exists = false;
    let bytes = 0;
    let width = null;
    let height = null;

    try {
      const stat = await fs.stat(jpgPath);
      exists = true;
      bytes = stat.size;
      totalJpgBytes += bytes;
      const meta = await sharp(jpgPath).metadata();
      width = meta.width;
      height = meta.height;
    } catch {
      exists = false;
    }

    rows.push({
      key: entry.key,
      label: entry.label,
      imageBase: entry.imageBase,
      jpgPath,
      jpgExists: exists,
      jpgBytes: bytes,
      width,
      height,
    });
  }

  return { rows, totalJpgBytes };
}

async function analyzeDatabase(baseSlug) {
  const url = env("NEXT_PUBLIC_SUPABASE_URL") ?? env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return { skipped: true, reason: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não definidos" };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let basesQuery = supabase.from("bases").select("id,slug,nome,active");
  if (baseSlug) basesQuery = basesQuery.eq("slug", baseSlug);
  const { data: bases, error: basesError } = await basesQuery;
  if (basesError) throw basesError;

  const baseIds = (bases ?? []).map((b) => b.id);
  if (baseIds.length === 0) {
    return { skipped: false, bases: [], floors: [], equipment: null };
  }

  const { data: floors, error: floorsError } = await supabase
    .from("base_floors")
    .select(
      "id,base_id,key,label,image_path,image_path_preview,image_width,image_height,needs_position_review,legacy_migrated_at,active",
    )
    .in("base_id", baseIds)
    .order("base_id")
    .order("sort_order");
  if (floorsError && /legacy_migrated_at|image_path_preview|schema cache|column/i.test(floorsError.message)) {
    const retry = await supabase
      .from("base_floors")
      .select("id,base_id,key,label,image_path,image_width,image_height,active")
      .in("base_id", baseIds);
    if (retry.error) throw retry.error;
    return buildEquipmentReport(supabase, bases, retry.data ?? [], baseIds, true);
  }
  if (floorsError) throw floorsError;

  return buildEquipmentReport(supabase, bases, floors ?? [], baseIds, false);
}

async function buildEquipmentReport(supabase, bases, floors, baseIds, legacySchema) {
  const extSelect = legacySchema
    ? "id,base_id,pavimento,setor,coord_x,coord_y,floor_id"
    : "id,base_id,pavimento,setor,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id";

  const [extRes, hidRes, marcRes] = await Promise.all([
    supabase.from("extintores").select(extSelect).in("base_id", baseIds).eq("active", true),
    supabase.from("hidrantes").select(extSelect.replace("setor,", "")).in("base_id", baseIds).eq("active", true),
    supabase.from("marcadores_emergencia").select("id,base_id,pavimento,coord_x,coord_y,floor_id").in("base_id", baseIds),
  ]);

  const floorRows = floors.map((f) => {
    const legacy = LEGACY_BY_KEY.get(f.key);
    const status = isStorageImagePath(f.image_path)
      ? "migrado_storage"
      : isLegacyImagePath(f.image_path)
        ? "legado_public_maps"
        : f.image_path?.trim()
          ? "outro_path"
          : "sem_planta";
    return {
      base_id: f.base_id,
      floor_id: f.id,
      key: f.key,
      label: f.label,
      image_path: f.image_path,
      status,
      legacy_migrated_at: f.legacy_migrated_at ?? null,
      needs_position_review: f.needs_position_review ?? false,
      catalogMatch: Boolean(legacy),
    };
  });

  function summarizeEquipment(rows, floorsList) {
    let positioned = 0;
    let withNorm = 0;
    let withFloorId = 0;
    let needsFloorMatch = 0;
    let incompleteCoords = 0;

    for (const row of rows ?? []) {
      const hasXY = row.coord_x != null && row.coord_y != null;
      if (hasXY) positioned += 1;
      if (row.coord_x_norm != null && row.coord_y_norm != null) withNorm += 1;
      if (row.floor_id) withFloorId += 1;
      else if (row.pavimento?.trim()) needsFloorMatch += 1;
      if ((row.coord_x != null && row.coord_y == null) || (row.coord_x == null && row.coord_y != null)) {
        incompleteCoords += 1;
      }
    }

    return {
      total: (rows ?? []).length,
      positioned,
      withNorm,
      withFloorId,
      needsFloorMatch,
      incompleteCoords,
    };
  }

  return {
    skipped: false,
    legacySchema,
    bases,
    floors: floorRows,
    equipment: {
      extintores: summarizeEquipment(extRes.data),
      hidrantes: summarizeEquipment(hidRes.data),
      marcadores: summarizeEquipment(marcRes.data),
    },
  };
}

function printReport(local, db, args) {
  console.log("=== Fase 4 — Análise mapas legados (sem alterações) ===\n");

  console.log("## Arquivos locais public/maps/");
  for (const row of local.rows) {
    const mb = (row.jpgBytes / 1024 / 1024).toFixed(2);
    console.log(
      `- ${row.key}: ${row.jpgExists ? `${row.width}×${row.height} ${mb} MB` : "FALTANDO"} (${row.jpgPath})`,
    );
  }
  console.log(`Total JPG local: ${(local.totalJpgBytes / 1024 / 1024).toFixed(2)} MB\n`);

  if (db.skipped) {
    console.log(`## Supabase: omitido (${db.reason})\n`);
    console.log("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para análise do banco.");
    return;
  }

  console.log("## Bases");
  for (const b of db.bases) {
    console.log(`- ${b.slug} (${b.id}) ${b.active ? "ativa" : "inativa"}`);
  }

  const pending = db.floors.filter((f) => f.status === "legado_public_maps");
  const migrated = db.floors.filter((f) => f.status === "migrado_storage");
  console.log(`\n## base_floors: ${db.floors.length} registros`);
  console.log(`- Migrados (Storage): ${migrated.length}`);
  console.log(`- Pendentes (/maps): ${pending.length}`);
  console.log(`- Outros: ${db.floors.length - migrated.length - pending.length}`);

  if (args.baseSlug) {
    console.log(`\nFiltro base-slug: ${args.baseSlug}`);
  }

  console.log("\n## Floors pendentes de migração");
  for (const f of pending) {
    console.log(`  [${f.base_id}] ${f.key} (${f.label}) → ${f.image_path}`);
  }

  console.log("\n## Equipamentos (ativos)");
  console.log("Extintores:", JSON.stringify(db.equipment.extintores));
  console.log("Hidrantes:", JSON.stringify(db.equipment.hidrantes));
  console.log("Marcadores:", JSON.stringify(db.equipment.marcadores));

  console.log("\n## Próximo passo");
  console.log("1. Executar docs/fase4_migration_storage_bucket.sql no Supabase");
  console.log("2. npm run maps:migrate-legacy -- --dry-run");
  console.log("3. npm run maps:migrate-legacy -- --execute");
  console.log("\nRelatório completo: docs/fase4_analise_migracao_mapas.md");
}

const args = parseArgs(process.argv.slice(2));
const local = await analyzeLocalFiles();
const db = await analyzeDatabase(args.baseSlug);
printReport(local, db, args);
