"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
} from "react-leaflet";
import L, { type LatLngBoundsExpression, type LatLngBoundsLiteral } from "leaflet";

/** Plugin de rotação (bearing + pinch com 2 dedos). Precisa de `L` global no bundle. */
if (typeof window !== "undefined") {
  (window as unknown as { L: typeof L }).L = L;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- bundle UMD espera global L
  require("leaflet-rotate/dist/leaflet-rotate.js");
}

import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchMarcadoresEmergenciaForMap } from "@/lib/supabase/marcadores-emergencia-fetch";
import {
  fetchChecklistsExtintoresDoMes,
  fetchChecklistsHidrantesDoMes,
  type ChecklistExtintorMesRow,
  type ChecklistHidranteMesRow,
} from "@/lib/supabase/checklists-do-mes";
import { isCargoLabel, resolveConferenteNome } from "@/lib/auth/conferente";
import { getCurrentSession, getProfileBySession, type Profile } from "@/lib/auth/profile";
import { canUseMapEditing, canUseMapInspection } from "@/lib/auth/roles";
import { useOptionalActiveBase } from "@/lib/auth/active-base-context";
import {
  baseHasEquipesConferencia,
  fetchBaseFloors,
  type BaseFloor,
} from "@/lib/auth/bases";
import {
  hasStoredMapPosition,
  resolveLeafletPosition,
  type MapCoordinateFields,
} from "@/lib/map/coordinates";
import { itemMatchesFloor, marcadorMatchesFloor } from "@/lib/map/floor-matching";
import { readMapViewState, writeMapViewState } from "@/lib/map/map-state-storage";
import { parseCalendarDateAsLocal } from "@/lib/date/date-only";
import ChecklistForm from "@/src/components/ChecklistForm";
import HidranteChecklistForm from "@/src/components/HidranteChecklistForm";
import ModalCloseButton from "@/src/components/ModalCloseButton";
import { fetchChecklistQuestionsForBase } from "@/lib/checklist/questions-client";
import {
  CHECKLIST_INITIAL,
  CHECKLIST_ITEM_KEYS,
  getChecklistAnswer,
  checklistTemNaoConformidade,
  isDataVencida,
  type ChecklistData,
  type ChecklistItemKey,
} from "@/lib/checklist/types";
import { DEFAULT_EXTINTOR_QUESTION_LABELS } from "@/lib/checklist/default-questions";
import {
  HIDRANTE_ACTIVE_ITEM_KEYS,
  HIDRANTE_CHECKLIST_INITIAL,
  HIDRANTE_ITEM_LABELS,
  getHidranteAnswer,
  hidranteChecklistTemNaoConformidade,
  type HidranteChecklistData,
  type HidranteItemKey,
} from "@/lib/checklist/hidrante-types";
import {
  insertExtintorChecklist,
  insertHidranteChecklist,
} from "@/lib/checklist/insert-checklist";
import type { HidranteImportRow } from "@/lib/rf01/hidrante-import-parser";
import { getLocalCalendarMonthUtcIsoRange, isIsoDateWithinInclusiveRange } from "@/lib/date/local-month-range";
import {
  EQUIPES_CONFERENCIA,
  filtrarPorEquipe,
  type EquipeConferenciaId,
} from "@/lib/equipes/conferencia-filtro";
import {
  extintorMarkerColors,
  hidranteMarkerColors,
  type MarkerColors,
} from "@/lib/map/marker-styles";
import { effectiveMarkerLod, type MarkerLod } from "@/lib/map/marker-lod";
import { extinguisherIcon, hydrantIcon } from "@/lib/map/marker-icons";
import MapZoomControls from "@/src/components/map/MapZoomControls";
import MapViewportSync from "@/src/components/map/MapViewportSync";
import MapEquipmentDetailPanel, {
  type MapEquipmentDetail,
} from "@/src/components/map/MapEquipmentDetailPanel";
import { MapFitBounds, MapZoomStabilityGuard } from "@/src/components/map/MapFitBounds";
import MapClickPlacement from "@/src/components/map/MapClickPlacement";
import { buildPlacementUpdate } from "@/lib/map/build-placement-update";
import { buildFloorImageCandidates, floorHasDisplayablePlant, type FloorPlantLoadStatus } from "@/lib/map/floor-image-resolution";
import { LEGACY_FLOOR_MAPS } from "@/lib/map/legacy-floor-maps";
import MapFloorPlantLayer from "@/src/components/map/MapFloorPlantLayer";
import MapFloorPlantStatusOverlay from "@/src/components/map/MapFloorPlantStatusOverlay";

// ─── Error Boundary ───────────────────────────────────────────────────────────
class MapErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; resetKey: number; autoRecovered: boolean }
> {
  private recoverTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, resetKey: 0, autoRecovered: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // Recuperação automática uma vez: remonta o mapa limpo (evita “tela morta”
    // após crash de zoom extremo / WebGL/GPU). Se falhar de novo, mostra o botão.
    if (this.state.autoRecovered) return;
    this.recoverTimer = setTimeout(() => {
      this.setState((prev) => ({
        hasError: false,
        resetKey: prev.resetKey + 1,
        autoRecovered: true,
      }));
    }, 120);
  }
  componentWillUnmount() {
    if (this.recoverTimer) clearTimeout(this.recoverTimer);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-zinc-700">O mapa encontrou um erro.</p>
          <button
            type="button"
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white"
            onClick={() =>
              this.setState((prev) => ({
                hasError: false,
                resetKey: prev.resetKey + 1,
                autoRecovered: false,
              }))
            }
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return <div key={this.state.resetKey} className="h-full w-full">{this.props.children}</div>;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

type Mode = "edicao" | "inspecao";

type PavimentoOption = {
  id?: string;
  key: string;
  label: string;
  imageBase: string;
  imagePreview?: string | null;
  imageWidth?: number;
  imageHeight?: number;
};

type Extintor = {
  id: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
  num_cilindro?: string | null;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  coord_x: number | null;
  coord_y: number | null;
  coord_x_norm?: number | null;
  coord_y_norm?: number | null;
  floor_id?: string | null;
  pavimento: string | null;
};

/** Ordem crescente 1, 2, …, 10 (não lexicográfica 1, 10, 2). */
function compareExtintorCodigoAsc(a: Extintor, b: Extintor): number {
  return a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true, sensitivity: "accent" });
}

/** Local cadastral (setor) + local detalhado, para listas e popup no mapa. */
function formatExtintorLocalizacao(item: Pick<Extintor, "setor" | "local_detalhado">): string {
  const loc = item.setor?.trim() ?? "";
  const det = item.local_detalhado?.trim() ?? "";
  if (loc && det) return `${loc} — ${det}`;
  if (det) return det;
  if (loc) return loc;
  return "—";
}

/** Tipo + capacidade extintora (lista / select ao posicionar no mapa). */
function formatExtintorTipoCapacidade(item: Pick<Extintor, "tipo" | "capacidade_extintora">): string {
  const tipo = item.tipo?.trim() ?? "";
  const cap = item.capacidade_extintora?.trim() ?? "";
  if (tipo && cap) return `${tipo} · ${cap}`;
  if (tipo) return tipo;
  if (cap) return cap;
  return "";
}

type HidranteRow = HidranteImportRow & {
  id: string;
  coord_x: number | null;
  coord_y: number | null;
  coord_x_norm?: number | null;
  coord_y_norm?: number | null;
  floor_id?: string | null;
};

type MarcadorEmergenciaRow = {
  id: string;
  kind: "luz_emergencia" | "placa_saida_emergencia";
  pavimento: string | null;
  floor_id?: string | null;
  coord_x: number;
  coord_y: number;
  coord_x_norm?: number | null;
  coord_y_norm?: number | null;
  quantidade: number;
  verified_at: string | null;
  verified_by: string | null;
  inspecao_resultado: "conforme" | "nao_conforme" | null;
  nao_conformidade_descricao: string | null;
};

type ChecklistState = ChecklistData;

/** Fallback when base floors fail to load or are empty. */
const FALLBACK_PAVIMENTOS: PavimentoOption[] = LEGACY_FLOOR_MAPS.map((item) => ({
  key: item.key,
  label: item.label,
  imageBase: item.imageBase,
}));

function mapBaseFloorToPavimento(floor: BaseFloor): PavimentoOption {
  return {
    id: floor.id,
    key: floor.key,
    label: floor.label,
    imageBase: floor.image_path,
    imagePreview: floor.image_path_preview,
    imageWidth: floor.image_width,
    imageHeight: floor.image_height,
  };
}

function floorRefFromPavimento(pavimento: PavimentoOption) {
  return { id: pavimento.id, key: pavimento.key, label: pavimento.label };
}

function placementPayload(lat: number, lng: number, pavimento: PavimentoOption, mapSize: { width: number; height: number }) {
  return buildPlacementUpdate(lat, lng, { id: pavimento.id, label: pavimento.label }, mapSize);
}

const INITIAL_CHECKLIST: ChecklistState = CHECKLIST_INITIAL;

const preloadedImages = new Set<string>();

function parseDate(value: string | null) {
  return parseCalendarDateAsLocal(value);
}

/** Extintor pendente de posição neste pavimento (usa pavimento ou setor). */
function isUnplacedOnFloor(
  item: { coord_x: number | null; coord_y: number | null; coord_x_norm?: number | null; coord_y_norm?: number | null; pavimento: string | null; setor?: string; floor_id?: string | null },
  floor: PavimentoOption,
) {
  if (hasStoredMapPosition(item)) return false;
  return itemMatchesFloor(item, floorRefFromPavimento(floor));
}

function getMaintenanceStatus(extintor: Extintor) {
  const today = new Date();
  const inThirtyDays = new Date();
  inThirtyDays.setDate(today.getDate() + 30);

  const dates = [parseDate(extintor.manutencao_2_nivel), parseDate(extintor.manutencao_3_nivel)].filter(
    Boolean,
  ) as Date[];

  if (dates.length === 0) return "Sem data de manutenção";
  const nextDue = dates.sort((a, b) => a.getTime() - b.getTime())[0];
  if (nextDue < today) return "Vencido";
  if (nextDue <= inThirtyDays) return "Próximo de vencer (30 dias)";
  return "Em dia";
}

function buildUltimoPorExtintor(rows: ChecklistExtintorMesRow[]): Map<string, ChecklistExtintorMesRow> {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.data_conferencia).getTime() - new Date(a.data_conferencia).getTime(),
  );
  const map = new Map<string, ChecklistExtintorMesRow>();
  for (const row of sorted) {
    if (!map.has(row.extintor_id)) map.set(row.extintor_id, row);
  }
  return map;
}

function buildUltimoPorHidrante(rows: ChecklistHidranteMesRow[]): Map<string, ChecklistHidranteMesRow> {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.data_conferencia).getTime() - new Date(a.data_conferencia).getTime(),
  );
  const map = new Map<string, ChecklistHidranteMesRow>();
  for (const row of sorted) {
    if (!map.has(row.hidrante_id)) map.set(row.hidrante_id, row);
  }
  return map;
}

function hidranteCabecalhoForm(h: HidranteRow): Partial<HidranteImportRow> & { codigo: string } {
  return {
    codigo: h.codigo,
    pavimento: h.pavimento,
    local_detalhado: h.local_detalhado,
    quantidade_mangueiras: h.quantidade_mangueiras ?? null,
    teste_hidrostatico_m1: h.teste_hidrostatico_m1 ?? null,
    teste_hidrostatico_m2: h.teste_hidrostatico_m2 ?? null,
    teste_hidrostatico_m3: h.teste_hidrostatico_m3 ?? null,
    teste_hidrostatico_m4: h.teste_hidrostatico_m4 ?? null,
    quantidade_chaves_storz: h.quantidade_chaves_storz ?? null,
    quantidade_esguichos: h.quantidade_esguichos ?? null,
  };
}

// Todas as plantas têm a mesma resolução original. Fixar os bounds garante que
// as coordenadas salvas (baseadas nas imagens full-res) permaneçam válidas mesmo
// quando exibimos a versão mobile (menor resolução) no ImageOverlay.
const FULL_IMAGE_WIDTH = 14042;
const FULL_IMAGE_HEIGHT = 9934;

/** Layout compacto do mapa só em telas realmente pequenas (evita modal “mobile” no PC). */
const MAP_MOBILE_MAX_WIDTH_PX = 768;

function InspecaoModalFrame({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-layer fixed inset-0 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl max-h-[min(92dvh,920px)] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-end border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function MapView() {
  const activeBaseCtx = useOptionalActiveBase();
  const [mode, setMode] = useState<Mode>("edicao");
  const [pavimentos, setPavimentos] = useState<PavimentoOption[]>(FALLBACK_PAVIMENTOS);
  const [pavimento, setPavimento] = useState<PavimentoOption>(FALLBACK_PAVIMENTOS[0]);
  const [extintores, setExtintores] = useState<Extintor[]>([]);
  const [selectedExtintorId, setSelectedExtintorId] = useState<string>("");
  const [mapImageSize, setMapImageSize] = useState({
    width: FULL_IMAGE_WIDTH,
    height: FULL_IMAGE_HEIGHT,
  });
  const [loading, setLoading] = useState(true);
  const [savingPosition, setSavingPosition] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedMarker, setSelectedMarker] = useState<Extintor | null>(null);
  const [checklistForm, setChecklistForm] = useState<ChecklistState>(INITIAL_CHECKLIST);
  const [extintorChecklistFields, setExtintorChecklistFields] = useState<
    { key: string; label: string }[]
  >([]);
  const [hidranteChecklistFields, setHidranteChecklistFields] = useState<
    { key: string; label: string }[]
  >([]);
  const [activeExtintorFields, setActiveExtintorFields] = useState<
    { key: string; label: string }[]
  >([]);
  const [activeHidranteFields, setActiveHidranteFields] = useState<
    { key: string; label: string }[]
  >([]);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${MAP_MOBILE_MAX_WIDTH_PX}px)`).matches
      : false,
  );
  const [canEdit, setCanEdit] = useState(false);
  const [canInspect, setCanInspect] = useState(false);
  const [conferidosNoMesIds, setConferidosNoMesIds] = useState<Set<string>>(new Set());
  const [supportsWebp] = useState(() => {
    if (typeof window === "undefined") return true;
    const canvas = document.createElement("canvas");
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  });
  const [conferenteNome, setConferenteNome] = useState("");
  const [actorProfile, setActorProfile] = useState<Profile | null>(null);
  // Painel de informação (long press no mobile)
  const [infoMarker, setInfoMarker] = useState<Extintor | null>(null);
  const [ultimoChecklistExtintorMes, setUltimoChecklistExtintorMes] = useState<
    Map<string, ChecklistExtintorMesRow>
  >(new Map());
  const [hidrantes, setHidrantes] = useState<HidranteRow[]>([]);
  const [marcadoresEmergencia, setMarcadoresEmergencia] = useState<MarcadorEmergenciaRow[]>([]);
  const [conferidosHidranteMesIds, setConferidosHidranteMesIds] = useState<Set<string>>(new Set());
  const [ultimoChecklistHidranteMes, setUltimoChecklistHidranteMes] = useState<
    Map<string, ChecklistHidranteMesRow>
  >(new Map());
  const [selectedHidrante, setSelectedHidrante] = useState<HidranteRow | null>(null);
  const [hidranteChecklistForm, setHidranteChecklistForm] = useState<HidranteChecklistData>(HIDRANTE_CHECKLIST_INITIAL);
  const [savingHidranteChecklist, setSavingHidranteChecklist] = useState(false);
  const [selectedHidranteId, setSelectedHidranteId] = useState<string>("");
  const [placementExtra, setPlacementExtra] = useState<
    null | "hidrante" | "luz_emergencia" | "placa_saida_emergencia"
  >(null);
  const [showLayers, setShowLayers] = useState({
    extintor: true,
    hidrante: true,
  });
  const [filtroEquipe, setFiltroEquipe] = useState<EquipeConferenciaId | "">("");
  const [infoEmergencia, setInfoEmergencia] = useState<MarcadorEmergenciaRow | null>(null);
  const [infoHidrante, setInfoHidrante] = useState<HidranteRow | null>(null);
  const [markerLod, setMarkerLod] = useState<MarkerLod>("icon");
  const [buscaEquipamento, setBuscaEquipamento] = useState("");
  const [filtroPendentes, setFiltroPendentes] = useState(false);
  const [plantStatus, setPlantStatus] = useState<FloorPlantLoadStatus>("loading");
  const [plantRetryKey, setPlantRetryKey] = useState(0);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const currentMonthRange = useMemo(() => getLocalCalendarMonthUtcIsoRange(), []);

  const activeBaseId = activeBaseCtx?.activeBaseId ?? actorProfile?.base_id ?? null;
  const activeBase = activeBaseCtx?.activeBase ?? null;

  const mapBounds = useMemo<LatLngBoundsExpression>(
    () => [
      [0, 0],
      [mapImageSize.height, mapImageSize.width],
    ],
    [mapImageSize],
  );

  const orderedMapImagePaths = useMemo(() => {
    return pavimentos.map((item) => ({
      key: item.key,
      candidates: buildFloorImageCandidates(
        item.imageBase,
        item.imagePreview,
        supportsWebp,
        item.key,
      ),
    }));
  }, [pavimentos, supportsWebp]);

  const hasDisplayablePlant = useMemo(
    () => floorHasDisplayablePlant(pavimento.imageBase, pavimento.imagePreview, pavimento.key),
    [pavimento.imageBase, pavimento.imagePreview, pavimento.key],
  );

  const loadGenerationRef = useRef(0);

  const loadExtintores = useCallback(async (opts?: { quiet?: boolean; generation?: number }) => {
    const generation = opts?.generation ?? loadGenerationRef.current;
    if (!opts?.quiet) setLoading(true);
    const selectFull =
      "id,codigo,setor,local_detalhado,num_inmetro,num_cilindro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id,pavimento";
    const selectLegacy =
      "id,codigo,setor,local_detalhado,num_inmetro,num_cilindro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,pavimento";

    let query = supabase.from("extintores").select(selectFull).order("codigo", { ascending: true });
    if (activeBaseId) query = query.eq("base_id", activeBaseId);
    query = query.eq("active", true);

    let { data, error } = await query;

    if (error && /coord_x_norm|floor_id|schema cache|column/i.test(error.message)) {
      let fallback = supabase.from("extintores").select(selectLegacy).order("codigo", { ascending: true });
      if (activeBaseId) fallback = fallback.eq("base_id", activeBaseId);
      const retry = await fallback;
      if (!retry.error) {
        data = retry.data as typeof data;
        error = retry.error;
      }
    }

    if (generation !== loadGenerationRef.current) return;

    if (error) {
      setMessage(`Erro ao carregar extintores: ${error.message}`);
      if (!opts?.quiet) setLoading(false);
      return;
    }

    setExtintores((data ?? []) as Extintor[]);
    if (!opts?.quiet) setLoading(false);
  }, [supabase, activeBaseId]);

  const loadConferenciasDoMes = useCallback(async () => {
    const { ok, rows } = await fetchChecklistsExtintoresDoMes(
      supabase,
      currentMonthRange.startIso,
      currentMonthRange.endInclusiveIso,
      activeBaseId,
    );
    if (!ok) return;

    setUltimoChecklistExtintorMes(buildUltimoPorExtintor(rows));
    setConferidosNoMesIds(new Set(rows.map((r) => r.extintor_id).filter(Boolean)));
  }, [supabase, currentMonthRange.startIso, currentMonthRange.endInclusiveIso, activeBaseId]);

  const loadHidrantesEMarcadores = useCallback(async (generation?: number) => {
    const gen = generation ?? loadGenerationRef.current;
    const hidSelectFull =
      "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id";
    const hidSelectLegacy =
      "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos,coord_x,coord_y";

    let hidrantesQuery = supabase.from("hidrantes").select(hidSelectFull).eq("active", true);
    if (activeBaseId) hidrantesQuery = hidrantesQuery.eq("base_id", activeBaseId);

    let hData: HidranteRow[] | null = null;
    let hError: { message: string } | null = null;

    let h = await hidrantesQuery;
    if (h.error && /coord_x_norm|floor_id|active|schema cache|column/i.test(h.error.message)) {
      let fallback = supabase.from("hidrantes").select(hidSelectLegacy);
      if (activeBaseId) fallback = fallback.eq("base_id", activeBaseId);
      const retry = await fallback;
      hData = (retry.data ?? null) as HidranteRow[] | null;
      hError = retry.error;
    } else {
      hData = (h.data ?? null) as HidranteRow[] | null;
      hError = h.error;
    }

    const [marcadoresRows] = await Promise.all([
      fetchMarcadoresEmergenciaForMap(supabase, activeBaseId),
    ]);

    if (gen !== loadGenerationRef.current) return;

    if (!hError) setHidrantes(hData ?? []);
    setMarcadoresEmergencia(marcadoresRows as MarcadorEmergenciaRow[]);
  }, [supabase, activeBaseId]);

  const loadConferenciasHidrantesDoMes = useCallback(async () => {
    const { ok, rows } = await fetchChecklistsHidrantesDoMes(
      supabase,
      currentMonthRange.startIso,
      currentMonthRange.endInclusiveIso,
      activeBaseId,
    );
    if (!ok) return;

    setUltimoChecklistHidranteMes(buildUltimoPorHidrante(rows));
    setConferidosHidranteMesIds(new Set(rows.map((r) => r.hidrante_id).filter(Boolean)));
  }, [supabase, currentMonthRange.startIso, currentMonthRange.endInclusiveIso, activeBaseId]);

  useEffect(() => {
    if (!activeBaseId) {
      setPavimentos(FALLBACK_PAVIMENTOS);
      return;
    }

    let cancelled = false;
    const loadFloors = async () => {
      try {
        const floors = await fetchBaseFloors(activeBaseId);
        if (cancelled) return;
        const activeFloors = floors.filter((f) => f.active);
        if (activeFloors.length === 0) {
          setPavimentos(FALLBACK_PAVIMENTOS);
          setPavimento(FALLBACK_PAVIMENTOS[0]);
          return;
        }
        const mapped = activeFloors.map(mapBaseFloorToPavimento);
        setPavimentos(mapped);
        const persisted = readMapViewState(activeBaseId);
        setPavimento((prev) => {
          if (persisted?.floorKey) {
            const fromStorage = mapped.find((item) => item.key === persisted.floorKey);
            if (fromStorage) return fromStorage;
          }
          return mapped.find((item) => item.key === prev.key) ?? mapped[0];
        });
        if (persisted?.mode) setMode(persisted.mode);
        if (persisted?.filtroEquipe !== undefined) setFiltroEquipe(persisted.filtroEquipe as EquipeConferenciaId | "");
        if (persisted?.showExtintor !== undefined || persisted?.showHidrante !== undefined) {
          setShowLayers({
            extintor: persisted.showExtintor ?? true,
            hidrante: persisted.showHidrante ?? true,
          });
        }
      } catch {
        if (cancelled) return;
        setPavimentos(FALLBACK_PAVIMENTOS);
        setPavimento(FALLBACK_PAVIMENTOS[0]);
      }
    };

    void loadFloors();
    return () => {
      cancelled = true;
    };
  }, [activeBaseId]);

  useEffect(() => {
    let cancelled = false;
    const loadQuestions = async () => {
      const [extRows, hidRows] = await Promise.all([
        fetchChecklistQuestionsForBase(activeBaseId, "extintor"),
        fetchChecklistQuestionsForBase(activeBaseId, "hidrante"),
      ]);
      if (cancelled) return;
      setExtintorChecklistFields(
        extRows.map((row) => ({
          key: row.item_key,
          label: row.label,
        })),
      );
      setHidranteChecklistFields(
        hidRows.map((row) => ({
          key: row.item_key,
          label: row.label,
        })),
      );
    };
    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [activeBaseId]);

  useEffect(() => {
    setMapImageSize({
      width: pavimento.imageWidth && pavimento.imageWidth > 0 ? pavimento.imageWidth : FULL_IMAGE_WIDTH,
      height:
        pavimento.imageHeight && pavimento.imageHeight > 0 ? pavimento.imageHeight : FULL_IMAGE_HEIGHT,
    });
  }, [pavimento]);

  useEffect(() => {
    const channel = supabase
      .channel("mapview-checklists-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklists" },
        () => {
          void loadConferenciasDoMes();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadConferenciasDoMes, supabase]);

  useEffect(() => {
    loadGenerationRef.current += 1;
    const generation = loadGenerationRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadExtintores({ generation });
    void loadHidrantesEMarcadores(generation);
    const mesAposSessao = async () => {
      await getCurrentSession();
      await loadConferenciasDoMes();
      await loadConferenciasHidrantesDoMes();
    };
    void mesAposSessao();
  }, [loadConferenciasDoMes, loadConferenciasHidrantesDoMes, loadExtintores, loadHidrantesEMarcadores]);

  useEffect(() => {
    writeMapViewState(activeBaseId, {
      floorKey: pavimento.key,
      mode,
      filtroEquipe,
      showExtintor: showLayers.extintor,
      showHidrante: showLayers.hidrante,
    });
  }, [activeBaseId, pavimento.key, mode, filtroEquipe, showLayers.extintor, showLayers.hidrante]);

  useEffect(() => {
    let mounted = true;
    const resolvePermissions = async () => {
      try {
        const session = await getCurrentSession();
        if (!session) {
          if (mounted) {
            setCanEdit(false);
            setCanInspect(false);
            setMode("edicao");
          }
          return;
        }
        const profile = await getProfileBySession(session);
        const role = profile?.role;
        const editAllowed = role ? canUseMapEditing(role) : false;
        const inspectAllowed = role ? canUseMapInspection(role) : false;
        const nome = resolveConferenteNome(session, profile);
        if (mounted) {
          setCanEdit(editAllowed);
          setCanInspect(inspectAllowed);
          setActorProfile(profile);
          setConferenteNome(nome);
          setChecklistForm((prev) => ({
            ...prev,
            conferente:
              !prev.conferente.trim() || isCargoLabel(prev.conferente) ? nome : prev.conferente,
          }));
          setHidranteChecklistForm((prev) => ({
            ...prev,
            conferente:
              !prev.conferente.trim() || isCargoLabel(prev.conferente) ? nome : prev.conferente,
          }));
          setMode(() => {
            const persisted = readMapViewState(profile?.base_id ?? null);
            if (inspectAllowed && !editAllowed) return "inspecao";
            if (persisted?.mode === "edicao" && !editAllowed) return "inspecao";
            if (persisted?.mode) return persisted.mode;
            return inspectAllowed ? "inspecao" : "edicao";
          });
          if (inspectAllowed) {
            void loadConferenciasDoMes();
            void loadConferenciasHidrantesDoMes();
          }
        }
      } catch {
        if (mounted) {
          setCanEdit(false);
          setCanInspect(false);
          setMode("edicao");
        }
      }
    };

    void resolvePermissions();

    return () => {
      mounted = false;
    };
  }, [loadConferenciasDoMes, loadConferenciasHidrantesDoMes]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MAP_MOBILE_MAX_WIDTH_PX}px)`);
    const handleMediaChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    const currentIndex = orderedMapImagePaths.findIndex((item) => item.key === pavimento.key);
    if (currentIndex === -1) return;

    const nextItem =
      orderedMapImagePaths[(currentIndex + 1) % orderedMapImagePaths.length];
    if (!nextItem || nextItem.key === pavimento.key) return;

    const preloadOne = (paths: string[]) => {
      for (const path of paths) {
        if (preloadedImages.has(path)) continue;
        const image = new Image();
        image.src = path;
        image.onload = () => preloadedImages.add(path);
      }
    };

    const idleCb = () => preloadOne(nextItem.candidates);

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleWindow = window as Window &
        typeof globalThis & {
          requestIdleCallback: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
          cancelIdleCallback: (id: number) => void;
        };
      const idleId = idleWindow.requestIdleCallback(idleCb, { timeout: 2000 });
      return () => idleWindow.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(idleCb, 500);
    return () => globalThis.clearTimeout(timeoutId);
  }, [orderedMapImagePaths, pavimento.key]);

  useEffect(() => {
    setPlantStatus("loading");
    setPlantRetryKey(0);
  }, [pavimento.key]);

  const retryPlantLoad = useCallback(() => {
    setPlantRetryKey((key) => key + 1);
    setPlantStatus("loading");
  }, []);

  const plantStatusOverlay = hasDisplayablePlant ? (
    plantStatus !== "ready" && (
      <MapFloorPlantStatusOverlay
        status={plantStatus}
        onRetry={retryPlantLoad}
        showAdminConfigHint={canEdit}
      />
    )
  ) : (
    <MapFloorPlantStatusOverlay status="error" showAdminConfigHint={canEdit} />
  );

  const extintoresSemPosicao = useMemo(() => {
    const list = extintores.filter((item) => isUnplacedOnFloor(item, pavimento));
    return [...list].sort(compareExtintorCodigoAsc);
  }, [extintores, pavimento]);

  const floorRef = useMemo(() => floorRefFromPavimento(pavimento), [pavimento]);

  const markersDoPavimento = useMemo(() => {
    const list = extintores.filter(
      (item) =>
        hasStoredMapPosition(item) && itemMatchesFloor(item, floorRef),
    );
    const sorted = [...list].sort(compareExtintorCodigoAsc);
    return filtrarPorEquipe(sorted, filtroEquipe, "extintor");
  }, [extintores, floorRef, filtroEquipe]);

  const hidrantesSemPosicao = useMemo(
    () =>
      hidrantes.filter(
        (item) => !hasStoredMapPosition(item) && itemMatchesFloor(item, floorRef),
      ),
    [hidrantes, floorRef],
  );

  const hidrantesDoPavimento = useMemo(() => {
    const list = hidrantes.filter(
      (item) => hasStoredMapPosition(item) && itemMatchesFloor(item, floorRef),
    );
    return filtrarPorEquipe(list, filtroEquipe, "hidrante");
  }, [hidrantes, floorRef, filtroEquipe]);

  const highlightedMarkerId = infoMarker?.id ?? infoHidrante?.id ?? null;

  const filteredMarkersDoPavimento = useMemo(() => {
    const q = buscaEquipamento.trim().toLowerCase();
    return markersDoPavimento.filter((item) => {
      if (filtroPendentes && conferidosNoMesIds.has(item.id)) return false;
      if (!q) return true;
      const loc = formatExtintorLocalizacao(item).toLowerCase();
      const tipo = formatExtintorTipoCapacidade(item).toLowerCase();
      return item.codigo.toLowerCase().includes(q) || loc.includes(q) || tipo.includes(q);
    });
  }, [markersDoPavimento, buscaEquipamento, filtroPendentes, conferidosNoMesIds]);

  const filteredHidrantesDoPavimento = useMemo(() => {
    const q = buscaEquipamento.trim().toLowerCase();
    return hidrantesDoPavimento.filter((h) => {
      if (filtroPendentes && conferidosHidranteMesIds.has(h.id)) return false;
      if (!q) return true;
      const loc = (h.local_detalhado ?? "").toLowerCase();
      return h.codigo.toLowerCase().includes(q) || loc.includes(q);
    });
  }, [hidrantesDoPavimento, buscaEquipamento, filtroPendentes, conferidosHidranteMesIds]);

  const equipmentDetail = useMemo((): MapEquipmentDetail | null => {
    if (infoMarker) {
      const ult = ultimoChecklistExtintorMes.get(infoMarker.id);
      const nc = ult ? checklistTemNaoConformidade(ult) : false;
      const conferido = conferidosNoMesIds.has(infoMarker.id);
      const maint = getMaintenanceStatus(infoMarker);
      return {
        kind: "extintor",
        codigo: infoMarker.codigo,
        localizacao: formatExtintorLocalizacao(infoMarker),
        tipoCapacidade: formatExtintorTipoCapacidade(infoMarker),
        pavimentoLabel: pavimento.label,
        statusLabel: nc ? "Não conformidade" : conferido ? "Conferido no mês" : "Pendente",
        statusTone: nc ? "red" : conferido ? "green" : "amber",
        manutencaoLabel: maint,
        manutencaoTone:
          maint === "Vencido"
            ? "red"
            : maint === "Próximo de vencer (30 dias)"
              ? "amber"
              : "green",
      };
    }
    if (infoHidrante) {
      const ult = ultimoChecklistHidranteMes.get(infoHidrante.id);
      const nc = ult ? hidranteChecklistTemNaoConformidade(ult as Record<string, string | null>) : false;
      const conferido = conferidosHidranteMesIds.has(infoHidrante.id);
      return {
        kind: "hidrante",
        codigo: infoHidrante.codigo,
        localizacao: infoHidrante.local_detalhado || "—",
        pavimentoLabel: pavimento.label,
        statusLabel: nc ? "Não conformidade" : conferido ? "Conferido no mês" : "Pendente",
        statusTone: nc ? "red" : conferido ? "green" : "amber",
      };
    }
    return null;
  }, [
    infoMarker,
    infoHidrante,
    ultimoChecklistExtintorMes,
    ultimoChecklistHidranteMes,
    conferidosNoMesIds,
    conferidosHidranteMesIds,
    pavimento.label,
  ]);

  const mostrarFiltroEquipe =
    mode === "inspecao" && canInspect && baseHasEquipesConferencia(activeBase);

  useEffect(() => {
    if (!baseHasEquipesConferencia(activeBase)) {
      setFiltroEquipe("");
    }
  }, [activeBase]);

  const marcadoresDoPavimento = useMemo(
    () => marcadoresEmergencia.filter((m) => marcadorMatchesFloor(m, floorRef)),
    [marcadoresEmergencia, floorRef],
  );

  // Clique sempre ativo em edição: se nada estiver selecionado, mostramos orientação ao usuário.
  const mapClickPlacementEnabled = canEdit && mode === "edicao";

  function extintorMarkerStyle(item: Extintor): MarkerColors {
    const ult = ultimoChecklistExtintorMes.get(item.id);
    return extintorMarkerColors(item, conferidosNoMesIds.has(item.id), ult);
  }

  function hidranteMarkerStyle(h: HidranteRow): MarkerColors {
    const ult = ultimoChecklistHidranteMes.get(h.id);
    return hidranteMarkerColors(h, conferidosHidranteMesIds.has(h.id), ult as Record<string, string | null> | undefined);
  }

  /** Luz/placa: âmbar fora do mês; no mês verde (conforme) ou vermelho (NC). */
  function marcadorEmergenciaIconColor(m: MarcadorEmergenciaRow): "green" | "red" | "amber" {
    if (!isIsoDateWithinInclusiveRange(m.verified_at, currentMonthRange.startIso, currentMonthRange.endInclusiveIso)) {
      return "amber";
    }
    if (m.inspecao_resultado === "nao_conforme") return "red";
    return "green";
  }

  async function handleMapClick(lat: number, lng: number) {
    if (mode !== "edicao" || !canEdit) return;

    if (placementExtra == null && !selectedExtintorId) {
      setMessage(
        extintoresSemPosicao.length === 0
          ? "Nenhum extintor sem posição neste setor. Cadastre o extintor em Extintores e Hidrantes (com o setor deste mapa) e volte aqui."
          : "Selecione um extintor na lista “sem posição” e clique de novo no mapa para posicionar.",
      );
      return;
    }

    if (placementExtra === "hidrante" && !selectedHidranteId) {
      setMessage(
        hidrantesSemPosicao.length === 0
          ? "Nenhum hidrante sem posição neste setor. Cadastre o hidrante em Extintores e Hidrantes e volte aqui."
          : "Selecione um hidrante na lista “sem posição” e clique de novo no mapa para posicionar.",
      );
      return;
    }

    if (placementExtra === "luz_emergencia" || placementExtra === "placa_saida_emergencia") {
      const raw = typeof window !== "undefined" ? window.prompt("Quantidade (1–999)", "1") : "1";
      const parsed = Number.parseInt(String(raw ?? "1"), 10);
      const qty = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 999) : 1;

      setSavingPosition(true);
      setMessage("");
      const coords = placementPayload(lat, lng, pavimento, mapImageSize);
      const { error } = await supabase.from("marcadores_emergencia").insert({
        kind: placementExtra,
        pavimento: pavimento.label,
        coord_x: coords.coord_x,
        coord_y: coords.coord_y,
        coord_x_norm: coords.coord_x_norm,
        coord_y_norm: coords.coord_y_norm,
        quantidade: qty,
        ...(activeBaseId ? { base_id: activeBaseId } : {}),
        ...(pavimento.id ? { floor_id: pavimento.id } : {}),
      });
      if (error) {
        setMessage(`Erro ao salvar marcador: ${error.message}`);
      } else {
        setMessage("Marcador de emergência adicionado.");
        await loadHidrantesEMarcadores();
      }
      setSavingPosition(false);
      return;
    }

    if (placementExtra === "hidrante" && selectedHidranteId) {
      setSavingPosition(true);
      setMessage("");
      const placedId = selectedHidranteId;
      const coords = placementPayload(lat, lng, pavimento, mapImageSize);
      const { data, error } = await supabase
        .from("hidrantes")
        .update(coords)
        .eq("id", placedId)
        .select("id,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id,pavimento")
        .maybeSingle();
      if (error) {
        setMessage(`Erro ao salvar hidrante: ${error.message}`);
        setSavingPosition(false);
        return;
      }
      if (!data || !hasStoredMapPosition(data as MapCoordinateFields)) {
        setMessage(
          "Não foi possível salvar a posição do hidrante (sem permissão ou o registro não foi atualizado).",
        );
        setSavingPosition(false);
        return;
      }

      setHidrantes((prev) =>
        prev.map((item) =>
          item.id === placedId
            ? {
                ...item,
                coord_x: Number(data.coord_x),
                coord_y: Number(data.coord_y),
                coord_x_norm: data.coord_x_norm != null ? Number(data.coord_x_norm) : coords.coord_x_norm,
                coord_y_norm: data.coord_y_norm != null ? Number(data.coord_y_norm) : coords.coord_y_norm,
                floor_id: data.floor_id ? String(data.floor_id) : pavimento.id ?? null,
                pavimento: String(data.pavimento ?? pavimento.label),
              }
            : item,
        ),
      );
      setSelectedHidranteId("");
      setMessage("Posição do hidrante salva.");
      await loadHidrantesEMarcadores();
      setSavingPosition(false);
      return;
    }

    if (!selectedExtintorId) return;

    setSavingPosition(true);
    setMessage("");

    const placedId = selectedExtintorId;
    const coords = placementPayload(lat, lng, pavimento, mapImageSize);
    const { data, error } = await supabase
      .from("extintores")
      .update(coords)
      .eq("id", placedId)
      .select("id,coord_x,coord_y,coord_x_norm,coord_y_norm,floor_id,pavimento,setor")
      .maybeSingle();

    if (error) {
      setMessage(`Erro ao salvar posição: ${error.message}`);
      setSavingPosition(false);
      return;
    }
    if (!data || !hasStoredMapPosition(data as MapCoordinateFields)) {
      setMessage(
        "Não foi possível salvar a posição (sem permissão ou o registro não foi atualizado). Se você é Administrador Corporativo, rode a migration de RLS de coordenadas.",
      );
      setSavingPosition(false);
      return;
    }

    setExtintores((prev) =>
      prev.map((item) =>
        item.id === placedId
          ? {
              ...item,
              coord_x: Number(data.coord_x),
              coord_y: Number(data.coord_y),
              coord_x_norm: data.coord_x_norm != null ? Number(data.coord_x_norm) : coords.coord_x_norm,
              coord_y_norm: data.coord_y_norm != null ? Number(data.coord_y_norm) : coords.coord_y_norm,
              floor_id: data.floor_id ? String(data.floor_id) : pavimento.id ?? null,
              pavimento: String(data.pavimento ?? pavimento.label),
              setor: String(data.setor ?? item.setor),
            }
          : item,
      ),
    );
    setSelectedExtintorId("");
    setMessage("Posição salva com sucesso.");
    // Reload silencioso: não pisca loading e confirma o que veio do banco.
    await loadExtintores({ quiet: true });
    setSavingPosition(false);
  }

  function openChecklistModal(extintor: Extintor) {
    setActiveExtintorFields(
      extintorChecklistFields.length > 0
        ? extintorChecklistFields
        : CHECKLIST_ITEM_KEYS.map((key) => ({
            key,
            label: DEFAULT_EXTINTOR_QUESTION_LABELS[key],
          })),
    );
    setSelectedMarker(extintor);
    setChecklistForm({ ...INITIAL_CHECKLIST, conferente: conferenteNome, detalhesNaoConformidade: {} });
  }

  function openHidranteChecklistModal(h: HidranteRow) {
    setActiveHidranteFields(
      hidranteChecklistFields.length > 0
        ? hidranteChecklistFields
        : HIDRANTE_ACTIVE_ITEM_KEYS.map((key) => ({
            key,
            label: HIDRANTE_ITEM_LABELS[key as HidranteItemKey],
          })),
    );
    setSelectedHidrante(h);
    setHidranteChecklistForm({ ...HIDRANTE_CHECKLIST_INITIAL, conferente: conferenteNome, detalhesNaoConformidade: {} });
  }

  async function removeMarker(extintor: Extintor) {
    setInfoMarker(null);
    setSavingPosition(true);
    setMessage("");

    const { data, error } = await supabase
      .from("extintores")
      .update({
        coord_x: null,
        coord_y: null,
        coord_x_norm: null,
        coord_y_norm: null,
        floor_id: null,
        pavimento: null,
      })
      .eq("id", extintor.id)
      .select("id,coord_x,coord_y,coord_x_norm,coord_y_norm")
      .maybeSingle();

    if (error) {
      setMessage(`Erro ao remover posição: ${error.message}`);
      setSavingPosition(false);
      return;
    }
    if (!data || hasStoredMapPosition(data as MapCoordinateFields)) {
      setMessage(
        "Não foi possível remover o marcador (sem permissão ou o registro não foi atualizado).",
      );
      setSavingPosition(false);
      return;
    }

    setExtintores((prev) =>
      prev.map((item) =>
        item.id === extintor.id
          ? {
              ...item,
              coord_x: null,
              coord_y: null,
              coord_x_norm: null,
              coord_y_norm: null,
              floor_id: null,
              pavimento: null,
            }
          : item,
      ),
    );
    setMessage(`Marcador de ${extintor.codigo} removido.`);
    await loadExtintores();
    setSavingPosition(false);
  }

  async function saveChecklist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMarker) return;

    setSavingChecklist(true);
    setMessage("");

    try {
      const session = await getCurrentSession();
      if (!session) {
        setMessage("Sessão expirada. Faça login novamente para salvar a inspeção.");
        return;
      }

      const profile = session
        ? await getProfileBySession(session).catch(() => actorProfile)
        : actorProfile;
      const conferente =
        resolveConferenteNome(session, profile ?? actorProfile, checklistForm.conferente) ||
        conferenteNome.trim();
      if (!conferente) {
        setMessage("Informe o nome do conferente.");
        return;
      }

      let baseId = activeBaseId;
      if (!baseId) {
        const { data: extRow } = await supabase
          .from("extintores")
          .select("base_id")
          .eq("id", selectedMarker.id)
          .maybeSingle();
        baseId = extRow?.base_id ? String(extRow.base_id) : null;
      }

      const fields =
        activeExtintorFields.length > 0
          ? activeExtintorFields
          : CHECKLIST_ITEM_KEYS.map((key) => ({
              key,
              label: DEFAULT_EXTINTOR_QUESTION_LABELS[key],
            }));
      const fieldLabels = Object.fromEntries(fields.map((field) => [field.key, field.label]));

      const { ok, error, payload } = await insertExtintorChecklist(supabase, {
        extintorId: selectedMarker.id,
        baseId,
        conferente,
        data: checklistForm,
        fieldKeys: fields.map((field) => field.key),
        fieldLabels,
      });

      if (!ok) {
        setMessage(`Erro ao salvar checklist: ${error?.message ?? "Falha desconhecida"}`);
        return;
      }

      const ts = String(payload.data_conferencia);
      const checklistRowMes: ChecklistExtintorMesRow = {
        extintor_id: selectedMarker.id,
        data_conferencia: ts,
        local_correto: getChecklistAnswer(checklistForm, "local_correto"),
        dados_corretos: getChecklistAnswer(checklistForm, "dados_corretos"),
        sinalizacao_correta: getChecklistAnswer(checklistForm, "sinalizacao_correta"),
        mangueira_status: getChecklistAnswer(checklistForm, "mangueira_status"),
        bico_difusor_status: getChecklistAnswer(checklistForm, "bico_difusor_status"),
        alca_gatilho_status: getChecklistAnswer(checklistForm, "alca_gatilho_status"),
        medidor_pressao_status: getChecklistAnswer(checklistForm, "medidor_pressao_status"),
        cilindro_status: getChecklistAnswer(checklistForm, "cilindro_status"),
      };
      setUltimoChecklistExtintorMes((prev) => {
        const next = new Map(prev);
        const existing = next.get(selectedMarker.id);
        if (
          existing &&
          new Date(existing.data_conferencia).getTime() >
            new Date(checklistRowMes.data_conferencia).getTime()
        ) {
          return prev;
        }
        next.set(selectedMarker.id, checklistRowMes);
        return next;
      });
      setConferidosNoMesIds((prev) => {
        const next = new Set(prev);
        next.add(selectedMarker.id);
        return next;
      });

      setSelectedMarker(null);
      setChecklistForm({ ...INITIAL_CHECKLIST, conferente: conferenteNome, detalhesNaoConformidade: {} });
      setMessage("Checklist salvo com sucesso.");
      await loadConferenciasDoMes();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro inesperado ao salvar checklist.");
    } finally {
      setSavingChecklist(false);
    }
  }

  async function saveHidranteChecklist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedHidrante) return;

    setSavingHidranteChecklist(true);
    setMessage("");

    try {
      const session = await getCurrentSession();
      if (!session) {
        setMessage("Sessão expirada. Faça login novamente para salvar a inspeção.");
        return;
      }

      const profile = session
        ? await getProfileBySession(session).catch(() => actorProfile)
        : actorProfile;
      const conferente =
        resolveConferenteNome(session, profile ?? actorProfile, hidranteChecklistForm.conferente) ||
        conferenteNome.trim();
      if (!conferente) {
        setMessage("Informe o nome do conferente.");
        return;
      }

      let baseId = activeBaseId;
      if (!baseId) {
        const { data: hidRow } = await supabase
          .from("hidrantes")
          .select("base_id")
          .eq("id", selectedHidrante.id)
          .maybeSingle();
        baseId = hidRow?.base_id ? String(hidRow.base_id) : null;
      }

      const fields =
        activeHidranteFields.length > 0
          ? activeHidranteFields
          : HIDRANTE_ACTIVE_ITEM_KEYS.map((key) => ({
              key,
              label: HIDRANTE_ITEM_LABELS[key as HidranteItemKey],
            }));
      const fieldLabels = Object.fromEntries(fields.map((field) => [field.key, field.label]));

      const { ok, error, payload } = await insertHidranteChecklist(supabase, {
        hidranteId: selectedHidrante.id,
        baseId,
        conferente,
        data: hidranteChecklistForm,
        fieldKeys: fields.map((field) => field.key),
        fieldLabels,
      });

      if (!ok) {
        setMessage(`Erro ao salvar inspeção do hidrante: ${error?.message ?? "Falha desconhecida"}`);
        return;
      }

      const tsH = String(payload.data_conferencia);
      const hidRowMes: ChecklistHidranteMesRow = {
        hidrante_id: selectedHidrante.id,
        data_conferencia: tsH,
        acesso_desobstruido: getHidranteAnswer(hidranteChecklistForm, "acesso_desobstruido"),
        identificacao_sinalizacao: getHidranteAnswer(hidranteChecklistForm, "identificacao_sinalizacao"),
        mangueira_esguicho: getHidranteAnswer(hidranteChecklistForm, "mangueira_esguicho"),
        valvulas_registros: getHidranteAnswer(hidranteChecklistForm, "valvulas_registros"),
        pressao_abastecimento: getHidranteAnswer(hidranteChecklistForm, "pressao_abastecimento"),
        gabinete_caixa: getHidranteAnswer(hidranteChecklistForm, "gabinete_caixa"),
        hidrante_integridade: getHidranteAnswer(hidranteChecklistForm, "hidrante_integridade"),
        documentacao_acesso: getHidranteAnswer(hidranteChecklistForm, "documentacao_acesso"),
      };
      setUltimoChecklistHidranteMes((prev) => {
        const next = new Map(prev);
        const existing = next.get(selectedHidrante.id);
        if (
          existing &&
          new Date(existing.data_conferencia).getTime() > new Date(hidRowMes.data_conferencia).getTime()
        ) {
          return prev;
        }
        next.set(selectedHidrante.id, hidRowMes);
        return next;
      });
      setConferidosHidranteMesIds((prev) => {
        const next = new Set(prev);
        next.add(selectedHidrante.id);
        return next;
      });

      setSelectedHidrante(null);
      setHidranteChecklistForm({
        ...HIDRANTE_CHECKLIST_INITIAL,
        conferente: conferenteNome,
        detalhesNaoConformidade: {},
      });
      setMessage("Inspeção do hidrante salva com sucesso.");
      await loadConferenciasHidrantesDoMes();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Erro inesperado ao salvar inspeção do hidrante.",
      );
    } finally {
      setSavingHidranteChecklist(false);
    }
  }

  async function salvarInspecaoEmergencia(m: MarcadorEmergenciaRow, resultado: "conforme" | "nao_conforme") {
    let descricaoNc: string | null = null;
    if (resultado === "nao_conforme") {
      const texto = typeof window !== "undefined" ? window.prompt("Descreva a não conformidade (obrigatório):") : null;
      const trimmed = (texto ?? "").trim();
      if (!trimmed) {
        setMessage("Não conforme: é obrigatório informar a descrição.");
        setTimeout(() => setMessage(""), 4500);
        return;
      }
      descricaoNc = trimmed;
    }

    setSavingPosition(true);
    setMessage("");
    const verifiedAt = new Date().toISOString();
    const session = await getCurrentSession();
    const profile = session
      ? await getProfileBySession(session).catch(() => actorProfile)
      : actorProfile;
    const verifiedBy =
      resolveConferenteNome(session, profile ?? actorProfile) || conferenteNome.trim() || "Conferente";

    let markerError = (
      await supabase
        .from("marcadores_emergencia")
        .update({
          verified_at: verifiedAt,
          verified_by: verifiedBy,
          inspecao_resultado: resultado,
          nao_conformidade_descricao: resultado === "conforme" ? null : descricaoNc,
        })
        .eq("id", m.id)
    ).error;

    let atualizouMarcadorLegado = false;
    if (
      markerError &&
      (markerError.message.includes("schema cache") ||
        markerError.message.includes("column") ||
        markerError.message.includes("inspecao_resultado") ||
        markerError.message.includes("nao_conformidade"))
    ) {
      const legacy = await supabase
        .from("marcadores_emergencia")
        .update({ verified_at: verifiedAt, verified_by: verifiedBy })
        .eq("id", m.id);
      markerError = legacy.error;
      atualizouMarcadorLegado = !markerError;
    }

    if (markerError) {
      setMessage(`Erro: ${markerError.message}`);
      setSavingPosition(false);
      setTimeout(() => setMessage(""), 4500);
      return;
    }

    const { error: auditError } = await supabase.from("inspecoes_marcadores_emergencia").insert({
      marcador_emergencia_id: m.id,
      marcador_kind: m.kind,
      pavimento: m.pavimento,
      data_inspecao: verifiedAt,
      conferente: verifiedBy,
      inspecao_resultado: resultado,
      nao_conformidade_descricao: resultado === "conforme" ? null : descricaoNc,
      ...(activeBaseId ? { base_id: activeBaseId } : {}),
    });

    if (auditError) {
      const base = atualizouMarcadorLegado
        ? "Marcador atualizado."
        : resultado === "conforme"
          ? "Inspeção registrada como conforme."
          : "Inspeção registrada como não conforme.";
      setMessage(
        `${base} Aviso: histórico de auditoria não gravado — crie a tabela inspecoes_marcadores_emergencia (SQL em docs/migration_mapa_recursos.sql). ${auditError.message}`,
      );
    } else if (atualizouMarcadorLegado) {
      setMessage(
        "Inspeção salva no histórico de auditoria e no marcador. Rode a migração em docs/migration_mapa_recursos.sql para gravar conforme/NC também no ponto do mapa.",
      );
    } else {
      setMessage(resultado === "conforme" ? "Inspeção registrada como conforme." : "Inspeção registrada como não conforme.");
    }

    setInfoEmergencia(null);
    await loadHidrantesEMarcadores();
    setSavingPosition(false);
    setTimeout(() => setMessage(""), 4500);
  }

  async function removerMarcadorEmergencia(m: MarcadorEmergenciaRow) {
    if (!window.confirm("Remover este marcador do mapa?")) return;
    setSavingPosition(true);
    const { error } = await supabase.from("marcadores_emergencia").delete().eq("id", m.id);
    if (error) setMessage(error.message);
    else {
      setInfoEmergencia(null);
      await loadHidrantesEMarcadores();
    }
    setSavingPosition(false);
  }

  async function removerHidranteDoMapa(h: HidranteRow) {
    setInfoHidrante(null);
    setSavingPosition(true);
    const { data, error } = await supabase
      .from("hidrantes")
      .update({
        coord_x: null,
        coord_y: null,
        coord_x_norm: null,
        coord_y_norm: null,
        floor_id: null,
        pavimento: null,
      })
      .eq("id", h.id)
      .select("id,coord_x,coord_y,coord_x_norm,coord_y_norm")
      .maybeSingle();
    if (error) {
      setMessage(error.message);
      setSavingPosition(false);
      return;
    }
    if (!data || hasStoredMapPosition(data as MapCoordinateFields)) {
      setMessage(
        "Não foi possível remover o hidrante do mapa (sem permissão ou o registro não foi atualizado).",
      );
      setSavingPosition(false);
      return;
    }

    setHidrantes((prev) =>
      prev.map((item) =>
        item.id === h.id
          ? {
              ...item,
              coord_x: null,
              coord_y: null,
              coord_x_norm: null,
              coord_y_norm: null,
              floor_id: null,
              pavimento: null,
            }
          : item,
      ),
    );
    setMessage(`Marcador de ${h.codigo} removido.`);
    await loadHidrantesEMarcadores();
    setSavingPosition(false);
  }

  async function cadastrarNovoHidrante() {
    const codigo = typeof window !== "undefined" ? window.prompt("Código do novo hidrante (ex.: H-01)?") : null;
    if (!codigo?.trim()) return;
    const { error } = await supabase.from("hidrantes").insert({
      codigo: codigo.trim(),
      pavimento: pavimento.label,
      local_detalhado: "",
      ...(activeBaseId ? { base_id: activeBaseId } : {}),
    });
    if (error) setMessage(`Erro: ${error.message}`);
    else {
      setMessage("Hidrante cadastrado. Selecione-o na lista e toque no mapa para posicionar.");
      await loadHidrantesEMarcadores();
    }
  }

  // Rotação por gesto no mobile conflita com pinch-zoom e causa travamentos.
  // Mantemos o plugin carregado, mas desligado no uso cotidiano do conferente.
  const leafletRotateOpts = { rotate: false, rotateControl: false };

  const mapContent = (
    <MapContainer
      key={`${pavimento.key}-${mapImageSize.width}x${mapImageSize.height}`}
      crs={L.CRS.Simple}
      preferCanvas
      zoomSnap={isMobile ? 0.5 : 0.25}
      zoomDelta={isMobile ? 1 : 0.5}
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
      inertia={false}
      wheelDebounceTime={isMobile ? 120 : 40}
      wheelPxPerZoomLevel={isMobile ? 120 : 60}
      zoomAnimationThreshold={4}
      maxBoundsViscosity={1}
      attributionControl={false}
      style={{ height: "100%", width: "100%", background: "#e8eaed" }}
      {...(leafletRotateOpts as Record<string, unknown>)}
    >
      <MapFitBounds
        bounds={mapBounds}
        maxZoomExtra={isMobile ? 4 : 5}
        bottomOffset={0}
        initialZoomOut={0}
        minZoomAbsolute={isMobile ? -4 : -6}
        boundsPad={isMobile ? 0.2 : 0.12}
      />
      <MapZoomStabilityGuard />
      <MapViewportSync onLodChange={setMarkerLod} enableDoubleTapZoom={isMobile} />
      <MapZoomControls
        bounds={mapBounds as LatLngBoundsLiteral}
        compact={isMobile}
      />
      {hasDisplayablePlant ? (
        <MapFloorPlantLayer
          imagePath={pavimento.imageBase}
          imagePathPreview={pavimento.imagePreview}
          floorKey={pavimento.key}
          bounds={mapBounds}
          preferWebp={supportsWebp}
          retryKey={plantRetryKey}
          onStatusChange={setPlantStatus}
        />
      ) : null}
      <MapClickPlacement enabled={mapClickPlacementEnabled} onClick={handleMapClick} />

      {showLayers.extintor &&
        filteredMarkersDoPavimento.map((item) => {
          const position = resolveLeafletPosition(item, mapImageSize.width, mapImageSize.height);
          if (!position) return null;
          const lod = effectiveMarkerLod(item.id, markerLod, highlightedMarkerId);
          const selected = item.id === highlightedMarkerId;
          return (
          <Marker
            key={item.id}
            position={position}
            icon={extinguisherIcon(extintorMarkerStyle(item), item.codigo, lod, selected)}
            eventHandlers={{
              click: () => {
                if (mode === "inspecao" && canInspect) {
                  setInfoHidrante(null);
                  setInfoEmergencia(null);
                  setInfoMarker(item);
                }
              },
              contextmenu: () => {
                if (isMobile && mode === "inspecao" && canInspect) setInfoMarker(item);
              },
            }}
          >
            {!(isMobile && mode === "inspecao") && (
              <Popup
                key={`ext-${item.id}-${isDataVencida(item.manutencao_2_nivel) ? 1 : 0}-${conferidosNoMesIds.has(item.id) ? 1 : 0}-${ultimoChecklistExtintorMes.get(item.id)?.data_conferencia ?? ""}`}
              >
                <div className="text-sm" style={{ minWidth: 160 }}>
                  <p className="font-semibold">{item.codigo}</p>
                  <p className="text-zinc-500">{formatExtintorLocalizacao(item)}</p>
                  {isDataVencida(item.manutencao_2_nivel) && (
                    <p className="mt-1 text-xs font-semibold text-red-700">⚠ Teste nível 2 vencido</p>
                  )}
                  {(() => {
                    const ult = ultimoChecklistExtintorMes.get(item.id);
                    const nc = ult ? checklistTemNaoConformidade(ult) : false;
                    return (
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          nc ? "text-red-700" : conferidosNoMesIds.has(item.id) ? "text-green-700" : "text-yellow-700"
                        }`}
                      >
                        {nc
                          ? "⚠ Não conformidade no mês"
                          : conferidosNoMesIds.has(item.id)
                            ? "✓ Conferido no mês"
                            : "⚠ Não conferido no mês"}
                      </p>
                    );
                  })()}
                  <p
                    className={`text-xs font-semibold ${
                      getMaintenanceStatus(item) === "Vencido"
                        ? "text-red-700"
                        : getMaintenanceStatus(item) === "Próximo de vencer (30 dias)"
                          ? "text-amber-700"
                          : "text-zinc-500"
                    }`}
                  >
                    Manutenção: {getMaintenanceStatus(item)}
                  </p>
                  {mode === "inspecao" && canInspect && (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-white"
                      style={{ background: "var(--forest)" }}
                      onClick={() => openChecklistModal(item)}
                    >
                      Realizar Conferência
                    </button>
                  )}
                  {canEdit && mode === "edicao" && (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-semibold text-red-600"
                      onClick={() => {
                        if (window.confirm(`Remover marcador de ${item.codigo} do mapa?`)) {
                          void removeMarker(item);
                        }
                      }}
                    >
                      🗑 Remover do Mapa
                    </button>
                  )}
                </div>
              </Popup>
            )}
          </Marker>
          );
        })}

      {showLayers.hidrante &&
        filteredHidrantesDoPavimento.map((h) => {
          const position = resolveLeafletPosition(h, mapImageSize.width, mapImageSize.height);
          if (!position) return null;
          const lod = effectiveMarkerLod(h.id, markerLod, highlightedMarkerId);
          const selected = h.id === highlightedMarkerId;
          return (
          <Marker
            key={h.id}
            position={position}
            icon={hydrantIcon(hidranteMarkerStyle(h), h.codigo, lod, selected)}
            eventHandlers={{
              click: () => {
                if (mode === "inspecao" && canInspect) {
                  setInfoMarker(null);
                  setInfoEmergencia(null);
                  setInfoHidrante(h);
                }
              },
              contextmenu: () => {
                if (isMobile && mode === "inspecao" && canInspect) setInfoHidrante(h);
              },
            }}
          >
            {!(isMobile && mode === "inspecao") && (
              <Popup>
                <div className="text-sm" style={{ minWidth: 160 }}>
                  <p className="font-semibold">{h.codigo}</p>
                  <p className="text-zinc-500">{h.local_detalhado || "—"}</p>
                  <p className="mt-1 text-xs font-semibold text-blue-700">Hidrante</p>
                  {mode === "inspecao" && canInspect && (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg bg-blue-700 py-1.5 text-xs font-semibold text-white"
                      onClick={() => openHidranteChecklistModal(h)}
                    >
                      Inspecionar hidrante
                    </button>
                  )}
                  {canEdit && mode === "edicao" && (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-semibold text-red-600"
                      onClick={() => {
                        if (window.confirm(`Remover ${h.codigo} do mapa?`)) void removerHidranteDoMapa(h);
                      }}
                    >
                      Remover do mapa
                    </button>
                  )}
                </div>
              </Popup>
            )}
          </Marker>
          );
        })}

    </MapContainer>
  );

  if (isMobile) {
    return (
      <main className="flex min-h-0 flex-1 w-full flex-col bg-[#f4f5f6]">
        {/* ── Barra conferente: setor + busca + filtros ── */}
        <div className="shrink-0 border-b border-[var(--border)] bg-white shadow-sm">
          <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-1">
            <select
              aria-label="Selecionar setor"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[#fafafa] px-3 py-2 text-xs font-semibold text-slate-700"
              value={pavimento.key}
              onChange={(event) => {
                const selected = pavimentos.find((item) => item.key === event.target.value);
                if (selected) setPavimento(selected);
              }}
            >
              {pavimentos.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>

            {canEdit && (
              <button
                type="button"
                className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold ${
                  mode === "edicao" ? "brand-gradient text-[var(--neon-ink)]" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setMode("edicao")}
              >
                Edição
              </button>
            )}
            {canInspect && canEdit && (
              <button
                type="button"
                className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold ${
                  mode === "inspecao" ? "brand-gradient text-[var(--neon-ink)]" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setMode("inspecao")}
              >
                Inspeção
              </button>
            )}
          </div>

          {canInspect && mode === "inspecao" && (
            <div className="flex items-center gap-1.5 px-2 pb-1">
              <input
                type="search"
                aria-label="Buscar equipamento"
                placeholder="Buscar equipamento"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                value={buscaEquipamento}
                onChange={(e) => setBuscaEquipamento(e.target.value)}
              />
              <button
                type="button"
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                  filtroPendentes ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setFiltroPendentes((prev) => !prev)}
              >
                Pendentes
              </button>
            </div>
          )}

          {mostrarFiltroEquipe && (
            <div className="px-2 pb-1">
              <select
                aria-label="Filtrar por equipe"
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                value={filtroEquipe}
                onChange={(e) => setFiltroEquipe(e.target.value as EquipeConferenciaId | "")}
              >
                <option value="">Todas as equipes</option>
                {EQUIPES_CONFERENCIA.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Linha 2: camadas + legenda */}
          <div className="flex items-center gap-1 px-2 pb-1.5">
            {(
              [
                ["extintor", "Ext"],
                ["hidrante", "Hid"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setShowLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  showLayers[key] ? "brand-gradient text-[var(--neon-ink)]" : "bg-slate-100 text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}

            {/* Legenda inline como popover simples (details) */}
            <details className="relative ml-auto text-[10px]">
              <summary className="cursor-pointer list-none rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
                Legenda
              </summary>
              <div className="absolute right-0 top-full z-[2000] mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <p className="font-semibold text-slate-700">Centro (fundo)</p>
                <p className="mt-0.5 text-slate-600">
                  <span className="font-semibold text-yellow-700">Âmbar</span> pendente ·{" "}
                  <span className="font-semibold text-green-700">Verde</span> conferido ok ·{" "}
                  <span className="font-semibold text-red-700">Vermelho</span> pendência ou NC
                </p>
                <p className="mt-1 font-semibold text-slate-700">Anel (conferência / alerta)</p>
                <p className="mt-0.5 text-slate-600">
                  <span className="font-semibold text-green-700">Verde</span> conferido no mês ·{" "}
                  <span className="font-semibold text-red-700">Vermelho</span> vencido ou NC após conferência
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Extintor vencido conferido: centro vermelho, anel verde. Hidrante com problema conferido: centro
                  vermelho, anel verde.
                </p>
              </div>
            </details>
          </div>
        </div>

        {/* Painel de edição — só aparece para admin no modo edição */}
        {canEdit && mode === "edicao" && (
          <div className="shrink-0 border-b border-slate-200 bg-white px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Posicionar:</span>
              {([
                [null, "Ext"],
                ["hidrante", "Hid"],
              ] as const).map(([val, label]) => (
                <button
                  key={String(val)}
                  type="button"
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    placementExtra === val ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                  onClick={() => {
                    setPlacementExtra(val);
                    if (val !== null) setSelectedExtintorId("");
                    if (val !== "hidrante") setSelectedHidranteId("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {placementExtra === null && (
              <select
                aria-label="Selecionar extintor sem posição"
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                value={selectedExtintorId}
                onChange={(event) => { setSelectedExtintorId(event.target.value); setPlacementExtra(null); }}
              >
                <option value="">Selecione extintor sem posição</option>
                {extintoresSemPosicao.map((item) => {
                  const tipoCap = formatExtintorTipoCapacidade(item);
                  return (
                    <option key={item.id} value={item.id}>
                      {item.codigo} — {formatExtintorLocalizacao(item)}{tipoCap ? ` — ${tipoCap}` : ""}
                    </option>
                  );
                })}
              </select>
            )}

            {placementExtra === "hidrante" && (
              <select
                aria-label="Selecionar hidrante sem posição"
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                value={selectedHidranteId}
                onChange={(event) => setSelectedHidranteId(event.target.value)}
              >
                <option value="">Selecione hidrante sem posição</option>
                {hidrantesSemPosicao.map((item) => (
                  <option key={item.id} value={item.id}>{item.codigo}</option>
                ))}
              </select>
            )}

          </div>
        )}

        {/* Mapa ocupa todo o espaço restante */}
        <div className="map-viewport-root relative min-h-0" style={{ flex: "1 1 0" }}>
          <div className="absolute inset-0">
            <MapErrorBoundary>{mapContent}</MapErrorBoundary>
          </div>
          {plantStatusOverlay}

          {/* Toasts flutuantes sobre o mapa — não empurram o layout */}
          {savingPosition && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1500] -translate-x-1/2 rounded-full bg-amber-600/90 px-4 py-1.5 text-xs font-semibold text-white shadow">
              Salvando…
            </div>
          )}
          {message && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1500] w-[90%] max-w-sm -translate-x-1/2 rounded-xl bg-slate-800/90 px-4 py-2 text-center text-xs text-white shadow">
              {message}
            </div>
          )}
        </div>

        {equipmentDetail &&
          isMobile &&
          !selectedMarker &&
          !selectedHidrante &&
          !infoEmergencia && (
            <MapEquipmentDetailPanel
              detail={equipmentDetail}
              layout="sheet"
              canInspect={canInspect}
              canEdit={canEdit}
              mode={mode}
              onClose={() => {
                setInfoMarker(null);
                setInfoHidrante(null);
              }}
              onOpenInspection={() => {
                if (infoMarker) {
                  const item = infoMarker;
                  setInfoMarker(null);
                  openChecklistModal(item);
                } else if (infoHidrante) {
                  const h = infoHidrante;
                  setInfoHidrante(null);
                  openHidranteChecklistModal(h);
                }
              }}
              onRemove={
                infoMarker
                  ? () => {
                      if (window.confirm(`Remover marcador de ${infoMarker.codigo} do mapa?`)) {
                        void removeMarker(infoMarker);
                      }
                    }
                  : infoHidrante
                    ? () => void removerHidranteDoMapa(infoHidrante)
                    : undefined
              }
            />
          )}

        {/* Modal de checklist — incluso no branch mobile também */}

        {infoEmergencia && !selectedMarker && !selectedHidrante && (
          <div
            className="modal-layer fixed inset-0 flex items-end bg-black/40"
            onClick={() => setInfoEmergencia(null)}
          >
            <div
              className="w-full rounded-t-2xl bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">
                    {infoEmergencia.kind === "luz_emergencia" ? "Luz de emergência" : "Placa de saída"}
                  </h3>
                  <p className="text-sm text-zinc-600">Quantidade marcada: {infoEmergencia.quantidade}</p>
                </div>
                <ModalCloseButton onClick={() => setInfoEmergencia(null)} />
              </div>
              <p
                className={`mt-1 text-xs font-semibold ${
                  marcadorEmergenciaIconColor(infoEmergencia) === "green"
                    ? "text-green-700"
                    : marcadorEmergenciaIconColor(infoEmergencia) === "red"
                      ? "text-red-700"
                      : "text-yellow-700"
                }`}
              >
                {marcadorEmergenciaIconColor(infoEmergencia) === "green"
                  ? "✓ Conforme no mês"
                  : marcadorEmergenciaIconColor(infoEmergencia) === "red"
                    ? "⚠ Não conforme no mês"
                    : "⚠ Inspeção pendente no mês"}
              </p>
              {infoEmergencia.inspecao_resultado === "nao_conforme" &&
                infoEmergencia.nao_conformidade_descricao && (
                  <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-900">
                    {infoEmergencia.nao_conformidade_descricao}
                  </p>
                )}
              {infoEmergencia.verified_at && (
                <p className="mt-0.5 text-xs text-zinc-500">
                  Último registro: {new Date(infoEmergencia.verified_at).toLocaleString("pt-BR")}
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2">
                {mode === "inspecao" && canInspect && (
                  <>
                    <button
                      type="button"
                      className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
                      disabled={savingPosition}
                      onClick={() => void salvarInspecaoEmergencia(infoEmergencia, "conforme")}
                    >
                      Conforme
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50"
                      disabled={savingPosition}
                      onClick={() => void salvarInspecaoEmergencia(infoEmergencia, "nao_conforme")}
                    >
                      Não conforme…
                    </button>
                  </>
                )}
                {canEdit && mode === "edicao" && (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600"
                    onClick={() => void removerMarcadorEmergencia(infoEmergencia)}
                  >
                    Remover do mapa
                  </button>
                )}
                <button type="button" className="py-2 text-sm text-zinc-500" onClick={() => setInfoEmergencia(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {canInspect && selectedMarker && (
          <InspecaoModalFrame onClose={() => setSelectedMarker(null)}>
            <ChecklistForm
              data={checklistForm}
              onChange={setChecklistForm}
              onSubmit={saveChecklist}
              onCancel={() => setSelectedMarker(null)}
              isSaving={savingChecklist}
              fields={activeExtintorFields}
              cabecalho={{
                codigo: selectedMarker.codigo,
                pavimento: selectedMarker.pavimento,
                local_detalhado: selectedMarker.local_detalhado,
                num_inmetro: selectedMarker.num_inmetro,
                num_cilindro: selectedMarker.num_cilindro ?? null,
                tipo: selectedMarker.tipo,
                tamanho: selectedMarker.tamanho,
                capacidade_extintora: selectedMarker.capacidade_extintora,
                manutencao_2_nivel: selectedMarker.manutencao_2_nivel,
                manutencao_3_nivel: selectedMarker.manutencao_3_nivel,
              }}
            />
          </InspecaoModalFrame>
        )}

        {canInspect && selectedHidrante && (
          <InspecaoModalFrame onClose={() => setSelectedHidrante(null)}>
            <HidranteChecklistForm
              data={hidranteChecklistForm}
              onChange={setHidranteChecklistForm}
              onSubmit={saveHidranteChecklist}
              onCancel={() => setSelectedHidrante(null)}
              isSaving={savingHidranteChecklist}
              fields={activeHidranteFields}
              hidrante={hidranteCabecalhoForm(selectedHidrante)}
            />
          </InspecaoModalFrame>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-3 overflow-hidden px-3 py-3 sm:px-4">
      <header className="professional-card flex shrink-0 flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="page-eyebrow">Planta técnica</p>
            <h1 className="mt-1 text-xl font-extrabold leading-tight text-[var(--ink)]">
              {canInspect ? "Mapa operacional" : "Mapeamento de equipamentos"}
            </h1>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Navegue por pavimento, filtre camadas e selecione um marcador para ver detalhes.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1 rounded-2xl bg-[var(--muted)] p-1">
            {canEdit && (
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-xs font-bold ${
                  mode === "edicao" ? "brand-gradient text-[var(--neon-ink)]" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setMode("edicao")}
              >
                Modo edição
              </button>
            )}
            {canInspect && canEdit && (
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-xs font-bold ${
                  mode === "inspecao" ? "brand-gradient text-[var(--neon-ink)]" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setMode("inspecao")}
              >
                Modo inspeção
              </button>
            )}
          </div>
        </div>
        <details className="rounded-xl border border-[var(--border)] bg-[#fafafa] text-[11px] leading-snug text-slate-700 sm:text-xs sm:leading-relaxed">
          <summary className="cursor-pointer list-none px-3 py-2 font-bold text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden hover:bg-slate-100">
            Como interpretar os marcadores
          </summary>
          <div className="border-t border-slate-200 px-2 py-2 sm:px-3">
            <p className="text-slate-600">
              Vale para o <span className="font-semibold text-slate-800">mês em curso</span>; ao mudar o mês, o que
              estiver pendente é atualizado.
            </p>

            <p className="mt-1.5 font-semibold text-slate-800">1) Centro do marcador</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-3.5 text-slate-600">
              <li>
                <span className="font-semibold text-yellow-700">Âmbar:</span> ainda não conferido no mês.
              </li>
              <li>
                <span className="font-semibold text-green-700">Verde:</span> conferido e sem pendências.
              </li>
              <li>
                <span className="font-semibold text-red-700">Vermelho:</span> pendente com vencimento, NC ou item em
                falta (hidrante).
              </li>
            </ul>

            <p className="mt-1.5 font-semibold text-slate-800">2) Anel ao redor</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-3.5 text-slate-600">
              <li>
                <span className="font-semibold text-green-700">Verde:</span> conferido no mês (anel de conferência).
              </li>
              <li>
                <span className="font-semibold text-red-700">Vermelho:</span> não conformidade após conferência, ou
                pendência antes da conferência.
              </li>
              <li>
                Conferido com alerta: extintor vencido → centro vermelho e anel verde; NC sem vencimento → centro
                verde e anel vermelho; hidrante com problema → centro vermelho e anel verde.
              </li>
            </ul>
          </div>
        </details>
      </header>

      {/* relative wrapper → filho absolute inset-0 garante altura concreta ao Leaflet */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 flex flex-col gap-2 overflow-hidden lg:flex-row">
        <aside className="professional-card flex shrink-0 flex-col overflow-y-auto p-4 lg:w-[310px] lg:overflow-y-auto">
          {equipmentDetail && !isMobile && (
            <div className="mb-4">
              <MapEquipmentDetailPanel
                detail={equipmentDetail}
                layout="panel"
                canInspect={canInspect}
                canEdit={canEdit}
                mode={mode}
                onClose={() => {
                  setInfoMarker(null);
                  setInfoHidrante(null);
                }}
                onOpenInspection={() => {
                  if (infoMarker) {
                    const item = infoMarker;
                    setInfoMarker(null);
                    openChecklistModal(item);
                  } else if (infoHidrante) {
                    const h = infoHidrante;
                    setInfoHidrante(null);
                    openHidranteChecklistModal(h);
                  }
                }}
                onRemove={
                  infoMarker
                    ? () => {
                        if (window.confirm(`Remover marcador de ${infoMarker.codigo} do mapa?`)) {
                          void removeMarker(infoMarker);
                        }
                      }
                    : infoHidrante
                      ? () => void removerHidranteDoMapa(infoHidrante)
                      : undefined
                }
              />
            </div>
          )}

          <p className="page-eyebrow mb-3">Filtros do mapa</p>
          <label htmlFor="pavimento" className="mb-1.5 block text-xs font-bold text-slate-700">
            Pavimento
          </label>
          <select
            id="pavimento"
            className="field-control !rounded-xl"
            value={pavimento.key}
            onChange={(event) => {
              const selected = pavimentos.find((item) => item.key === event.target.value);
              if (selected) setPavimento(selected);
            }}
          >
            {pavimentos.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          {canInspect && mode === "inspecao" && (
            <>
              <label htmlFor="busca-equipamento" className="mb-1 mt-3 block text-xs font-bold text-slate-700">
                Buscar equipamento
              </label>
              <input
                id="busca-equipamento"
                type="search"
                className="field-control !rounded-xl"
                placeholder="Código ou local"
                value={buscaEquipamento}
                onChange={(e) => setBuscaEquipamento(e.target.value)}
              />
              <button
                type="button"
                className={`mt-2 w-full rounded-xl px-3 py-2 text-xs font-bold ${
                  filtroPendentes ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setFiltroPendentes((prev) => !prev)}
              >
                {filtroPendentes ? "Mostrando pendentes" : "Filtrar pendentes"}
              </button>
            </>
          )}

          {mostrarFiltroEquipe && (
            <>
              <label htmlFor="filtro-equipe" className="mb-1 mt-3 block text-sm font-semibold text-slate-700">
                Equipe (inspeção)
              </label>
              <select
                id="filtro-equipe"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                value={filtroEquipe}
                onChange={(e) => setFiltroEquipe(e.target.value as EquipeConferenciaId | "")}
              >
                <option value="">Todas as equipes</option>
                {EQUIPES_CONFERENCIA.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="mt-3 flex flex-wrap gap-1">
            {(
              [
                ["extintor", "Extintores"],
                ["hidrante", "Hidrantes"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setShowLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={`rounded-xl px-3 py-2 text-xs font-bold ${
                  showLayers[key] ? "bg-[var(--orange)] text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
            <span>Pendentes no mês</span>
            <span className="rounded-full bg-white px-2 py-0.5 font-extrabold shadow-sm">
              {extintores.filter((item) => !conferidosNoMesIds.has(item.id)).length}
            </span>
          </div>

          {canEdit && mode === "edicao" && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-1">
                <span className="w-full text-[11px] font-bold uppercase text-slate-500">Posicionar</span>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    placementExtra === null ? "bg-[var(--orange)] text-white" : "bg-slate-100 text-slate-700"
                  }`}
                  onClick={() => {
                    setPlacementExtra(null);
                    setSelectedHidranteId("");
                  }}
                >
                  Extintor
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    placementExtra === "hidrante" ? "bg-[var(--orange)] text-white" : "bg-slate-100 text-slate-700"
                  }`}
                  onClick={() => {
                    setPlacementExtra("hidrante");
                    setSelectedExtintorId("");
                  }}
                >
                  Hidrante
                </button>
              </div>

              {placementExtra === null && (
                <>
                  <h2 className="text-sm font-semibold text-slate-800">Extintores sem posição</h2>
                  <p className="mt-1 text-xs text-slate-500">Selecione e clique no mapa.</p>
                  <div className="mt-2 max-h-[280px] space-y-2 overflow-auto">
                    {extintoresSemPosicao.map((item) => {
                      const tipoCap = formatExtintorTipoCapacidade(item);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`w-full rounded-lg border p-2 text-left text-sm ${
                            selectedExtintorId === item.id
                              ? "border-[var(--neon)] bg-[var(--neon)] text-[var(--neon-ink)]"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                          onClick={() => {
                            setPlacementExtra(null);
                            setSelectedExtintorId(item.id);
                          }}
                        >
                          <p className="font-semibold">{item.codigo}</p>
                          <p className="text-xs opacity-80">{formatExtintorLocalizacao(item)}</p>
                          {tipoCap ? <p className="mt-0.5 text-[11px] opacity-80">{tipoCap}</p> : null}
                        </button>
                      );
                    })}
                    {extintoresSemPosicao.length === 0 && (
                      <p className="text-sm text-zinc-500">
                        Nenhum extintor pendente neste setor. Cadastre em{" "}
                        <strong>Extintores e Hidrantes</strong> com o setor “{pavimento.label}”.
                      </p>
                    )}
                  </div>
                </>
              )}

              {placementExtra === "hidrante" && (
                <>
                  <h2 className="text-sm font-semibold text-slate-800">Hidrantes sem posição</h2>
                  <div className="mt-2 max-h-[280px] space-y-2 overflow-auto">
                    {hidrantesSemPosicao.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full rounded-lg border p-2 text-left text-sm ${
                          selectedHidranteId === item.id
                            ? "border-blue-700 bg-blue-700 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                        onClick={() => setSelectedHidranteId(item.id)}
                      >
                        <p className="font-semibold">{item.codigo}</p>
                      </button>
                    ))}
                    {hidrantesSemPosicao.length === 0 && (
                      <p className="text-sm text-zinc-500">Nenhum hidrante pendente neste pavimento.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500">
            {loading ? "Carregando dados..." : `${extintores.length} extintores encontrados.`}
          </div>
          {savingPosition && <p className="mt-1 text-xs text-amber-700">Salvando posição...</p>}
          {message && <p className="mt-2 rounded bg-slate-100 p-2 text-xs text-slate-700">{message}</p>}
        </aside>

        <section className="professional-card map-viewport-root relative min-h-0 flex-1 overflow-hidden">
          <div className="absolute inset-0">{mapContent}</div>
          {plantStatusOverlay}
        </section>
        </div>
      </div>

      {canInspect && selectedMarker && (
        <InspecaoModalFrame onClose={() => setSelectedMarker(null)}>
          <ChecklistForm
            data={checklistForm}
            onChange={setChecklistForm}
            onSubmit={saveChecklist}
            onCancel={() => setSelectedMarker(null)}
            isSaving={savingChecklist}
            fields={extintorChecklistFields}
            cabecalho={{
              codigo: selectedMarker.codigo,
              pavimento: selectedMarker.pavimento,
              local_detalhado: selectedMarker.local_detalhado,
              num_inmetro: selectedMarker.num_inmetro,
              num_cilindro: selectedMarker.num_cilindro ?? null,
              tipo: selectedMarker.tipo,
              tamanho: selectedMarker.tamanho,
              capacidade_extintora: selectedMarker.capacidade_extintora,
              manutencao_2_nivel: selectedMarker.manutencao_2_nivel,
              manutencao_3_nivel: selectedMarker.manutencao_3_nivel,
            }}
          />
        </InspecaoModalFrame>
      )}

      {canInspect && selectedHidrante && (
        <InspecaoModalFrame onClose={() => setSelectedHidrante(null)}>
          <HidranteChecklistForm
            data={hidranteChecklistForm}
            onChange={setHidranteChecklistForm}
            onSubmit={saveHidranteChecklist}
            onCancel={() => setSelectedHidrante(null)}
            isSaving={savingHidranteChecklist}
            fields={activeHidranteFields}
            hidrante={hidranteCabecalhoForm(selectedHidrante)}
          />
        </InspecaoModalFrame>
      )}
    </main>
  );
}
