/**
 * Diagnóstico SOMENTE LEITURA — equipamentos vs dry-run da Fase 4.
 * Não altera dados, não faz upload.
 *
 * Uso:
 *   npm run maps:diagnose-equipment
 *   node scripts/diagnose-equipment-migration.mjs
 *   node scripts/diagnose-equipment-migration.mjs --base-slug=santa-genoveva
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import { normalizeFloorText, pavimentoMatchesFloor } from "./lib/legacy-map-catalog.mjs";

loadEnvLocal();

function parseArgs(argv) {
  const args = { baseSlug: "santa-genoveva" };
  for (const arg of argv) {
    if (arg.startsWith("--base-slug=")) args.baseSlug = arg.slice("--base-slug=".length) || null;
    if (arg === "--all-bases") args.baseSlug = null;
  }
  return args;
}

function env(name) {
  return process.env[name]?.trim() || null;
}

function isValidNorm(n) {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 && v <= 1;
}

async function fetchAll(supabase, table, select, filters = {}) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = supabase.from(table).select(select);
    if (filters.baseId) q = q.eq("base_id", filters.baseId);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function summarize(rows, floorsList) {
  const floorsById = new Map(floorsList.map((f) => [f.id, f]));
  const total = rows.length;
  let withFloorId = 0;
  let withoutFloorId = 0;
  let withPixels = 0;
  let withNorm = 0;
  let pixelsWithoutNorm = 0;
  let withoutPosition = 0;
  let incompleteCoords = 0;
  let invalidNorm = 0;
  let floorIdOrphan = 0;
  let floorIdMatchesFloor = 0;
  let pavimentoMismatch = 0;
  let unmatchedNoFloor = 0;
  let wouldSetFloorId = 0;
  let wouldSetNorm = 0;
  let alreadyComplete = 0;

  const byFloor = new Map();
  for (const floor of floorsList) {
    byFloor.set(floor.id, {
      floor_id: floor.id,
      key: floor.key,
      label: floor.label,
      count: 0,
      withFloorId: 0,
      withNorm: 0,
      withoutPosition: 0,
      invalidNorm: 0,
      pavimentoMismatch: 0,
    });
  }
  const semFloor = {
    floor_id: null,
    key: null,
    label: "(sem floor_id)",
    count: 0,
    withFloorId: 0,
    withNorm: 0,
    withoutPosition: 0,
    invalidNorm: 0,
    pavimentoMismatch: 0,
  };
  byFloor.set("__sem__", semFloor);

  const unmatchedPavimentos = new Map();
  const mismatchSamples = [];

  for (const row of rows) {
    const hasFloor = Boolean(row.floor_id);
    const hasPixels = row.coord_x != null && row.coord_y != null;
    const hasNorm = row.coord_x_norm != null && row.coord_y_norm != null;
    const hasAnyPos = hasPixels || hasNorm;
    const floor = hasFloor ? floorsById.get(row.floor_id) : null;

    if (hasFloor) withFloorId += 1;
    else withoutFloorId += 1;
    if (hasPixels) withPixels += 1;
    if (hasNorm) withNorm += 1;
    if (hasPixels && !hasNorm) pixelsWithoutNorm += 1;
    if (!hasAnyPos) withoutPosition += 1;
    if ((row.coord_x != null && row.coord_y == null) || (row.coord_x == null && row.coord_y != null)) {
      incompleteCoords += 1;
    }
    if (hasNorm && (!isValidNorm(row.coord_x_norm) || !isValidNorm(row.coord_y_norm))) {
      invalidNorm += 1;
    }

    if (hasFloor && floor) {
      floorIdMatchesFloor += 1;
      const pav = row.pavimento?.trim();
      if (pav && !pavimentoMatchesFloor(pav, floor)) {
        pavimentoMismatch += 1;
        if (mismatchSamples.length < 15) {
          mismatchSamples.push({
            id: row.id,
            codigo: row.codigo ?? null,
            pavimento: row.pavimento,
            floor_label: floor.label,
            floor_key: floor.key,
          });
        }
      }
    } else if (hasFloor) {
      floorIdOrphan += 1;
    }

    const bucket = floor ? byFloor.get(floor.id) : semFloor;
    bucket.count += 1;
    if (hasFloor) bucket.withFloorId += 1;
    if (hasNorm) bucket.withNorm += 1;
    if (!hasAnyPos) bucket.withoutPosition += 1;
    if (hasNorm && (!isValidNorm(row.coord_x_norm) || !isValidNorm(row.coord_y_norm))) {
      bucket.invalidNorm += 1;
    }

    if (!hasFloor) {
      const pav = normalizeFloorText(row.pavimento) || "(pavimento vazio)";
      unmatchedPavimentos.set(pav, (unmatchedPavimentos.get(pav) ?? 0) + 1);
      const matched = floorsList.find((f) => pavimentoMatchesFloor(row.pavimento, f));
      if (!matched) unmatchedNoFloor += 1;
    }

    let matchedFloor = null;
    if (row.floor_id && floorsById.has(row.floor_id)) matchedFloor = floorsById.get(row.floor_id);
    else if (!row.floor_id) matchedFloor = floorsList.find((f) => pavimentoMatchesFloor(row.pavimento, f)) ?? null;

    if (!matchedFloor) continue;
    const wouldFloor = !row.floor_id;
    const wouldNorm = hasPixels && !hasNorm;
    if (wouldFloor) wouldSetFloorId += 1;
    if (wouldNorm) wouldSetNorm += 1;
    if (!wouldFloor && !wouldNorm) alreadyComplete += 1;
  }

  return {
    total,
    withFloorId,
    withoutFloorId,
    withPixels,
    withNorm,
    pixelsWithoutNorm,
    withoutPosition,
    incompleteCoords,
    invalidNorm,
    floorIdMatchesFloor,
    floorIdOrphan,
    pavimentoMismatch,
    unmatchedNoFloor,
    wouldSetFloorId,
    wouldSetNorm,
    alreadyComplete,
    byFloor: [...byFloor.values()].sort((a, b) => b.count - a.count),
    unmatchedPavimentos: [...unmatchedPavimentos.entries()]
      .map(([pavimento, count]) => ({ pavimento, count }))
      .sort((a, b) => b.count - a.count),
    mismatchSamples,
  };
}

function printKind(title, stats) {
  console.log(`\n## ${title}`);
  console.log(`- total: ${stats.total}`);
  console.log(`- com floor_id: ${stats.withFloorId}`);
  console.log(`- sem floor_id: ${stats.withoutFloorId}`);
  console.log(`- com coord_x + coord_y: ${stats.withPixels}`);
  console.log(`- com coord_x_norm + coord_y_norm: ${stats.withNorm}`);
  console.log(`- pixels sem norm: ${stats.pixelsWithoutNorm}`);
  console.log(`- sem posição: ${stats.withoutPosition}`);
  console.log(`- coords incompletas: ${stats.incompleteCoords}`);
  console.log(`- norm inválida (fora de 0–1): ${stats.invalidNorm}`);
  console.log(`- floor_id válido na base: ${stats.floorIdMatchesFloor}`);
  console.log(`- floor_id órfão: ${stats.floorIdOrphan}`);
  console.log(`- pavimento ≠ floor associado: ${stats.pavimentoMismatch}`);
  console.log(`- sem floor_id e sem match de pavimento: ${stats.unmatchedNoFloor}`);
  console.log(`- dry-run wouldSetFloorId: ${stats.wouldSetFloorId}`);
  console.log(`- dry-run wouldSetNorm: ${stats.wouldSetNorm}`);
  console.log(`- já completos (skip no dry-run): ${stats.alreadyComplete}`);
}

const args = parseArgs(process.argv.slice(2));
const url = env("NEXT_PUBLIC_SUPABASE_URL") ?? env("SUPABASE_URL");
const key = env("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: allBases, error: basesErr } = await supabase
  .from("bases")
  .select("id,slug,nome,active")
  .order("nome");
if (basesErr) throw basesErr;

const focus = args.baseSlug
  ? (allBases ?? []).find((b) => b.slug === args.baseSlug)
  : null;
if (args.baseSlug && !focus) {
  console.error(`Base slug não encontrada: ${args.baseSlug}`);
  process.exit(1);
}

const { data: allFloors, error: floorsErr } = await supabase
  .from("base_floors")
  .select("id,base_id,key,label,image_path,legacy_migrated_at,active,sort_order")
  .order("sort_order");
if (floorsErr) throw floorsErr;

const extSelect = "id,codigo,base_id,pavimento,setor,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id,active";
const hidSelect = "id,codigo,base_id,pavimento,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id,active";
const marcSelect = "id,base_id,pavimento,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id";

const [extAll, hidAll, marcAll] = await Promise.all([
  fetchAll(supabase, "extintores", extSelect),
  fetchAll(supabase, "hidrantes", hidSelect),
  fetchAll(supabase, "marcadores_emergencia", marcSelect),
]);

const focusFloors = (allFloors ?? []).filter((f) => (focus ? f.base_id === focus.id : true));
const extFocus = focus ? extAll.filter((r) => r.base_id === focus.id) : extAll;
const hidFocus = focus ? hidAll.filter((r) => r.base_id === focus.id) : hidAll;
const marcFocus = focus ? marcAll.filter((r) => r.base_id === focus.id) : marcAll;

const extStats = summarize(extFocus, focusFloors);
const hidStats = summarize(hidFocus, focusFloors);
const marcStats = summarize(marcFocus, focusFloors);

console.log("=== Diagnóstico somente leitura — Fase 4 equipamentos ===");
console.log(`Bases no projeto: ${(allBases ?? []).length}`);
for (const b of allBases ?? []) {
  const nFloors = (allFloors ?? []).filter((f) => f.base_id === b.id).length;
  console.log(`  - ${b.slug} (${b.nome}) floors=${nFloors} active=${b.active}`);
}
console.log(`Floors no projeto: ${(allFloors ?? []).length}`);
console.log(`Foco: ${focus ? `${focus.slug} / ${focus.nome}` : "TODAS AS BASES"}`);

console.log("\n## Totais globais (todas as bases)");
console.log(`- extintores: ${extAll.length}`);
console.log(`- hidrantes: ${hidAll.length}`);
console.log(`- marcadores: ${marcAll.length}`);

printKind("Extintores (foco)", extStats);
printKind("Hidrantes (foco)", hidStats);
printKind("Marcadores (foco)", marcStats);

console.log("\n## Resumo por setor (foco)");
const floorIds = [...new Set([...extStats.byFloor, ...hidStats.byFloor, ...marcStats.byFloor].map((f) => f.floor_id))];
for (const id of floorIds) {
  const e = extStats.byFloor.find((f) => f.floor_id === id);
  const h = hidStats.byFloor.find((f) => f.floor_id === id);
  const m = marcStats.byFloor.find((f) => f.floor_id === id);
  const label = e?.label ?? h?.label ?? m?.label ?? id;
  if ((e?.count ?? 0) + (h?.count ?? 0) + (m?.count ?? 0) === 0 && id != null) continue;
  console.log(`\n### ${label}`);
  console.log(`Extintores: ${e?.count ?? 0}`);
  console.log(`- com floor_id: ${e?.withFloorId ?? 0}`);
  console.log(`- com norm coords: ${e?.withNorm ?? 0}`);
  console.log(`- sem posição: ${e?.withoutPosition ?? 0}`);
  console.log(`Hidrantes: ${h?.count ?? 0}`);
  console.log(`- com floor_id: ${h?.withFloorId ?? 0}`);
  console.log(`- com norm coords: ${h?.withNorm ?? 0}`);
  console.log(`- sem posição: ${h?.withoutPosition ?? 0}`);
  if ((m?.count ?? 0) > 0) {
    console.log(`Marcadores: ${m.count}`);
    console.log(`- com floor_id: ${m.withFloorId}`);
    console.log(`- com norm coords: ${m.withNorm}`);
    console.log(`- sem posição: ${m.withoutPosition}`);
  }
}

if (extStats.mismatchSamples.length || hidStats.mismatchSamples.length) {
  console.log("\n## Amostras pavimento ≠ floor_id");
  console.log(JSON.stringify({ extintores: extStats.mismatchSamples, hidrantes: hidStats.mismatchSamples }, null, 2));
}

const zerosMeanAlreadyMigrated =
  extStats.wouldSetFloorId === 0 &&
  extStats.wouldSetNorm === 0 &&
  hidStats.wouldSetFloorId === 0 &&
  hidStats.wouldSetNorm === 0 &&
  marcStats.wouldSetFloorId === 0 &&
  marcStats.wouldSetNorm === 0 &&
  extStats.alreadyComplete + hidStats.alreadyComplete + marcStats.alreadyComplete > 0;

console.log("\n## Conclusão dos zeros do dry-run");
if (zerosMeanAlreadyMigrated) {
  console.log("Os zeros do dry-run significam que os equipamentos já estavam migrados");
  console.log(
    `(já completos: ext=${extStats.alreadyComplete} hid=${hidStats.alreadyComplete} marc=${marcStats.alreadyComplete})`,
  );
} else if (extStats.total + hidStats.total + marcStats.total === 0) {
  console.log("Os zeros ocorreram porque o script não está encontrando/processando os registros corretamente.");
} else {
  console.log("Os zeros NÃO são apenas 'já migrado': ainda haveria updates (ver wouldSet*).");
}
