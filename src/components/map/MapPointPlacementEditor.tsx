"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
} from "react-leaflet";
import L, { type LatLngBoundsExpression, type LatLngBoundsLiteral } from "leaflet";

if (typeof window !== "undefined") {
  (window as unknown as { L: typeof L }).L = L;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("leaflet-rotate/dist/leaflet-rotate.js");
}

import { getSupabaseClient } from "@/lib/supabase/client";
import { useActiveBase } from "@/lib/auth/active-base-context";
import {
  fetchBaseFloors,
  type BaseFloor,
} from "@/lib/auth/bases";
import {
  floorHasDisplayablePlant,
  type FloorPlantLoadStatus,
} from "@/lib/map/floor-image-resolution";
import {
  hasStoredMapPosition,
  resolveLeafletPosition,
  type MapCoordinateFields,
} from "@/lib/map/coordinates";
import { buildPlacementClear, buildPlacementUpdate } from "@/lib/map/build-placement-update";
import {
  filterPlacedOnFloor,
  filterUnplacedCandidates,
  isPlacedOnFloor,
} from "@/lib/map/floor-equipment-filter";
import type { FloorRef } from "@/lib/map/floor-matching";
import { extinguisherIcon, hydrantIcon } from "@/lib/map/marker-icons";
import type { MarkerColors } from "@/lib/map/marker-styles";
import { MapFitBounds, MapZoomStabilityGuard } from "@/src/components/map/MapFitBounds";
import MapFloorPlantLayer from "@/src/components/map/MapFloorPlantLayer";
import MapFloorPlantStatusOverlay from "@/src/components/map/MapFloorPlantStatusOverlay";
import MapClickPlacement from "@/src/components/map/MapClickPlacement";
import MapViewportSync from "@/src/components/map/MapViewportSync";
import MapZoomControls from "@/src/components/map/MapZoomControls";

const FULL_IMAGE_WIDTH = 14042;
const FULL_IMAGE_HEIGHT = 9934;

const SELECTED_COLORS: MarkerColors = { bg: "#2563eb", ring: "#2563eb" };
const PLACED_EXT_COLORS: MarkerColors = { bg: "#16a34a", ring: "#16a34a" };
const PLACED_HID_COLORS: MarkerColors = { bg: "#1d4ed8", ring: "#1d4ed8" };

type EquipmentKind = "extintor" | "hidrante";

type ExtintorPlacementRow = {
  id: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  tipo: string;
  capacidade_extintora: string;
  pavimento: string | null;
  floor_id?: string | null;
  coord_x: number | null;
  coord_y: number | null;
  coord_x_norm?: number | null;
  coord_y_norm?: number | null;
};

type HidrantePlacementRow = {
  id: string;
  codigo: string;
  pavimento: string | null;
  local_detalhado: string;
  floor_id?: string | null;
  coord_x: number | null;
  coord_y: number | null;
  coord_x_norm?: number | null;
  coord_y_norm?: number | null;
};

type SelectedEquipment =
  | { kind: "extintor"; id: string }
  | { kind: "hidrante"; id: string }
  | null;

type UndoSnapshot = {
  kind: EquipmentKind;
  id: string;
  snapshot: MapCoordinateFields & { pavimento: string | null; floor_id?: string | null };
};

function floorRefFromBase(floor: BaseFloor): FloorRef {
  return { id: floor.id, key: floor.key, label: floor.label };
}

function formatExtLocal(item: Pick<ExtintorPlacementRow, "setor" | "local_detalhado">): string {
  const loc = item.setor?.trim() ?? "";
  const det = item.local_detalhado?.trim() ?? "";
  if (loc && det) return `${loc} — ${det}`;
  return det || loc || "—";
}

export default function MapPointPlacementEditor() {
  const { ready, activeBaseId } = useActiveBase();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [floors, setFloors] = useState<BaseFloor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<BaseFloor | null>(null);
  const [extintores, setExtintores] = useState<ExtintorPlacementRow[]>([]);
  const [hidrantes, setHidrantes] = useState<HidrantePlacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [tipoFiltro, setTipoFiltro] = useState<"todos" | EquipmentKind>("todos");
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<SelectedEquipment>(null);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [plantStatus, setPlantStatus] = useState<FloorPlantLoadStatus>("loading");
  const [plantRetryKey, setPlantRetryKey] = useState(0);

  const loadGenerationRef = useRef(0);

  const floorRef = useMemo(
    () => (selectedFloor ? floorRefFromBase(selectedFloor) : { key: "", label: "" }),
    [selectedFloor],
  );

  const mapImageSize = useMemo(
    () => ({
      width:
        selectedFloor?.image_width && selectedFloor.image_width > 0
          ? selectedFloor.image_width
          : FULL_IMAGE_WIDTH,
      height:
        selectedFloor?.image_height && selectedFloor.image_height > 0
          ? selectedFloor.image_height
          : FULL_IMAGE_HEIGHT,
    }),
    [selectedFloor],
  );

  const mapBounds = useMemo<LatLngBoundsExpression>(
    () => [
      [0, 0],
      [mapImageSize.height, mapImageSize.width],
    ],
    [mapImageSize],
  );

  const hasDisplayablePlant = useMemo(
    () =>
      selectedFloor
        ? floorHasDisplayablePlant(
            selectedFloor.image_path,
            selectedFloor.image_path_preview,
            selectedFloor.key,
          )
        : false,
    [selectedFloor],
  );

  const loadFloors = useCallback(async () => {
    if (!activeBaseId) {
      setFloors([]);
      setSelectedFloor(null);
      return;
    }
    const rows = await fetchBaseFloors(activeBaseId);
    const withMap = rows.filter(
      (f) =>
        f.active &&
        floorHasDisplayablePlant(f.image_path, f.image_path_preview, f.key),
    );
    setFloors(withMap);
    setSelectedFloor((prev) => {
      if (prev && withMap.some((f) => f.id === prev.id)) return prev;
      return withMap[0] ?? null;
    });
  }, [activeBaseId]);

  const loadEquipment = useCallback(async (generation?: number) => {
    const gen = generation ?? loadGenerationRef.current;
    if (!activeBaseId) {
      setExtintores([]);
      setHidrantes([]);
      return;
    }

    const extSelect =
      "id,codigo,setor,local_detalhado,tipo,capacidade_extintora,pavimento,floor_id,coord_x,coord_y,coord_x_norm,coord_y_norm";
    const hidSelect =
      "id,codigo,pavimento,local_detalhado,floor_id,coord_x,coord_y,coord_x_norm,coord_y_norm";

    let extQuery = supabase.from("extintores").select(extSelect).eq("base_id", activeBaseId).eq("active", true);
    let hidQuery = supabase.from("hidrantes").select(hidSelect).eq("base_id", activeBaseId).eq("active", true);

    const [extRes, hidRes] = await Promise.all([extQuery, hidQuery]);

    if (gen !== loadGenerationRef.current) return;

    if (!extRes.error) setExtintores((extRes.data ?? []) as ExtintorPlacementRow[]);
    if (!hidRes.error) setHidrantes((hidRes.data ?? []) as HidrantePlacementRow[]);
  }, [activeBaseId, supabase]);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    void loadFloors().finally(() => setLoading(false));
  }, [ready, loadFloors]);

  useEffect(() => {
    loadGenerationRef.current += 1;
    const gen = loadGenerationRef.current;
    void loadEquipment(gen);
  }, [loadEquipment, activeBaseId]);

  useEffect(() => {
    setSelected(null);
    setUndoStack([]);
    setMessage("");
  }, [selectedFloor?.id]);

  useEffect(() => {
    setPlantStatus("loading");
    setPlantRetryKey(0);
  }, [selectedFloor?.id]);

  const retryPlantLoad = useCallback(() => {
    setPlantRetryKey((key) => key + 1);
    setPlantStatus("loading");
  }, []);

  const unplacedExtintores = useMemo(() => {
    if (!selectedFloor) return [];
    return filterUnplacedCandidates(extintores, floorRef);
  }, [extintores, floorRef, selectedFloor]);

  const unplacedHidrantes = useMemo(() => {
    if (!selectedFloor) return [];
    return filterUnplacedCandidates(hidrantes, floorRef);
  }, [hidrantes, floorRef, selectedFloor]);

  const placedExtintores = useMemo(() => {
    if (!selectedFloor) return [];
    return filterPlacedOnFloor(extintores, floorRef);
  }, [extintores, floorRef, selectedFloor]);

  const placedHidrantes = useMemo(() => {
    if (!selectedFloor) return [];
    return filterPlacedOnFloor(hidrantes, floorRef);
  }, [hidrantes, floorRef, selectedFloor]);

  const matchesBusca = useCallback(
    (codigo: string, extras: string[]) => {
      const q = busca.trim().toLowerCase();
      if (!q) return true;
      return (
        codigo.toLowerCase().includes(q) ||
        extras.some((part) => part.toLowerCase().includes(q))
      );
    },
    [busca],
  );

  const visibleUnplacedExt = useMemo(
    () =>
      unplacedExtintores.filter((item) =>
        matchesBusca(item.codigo, [formatExtLocal(item), item.tipo, item.capacidade_extintora]),
      ),
    [unplacedExtintores, matchesBusca],
  );

  const visibleUnplacedHid = useMemo(
    () =>
      unplacedHidrantes.filter((item) =>
        matchesBusca(item.codigo, [item.local_detalhado ?? "", item.pavimento ?? ""]),
      ),
    [unplacedHidrantes, matchesBusca],
  );

  const visiblePlacedExt = useMemo(
    () =>
      placedExtintores.filter((item) =>
        matchesBusca(item.codigo, [formatExtLocal(item), item.tipo, item.capacidade_extintora]),
      ),
    [placedExtintores, matchesBusca],
  );

  const visiblePlacedHid = useMemo(
    () =>
      placedHidrantes.filter((item) =>
        matchesBusca(item.codigo, [item.local_detalhado ?? "", item.pavimento ?? ""]),
      ),
    [placedHidrantes, matchesBusca],
  );

  function pushUndo(kind: EquipmentKind, id: string, row: UndoSnapshot["snapshot"]) {
    setUndoStack((prev) => [...prev.slice(-9), { kind, id, snapshot: row }]);
  }

  async function saveExtintorPosition(
    id: string,
    lat: number,
    lng: number,
    undoBefore?: UndoSnapshot["snapshot"],
  ) {
    if (!selectedFloor) return false;
    const payload = buildPlacementUpdate(lat, lng, { id: selectedFloor.id, label: selectedFloor.label }, mapImageSize);
    const { data, error } = await supabase
      .from("extintores")
      .update(payload)
      .eq("id", id)
      .select("id,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id,pavimento,setor")
      .maybeSingle();

    if (error || !data || !hasStoredMapPosition(data as MapCoordinateFields)) {
      setMessage(error?.message ?? "Não foi possível salvar a posição do extintor.");
      return false;
    }

    if (undoBefore) pushUndo("extintor", id, undoBefore);

    setExtintores((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              coord_x: Number(data.coord_x),
              coord_y: Number(data.coord_y),
              coord_x_norm: data.coord_x_norm != null ? Number(data.coord_x_norm) : payload.coord_x_norm,
              coord_y_norm: data.coord_y_norm != null ? Number(data.coord_y_norm) : payload.coord_y_norm,
              floor_id: data.floor_id ? String(data.floor_id) : selectedFloor.id,
              pavimento: String(data.pavimento ?? selectedFloor.label),
            }
          : item,
      ),
    );
    return true;
  }

  async function saveHidrantePosition(
    id: string,
    lat: number,
    lng: number,
    undoBefore?: UndoSnapshot["snapshot"],
  ) {
    if (!selectedFloor) return false;
    const payload = buildPlacementUpdate(lat, lng, { id: selectedFloor.id, label: selectedFloor.label }, mapImageSize);
    const { data, error } = await supabase
      .from("hidrantes")
      .update(payload)
      .eq("id", id)
      .select("id,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id,pavimento")
      .maybeSingle();

    if (error || !data || !hasStoredMapPosition(data as MapCoordinateFields)) {
      setMessage(error?.message ?? "Não foi possível salvar a posição do hidrante.");
      return false;
    }

    if (undoBefore) pushUndo("hidrante", id, undoBefore);

    setHidrantes((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              coord_x: Number(data.coord_x),
              coord_y: Number(data.coord_y),
              coord_x_norm: data.coord_x_norm != null ? Number(data.coord_x_norm) : payload.coord_x_norm,
              coord_y_norm: data.coord_y_norm != null ? Number(data.coord_y_norm) : payload.coord_y_norm,
              floor_id: data.floor_id ? String(data.floor_id) : selectedFloor.id,
              pavimento: String(data.pavimento ?? selectedFloor.label),
            }
          : item,
      ),
    );
    return true;
  }

  async function clearPosition(kind: EquipmentKind, id: string) {
    const table = kind === "extintor" ? "extintores" : "hidrantes";
    const row =
      kind === "extintor"
        ? extintores.find((e) => e.id === id)
        : hidrantes.find((h) => h.id === id);
    if (!row) return;

    pushUndo(kind, id, {
      coord_x: row.coord_x,
      coord_y: row.coord_y,
      coord_x_norm: row.coord_x_norm ?? null,
      coord_y_norm: row.coord_y_norm ?? null,
      floor_id: row.floor_id ?? null,
      pavimento: row.pavimento,
    });

    setSaving(true);
    const { error } = await supabase.from(table).update(buildPlacementClear()).eq("id", id);
    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    if (kind === "extintor") {
      setExtintores((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, coord_x: null, coord_y: null, coord_x_norm: null, coord_y_norm: null, floor_id: null, pavimento: null }
            : item,
        ),
      );
    } else {
      setHidrantes((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, coord_x: null, coord_y: null, coord_x_norm: null, coord_y_norm: null, floor_id: null, pavimento: null }
            : item,
        ),
      );
    }
    if (selected?.kind === kind && selected.id === id) setSelected(null);
    setMessage("Posição removida.");
    setSaving(false);
  }

  async function handleMapClick(lat: number, lng: number) {
    if (!selectedFloor || !selected || saving) return;

    setSaving(true);
    setMessage("");

    let ok = false;
    if (selected.kind === "extintor") {
      const row = extintores.find((e) => e.id === selected.id);
      if (!row) {
        setSaving(false);
        return;
      }
      ok = await saveExtintorPosition(selected.id, lat, lng, {
        coord_x: row.coord_x,
        coord_y: row.coord_y,
        coord_x_norm: row.coord_x_norm ?? null,
        coord_y_norm: row.coord_y_norm ?? null,
        floor_id: row.floor_id ?? null,
        pavimento: row.pavimento,
      });
    } else {
      const row = hidrantes.find((h) => h.id === selected.id);
      if (!row) {
        setSaving(false);
        return;
      }
      ok = await saveHidrantePosition(selected.id, lat, lng, {
        coord_x: row.coord_x,
        coord_y: row.coord_y,
        coord_x_norm: row.coord_x_norm ?? null,
        coord_y_norm: row.coord_y_norm ?? null,
        floor_id: row.floor_id ?? null,
        pavimento: row.pavimento,
      });
    }

    if (ok) {
      setMessage("Posição salva.");
      setSelected(null);
    }
    setSaving(false);
  }

  async function handleMarkerDrag(kind: EquipmentKind, id: string, lat: number, lng: number) {
    if (!selectedFloor || saving) return;
    setSaving(true);
    setMessage("");

    const row =
      kind === "extintor" ? extintores.find((e) => e.id === id) : hidrantes.find((h) => h.id === id);
    if (!row) {
      setSaving(false);
      return;
    }

    const undoSnap = {
      coord_x: row.coord_x,
      coord_y: row.coord_y,
      coord_x_norm: row.coord_x_norm ?? null,
      coord_y_norm: row.coord_y_norm ?? null,
      floor_id: row.floor_id ?? null,
      pavimento: row.pavimento,
    };

    const ok =
      kind === "extintor"
        ? await saveExtintorPosition(id, lat, lng, undoSnap)
        : await saveHidrantePosition(id, lat, lng, undoSnap);

    setMessage(ok ? "Posição atualizada." : "Falha ao mover marcador.");
    setSaving(false);
  }

  async function handleUndo() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry || saving) return;

    setSaving(true);
    setMessage("");

    const table = entry.kind === "extintor" ? "extintores" : "hidrantes";
    const payload =
      entry.snapshot.coord_x != null && entry.snapshot.coord_y != null
        ? {
            coord_x: entry.snapshot.coord_x,
            coord_y: entry.snapshot.coord_y,
            coord_x_norm: entry.snapshot.coord_x_norm,
            coord_y_norm: entry.snapshot.coord_y_norm,
            floor_id: entry.snapshot.floor_id,
            pavimento: entry.snapshot.pavimento,
          }
        : buildPlacementClear();

    const { error } = await supabase.from(table).update(payload).eq("id", entry.id);
    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setUndoStack((prev) => prev.slice(0, -1));
    await loadEquipment();
    setMessage("Alteração desfeita.");
    setSaving(false);
  }

  const mapReady = selectedFloor && hasDisplayablePlant;

  const leafletRotateOpts = { rotate: false, rotateControl: false };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:overflow-hidden">
      <aside className="professional-card flex shrink-0 flex-col gap-3 overflow-y-auto p-4 lg:w-[340px] lg:max-h-full">
        <div>
          <p className="page-eyebrow">Mapeamento</p>
          <h1 className="text-lg font-extrabold text-[var(--ink)]">Posicionar equipamentos</h1>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Selecione o mapa, escolha um equipamento e clique na planta. Arraste marcadores já posicionados para ajustar.
          </p>
        </div>

        <label className="block text-xs font-bold text-slate-700" htmlFor="placement-floor">
          Mapa / setor
        </label>
        <select
          id="placement-floor"
          className="field-control !rounded-xl"
          value={selectedFloor?.id ?? ""}
          onChange={(e) => {
            const floor = floors.find((f) => f.id === e.target.value);
            setSelectedFloor(floor ?? null);
          }}
        >
          {floors.length === 0 ? <option value="">Sem mapas com planta</option> : null}
          {floors.map((floor) => (
            <option key={floor.id} value={floor.id}>
              {floor.label}
              {floor.needs_position_review ? " — revisão necessária" : ""}
            </option>
          ))}
        </select>

        {selectedFloor?.needs_position_review && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Este mapa foi substituído recentemente. Revise as posições dos equipamentos em{" "}
            <a href="/admin/posicionamento" className="font-semibold underline">
              Posicionar equipamentos
            </a>
            .
          </p>
        )}

        <input
          type="search"
          placeholder="Buscar código ou local"
          className="field-control !rounded-xl"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <div className="flex flex-wrap gap-1">
          {(["todos", "extintor", "hidrante"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                tipoFiltro === tipo ? "bg-[var(--orange)] text-white" : "bg-slate-100 text-slate-600"
              }`}
              onClick={() => setTipoFiltro(tipo)}
            >
              {tipo === "todos" ? "Todos" : tipo === "extintor" ? "Extintores" : "Hidrantes"}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            disabled={undoStack.length === 0 || saving}
            onClick={() => void handleUndo()}
          >
            Desfazer
          </button>
          {saving && <span className="text-xs text-amber-700">Salvando…</span>}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : !selectedFloor ? (
          <p className="text-sm text-slate-500">
            Cadastre um setor com planta em Configurações da base.
          </p>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-bold text-slate-800">
                Sem posição ({visibleUnplacedExt.length + visibleUnplacedHid.length})
              </h2>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {tipoFiltro !== "hidrante" &&
                  visibleUnplacedExt.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full rounded-lg border p-2 text-left text-sm ${
                        selected?.kind === "extintor" && selected.id === item.id
                          ? "border-[var(--neon)] bg-[var(--neon)] text-[var(--neon-ink)]"
                          : "border-slate-200 bg-white"
                      }`}
                      onClick={() => setSelected({ kind: "extintor", id: item.id })}
                    >
                      <span className="font-semibold">{item.codigo}</span>
                      <span className="block text-xs opacity-80">{formatExtLocal(item)}</span>
                    </button>
                  ))}
                {tipoFiltro !== "extintor" &&
                  visibleUnplacedHid.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full rounded-lg border p-2 text-left text-sm ${
                        selected?.kind === "hidrante" && selected.id === item.id
                          ? "border-blue-700 bg-blue-700 text-white"
                          : "border-slate-200 bg-white"
                      }`}
                      onClick={() => setSelected({ kind: "hidrante", id: item.id })}
                    >
                      <span className="font-semibold">{item.codigo}</span>
                      <span className="block text-xs opacity-80">{item.local_detalhado || "—"}</span>
                    </button>
                  ))}
                {visibleUnplacedExt.length + visibleUnplacedHid.length === 0 && (
                  <p className="text-xs text-slate-500">Nenhum equipamento pendente neste setor.</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-slate-800">
                Posicionados ({visiblePlacedExt.length + visiblePlacedHid.length})
              </h2>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {tipoFiltro !== "hidrante" &&
                  visiblePlacedExt.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 rounded-lg border p-2 ${
                        selected?.kind === "extintor" && selected.id === item.id
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm"
                        onClick={() => setSelected({ kind: "extintor", id: item.id })}
                      >
                        <span className="font-semibold">{item.codigo}</span>
                        <span className="block text-xs text-slate-500">{formatExtLocal(item)}</span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-semibold text-red-600"
                        onClick={() => void clearPosition("extintor", item.id)}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                {tipoFiltro !== "extintor" &&
                  visiblePlacedHid.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 rounded-lg border p-2 ${
                        selected?.kind === "hidrante" && selected.id === item.id
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm"
                        onClick={() => setSelected({ kind: "hidrante", id: item.id })}
                      >
                        <span className="font-semibold">{item.codigo}</span>
                        <span className="block text-xs text-slate-500">{item.local_detalhado || "—"}</span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-semibold text-red-600"
                        onClick={() => void clearPosition("hidrante", item.id)}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          </>
        )}

        {message && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">{message}</p>
        )}
      </aside>

      <section className="professional-card map-viewport-root relative min-h-[min(70dvh,720px)] flex-1 overflow-hidden lg:min-h-0">
        {!mapReady ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
            {loading ? "Carregando mapa…" : "Selecione um setor com planta cadastrada."}
          </div>
        ) : (
          <>
          <MapContainer
            key={`${selectedFloor.id}-${mapImageSize.width}x${mapImageSize.height}`}
            crs={L.CRS.Simple}
            preferCanvas
            zoomAnimation={false}
            fadeAnimation={false}
            markerZoomAnimation={false}
            inertia={false}
            maxBoundsViscosity={1}
            attributionControl={false}
            className="h-full w-full"
            style={{ height: "100%", width: "100%", background: "#e8eaed" }}
            {...(leafletRotateOpts as Record<string, unknown>)}
          >
            <MapFitBounds
              bounds={mapBounds}
              maxZoomExtra={5}
              minZoomAbsolute={-6}
              boundsPad={0.12}
            />
            <MapZoomStabilityGuard />
            <MapViewportSync onLodChange={() => {}} enableDoubleTapZoom={false} />
            <MapZoomControls bounds={mapBounds as LatLngBoundsLiteral} />
            <MapFloorPlantLayer
              imagePath={selectedFloor.image_path}
              imagePathPreview={selectedFloor.image_path_preview}
              floorKey={selectedFloor.key}
              bounds={mapBounds}
              retryKey={plantRetryKey}
              onStatusChange={setPlantStatus}
            />
            <MapClickPlacement enabled={Boolean(selected) && !saving} onClick={handleMapClick} />

            {tipoFiltro !== "hidrante" &&
              placedExtintores.map((item) => {
                const position = resolveLeafletPosition(item, mapImageSize.width, mapImageSize.height);
                if (!position || !isPlacedOnFloor(item, floorRef)) return null;
                const isSelected = selected?.kind === "extintor" && selected.id === item.id;
                const colors = isSelected ? SELECTED_COLORS : PLACED_EXT_COLORS;
                return (
                  <Marker
                    key={item.id}
                    position={position}
                    draggable={isSelected}
                    icon={extinguisherIcon(colors, item.codigo, "detail", isSelected)}
                    eventHandlers={{
                      click: () => setSelected({ kind: "extintor", id: item.id }),
                      dragend: (e) => {
                        const marker = e.target as L.Marker;
                        const pos = marker.getLatLng();
                        void handleMarkerDrag("extintor", item.id, pos.lat, pos.lng);
                      },
                    }}
                  />
                );
              })}

            {tipoFiltro !== "extintor" &&
              placedHidrantes.map((item) => {
                const position = resolveLeafletPosition(item, mapImageSize.width, mapImageSize.height);
                if (!position || !isPlacedOnFloor(item, floorRef)) return null;
                const isSelected = selected?.kind === "hidrante" && selected.id === item.id;
                const colors = isSelected ? SELECTED_COLORS : PLACED_HID_COLORS;
                return (
                  <Marker
                    key={item.id}
                    position={position}
                    draggable={isSelected}
                    icon={hydrantIcon(colors, item.codigo, "detail", isSelected)}
                    eventHandlers={{
                      click: () => setSelected({ kind: "hidrante", id: item.id }),
                      dragend: (e) => {
                        const marker = e.target as L.Marker;
                        const pos = marker.getLatLng();
                        void handleMarkerDrag("hidrante", item.id, pos.lat, pos.lng);
                      },
                    }}
                  />
                );
              })}

          </MapContainer>
          {plantStatus !== "ready" && (
            <MapFloorPlantStatusOverlay
              status={plantStatus}
              onRetry={retryPlantLoad}
              showAdminConfigHint
            />
          )}

        {selected && !hasStoredMapPosition(
          selected.kind === "extintor"
            ? extintores.find((e) => e.id === selected.id) ?? {}
            : hidrantes.find((h) => h.id === selected.id) ?? {},
        ) && (
          <div className="pointer-events-none absolute bottom-14 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-xs font-semibold text-white shadow">
            Clique na planta para posicionar
          </div>
        )}
          </>
        )}
      </section>
    </div>
  );
}
