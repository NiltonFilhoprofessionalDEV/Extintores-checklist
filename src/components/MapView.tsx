"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageOverlay,
  MapContainer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
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
  resolveFloorImageUrl,
  type BaseFloor,
} from "@/lib/auth/bases";
import { parseCalendarDateAsLocal } from "@/lib/date/date-only";
import ChecklistForm from "@/src/components/ChecklistForm";
import HidranteChecklistForm from "@/src/components/HidranteChecklistForm";
import {
  CHECKLIST_INITIAL,
  mergeObservacoesComNaoConformidades,
  checklistTemNaoConformidade,
  isDataVencida,
  type ChecklistData,
} from "@/lib/checklist/types";
import { buildObservacoesLegadoApenasNaoConformidades } from "@/lib/checklist/parse-legacy-observacoes";
import {
  HIDRANTE_CHECKLIST_INITIAL,
  mergeHidranteObservacoes,
  hidranteChecklistTemNaoConformidade,
  type HidranteChecklistData,
} from "@/lib/checklist/hidrante-types";
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

// ─── Error Boundary ───────────────────────────────────────────────────────────
class MapErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-white p-6 text-center">
          <div className="text-4xl">🗺️</div>
          <p className="text-sm font-semibold text-zinc-700">O mapa encontrou um erro.</p>
          <button
            type="button"
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white"
            onClick={() => this.setState({ hasError: false })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

type Mode = "edicao" | "inspecao";

type PavimentoOption = {
  key: string;
  label: string;
  imageBase: string;
};

type Extintor = {
  id: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  coord_x: number | null;
  coord_y: number | null;
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
};

type MarcadorEmergenciaRow = {
  id: string;
  kind: "luz_emergencia" | "placa_saida_emergencia";
  pavimento: string | null;
  coord_x: number;
  coord_y: number;
  quantidade: number;
  verified_at: string | null;
  verified_by: string | null;
  inspecao_resultado: "conforme" | "nao_conforme" | null;
  nao_conformidade_descricao: string | null;
};

type ChecklistState = ChecklistData;

/** Fallback when base floors fail to load or are empty. */
const FALLBACK_PAVIMENTOS: PavimentoOption[] = [
  { key: "terreo", label: "Térreo", imageBase: "/maps/terreo" },
  { key: "pavimento_1", label: "Pavimento 1", imageBase: "/maps/pavimento 1" },
  { key: "galeria_tecnica", label: "Galeria Técnica", imageBase: "/maps/galeria_tecniica" },
  { key: "pavimento_tecnico", label: "Pavimento Técnico", imageBase: "/maps/pavimento_tecnico" },
  { key: "subsolo", label: "Subsolo", imageBase: "/maps/subsolo" },
  { key: "teca", label: "TECA", imageBase: "/maps/teca" },
  { key: "tps_1", label: "TPS 1", imageBase: "/maps/tps_1" },
  { key: "sci", label: "SCI", imageBase: "/maps/sci" },
  { key: "other_places", label: "Guaritas/Central de resíduos", imageBase: "/maps/other_places" },
];

function mapBaseFloorToPavimento(floor: BaseFloor): PavimentoOption {
  return {
    key: floor.key,
    label: floor.label,
    imageBase: floor.image_path,
  };
}

const INITIAL_CHECKLIST: ChecklistState = CHECKLIST_INITIAL;

const preloadedImages = new Set<string>();

function parseDate(value: string | null) {
  return parseCalendarDateAsLocal(value);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isSameFloor(extintorFloor: string | null, selectedFloor: string) {
  if (!extintorFloor) return true;
  return normalizeText(extintorFloor) === normalizeText(selectedFloor);
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

const MARCADOR_RING_PAD = 4;

const markerIconCache = new Map<string, L.DivIcon>();

function getCachedDivIcon(key: string, factory: () => L.DivIcon): L.DivIcon {
  const cached = markerIconCache.get(key);
  if (cached) return cached;
  const icon = factory();
  markerIconCache.set(key, icon);
  if (markerIconCache.size > 400) {
    const first = markerIconCache.keys().next().value;
    if (first) markerIconCache.delete(first);
  }
  return icon;
}

function escapeMarkerLabel(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

function extinguisherIcon(colors: MarkerColors, codigo = "", compact = false) {
  const { bg: statusBg, ring } = colors;
  const numMatch = codigo.match(/\d+/);
  const label = numMatch ? numMatch[0].replace(/^0+/, "") || numMatch[0] : codigo;
  const safeLabel = escapeMarkerLabel(label);
  const cacheKey = `ext-${statusBg}-${ring}-${safeLabel}-${compact ? "m" : "d"}`;
  return getCachedDivIcon(cacheKey, () => {
    if (compact) {
      return L.divIcon({
        className: "map-mobile-marker-icon",
        iconSize: [38, 50],
        iconAnchor: [19, 16],
        html: `<div class="map-marker-mobile" style="--marker-bg:${statusBg};--marker-ring:${ring};">
        <div class="map-marker-mobile__ring-wrap">
          <div class="map-marker-mobile__symbol map-marker-mobile__symbol--ext">🧯</div>
        </div>
        <span class="map-marker-mobile__label">${safeLabel}</span>
      </div>`,
      });
    }

    return L.divIcon({
      className: "",
      iconSize: [38, 50],
      iconAnchor: [19, 16],
      html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="padding:${MARCADOR_RING_PAD}px;border-radius:9999px;background:${ring};box-shadow:0 2px 4px rgba(0,0,0,0.28);">
        <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${statusBg};color:#fff;font-size:14px;border:2px solid #fff;font-family:system-ui,sans-serif;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.06);">🧯</div>
      </div>
      <span style="background:rgba(0,0,0,0.65);color:#fff;font-size:9px;font-weight:700;font-family:system-ui,sans-serif;border-radius:3px;padding:1px 4px;white-space:nowrap;letter-spacing:0.02em;line-height:1.4;">${safeLabel}</span>
    </div>`,
    });
  });
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

function hydrantIcon(colors: MarkerColors, codigo: string, compact = false) {
  const { bg: statusBg, ring } = colors;
  const numMatch = codigo.match(/\d+/);
  const label = numMatch ? numMatch[0].replace(/^0+/, "") || numMatch[0] : codigo.slice(0, 6);
  const safeLabel = escapeMarkerLabel(label);
  const cacheKey = `hid-${statusBg}-${ring}-${safeLabel}-${compact ? "m" : "d"}`;
  return getCachedDivIcon(cacheKey, () => {
    if (compact) {
      return L.divIcon({
        className: "map-mobile-marker-icon",
        iconSize: [34, 44],
        iconAnchor: [17, 15],
        html: `<div class="map-marker-mobile" style="--marker-bg:${statusBg};--marker-ring:${ring};">
        <div class="map-marker-mobile__ring-wrap map-marker-mobile__ring-wrap--square">
          <div class="map-marker-mobile__symbol map-marker-mobile__symbol--hyd">H</div>
        </div>
        <span class="map-marker-mobile__label">${safeLabel}</span>
      </div>`,
      });
    }

    return L.divIcon({
      className: "",
      iconSize: [34, 44],
      iconAnchor: [17, 15],
      html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="padding:${MARCADOR_RING_PAD}px;border-radius:9px;background:${ring};box-shadow:0 2px 4px rgba(0,0,0,0.28);">
        <div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:4px;background:${statusBg};color:#fff;font-size:13px;font-weight:800;border:2px solid #fff;font-family:system-ui,sans-serif;line-height:1;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.06);">H</div>
      </div>
      <span style="background:rgba(0,0,0,0.65);color:#fff;font-size:9px;font-weight:700;font-family:system-ui,sans-serif;border-radius:2px;padding:1px 4px;white-space:nowrap;">${safeLabel}</span>
    </div>`,
    });
  });
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

function FitBounds({
  bounds,
  maxZoomExtra = 32,
  bottomOffset = 0,
  initialZoomOut = 0,
  minZoomAbsolute = -18,
  boundsPad = 0.15,
}: {
  bounds: LatLngBoundsExpression;
  /** Níveis de zoom acima do "fit" para aproximar (pinch in). */
  maxZoomExtra?: number;
  bottomOffset?: number;
  /** Níveis para recuar após o fitBounds inicial (só efeito visual inicial). */
  initialZoomOut?: number;
  /** Zoom mínimo absoluto (Leaflet); valores negativos = afastar muito o plano. */
  minZoomAbsolute?: number;
  /** Padding nas maxBounds — maior = mais pan com zoom bem afastado. */
  boundsPad?: number;
}) {
  const map = useMap();
  /**
   * Enquanto o usuário não interagir (arrastar/zoom), mantemos a planta inteira
   * encaixada na tela. Reajustamos a cada resize do container porque o layout
   * flex pode só atingir a altura final após a montagem — sem isso, o primeiro
   * fit usaria um viewport menor e o mapa abriria "com zoom".
   */
  const userInteractedRef = useRef(false);
  /** True durante fitBounds/setZoom programáticos para ignorar seus eventos de zoom. */
  const programmaticRef = useRef(false);

  useEffect(() => {
    userInteractedRef.current = false;
    const leafletBounds = L.latLngBounds(bounds as LatLngBoundsLiteral);

    const tryFullFit = (): boolean => {
      map.invalidateSize({ animate: false });
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return false;

      programmaticRef.current = true;
      map.setMaxBounds(leafletBounds.pad(boundsPad));
      map.fitBounds(leafletBounds, {
        paddingTopLeft: [20, 20],
        paddingBottomRight: [20, 20 + bottomOffset],
        animate: false,
      });

      const fittedZoom = map.getZoom();

      const targetZoom = fittedZoom - initialZoomOut;
      map.setMinZoom(minZoomAbsolute);
      map.setMaxZoom(fittedZoom + maxZoomExtra);

      if (initialZoomOut > 0) {
        const z = Math.max(minZoomAbsolute, targetZoom);
        map.setZoom(z, { animate: false });
      }
      programmaticRef.current = false;
      return true;
    };

    const onUserInteract = () => {
      if (programmaticRef.current) return;
      userInteractedRef.current = true;
    };

    const onContainerResize = () => {
      map.invalidateSize({ animate: false });
      // Após o usuário dar zoom/pan, não forçamos mais o fit — respeitamos a
      // navegação dele; apenas o invalidateSize acima evita tiles cinzas.
      if (!userInteractedRef.current) tryFullFit();
    };

    // Gestos do usuário (roda do mouse, pinch, arrastar) travam o auto-fit.
    map.on("dragstart", onUserInteract);
    map.on("zoomstart", onUserInteract);

    const container = map.getContainer();
    const ro = new ResizeObserver(onContainerResize);
    ro.observe(container);

    tryFullFit();
    const id = globalThis.setTimeout(() => {
      if (!userInteractedRef.current) tryFullFit();
    }, 300);

    return () => {
      ro.disconnect();
      globalThis.clearTimeout(id);
      map.off("dragstart", onUserInteract);
      map.off("zoomstart", onUserInteract);
    };
  }, [bounds, map, maxZoomExtra, bottomOffset, initialZoomOut, minZoomAbsolute, boundsPad]);
  return null;
}

function MapClickHandler({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
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
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
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
  const [mapImageSize] = useState({ width: FULL_IMAGE_WIDTH, height: FULL_IMAGE_HEIGHT });
  const [loading, setLoading] = useState(true);
  const [savingPosition, setSavingPosition] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedMarker, setSelectedMarker] = useState<Extintor | null>(null);
  const [checklistForm, setChecklistForm] = useState<ChecklistState>(INITIAL_CHECKLIST);
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

  const mapImagePath = useMemo(() => {
    // Sempre usa a versão full-res para exibição — os bounds são baseados nas
    // dimensões originais (14042×9934) e a versão mobile causaria borrado no zoom.
    return resolveFloorImageUrl(pavimento.imageBase, supportsWebp);
  }, [pavimento.imageBase, supportsWebp]);

  const orderedMapImagePaths = useMemo(() => {
    return pavimentos.map((item) => ({
      key: item.key,
      primaryPath: resolveFloorImageUrl(item.imageBase, supportsWebp),
      fallbackPath: resolveFloorImageUrl(item.imageBase, false),
    }));
  }, [pavimentos, supportsWebp]);

  const loadExtintores = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("extintores")
      .select(
        "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,pavimento",
      )
      .order("codigo", { ascending: true });
    if (activeBaseId) query = query.eq("base_id", activeBaseId);

    const { data, error } = await query;

    if (error) {
      setMessage(`Erro ao carregar extintores: ${error.message}`);
      setLoading(false);
      return;
    }

    setExtintores((data ?? []) as Extintor[]);
    setLoading(false);
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

  const loadHidrantesEMarcadores = useCallback(async () => {
    let hidrantesQuery = supabase
      .from("hidrantes")
      .select(
        "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos,coord_x,coord_y",
      );
    if (activeBaseId) hidrantesQuery = hidrantesQuery.eq("base_id", activeBaseId);

    const [h, marcadoresRows] = await Promise.all([
      hidrantesQuery,
      fetchMarcadoresEmergenciaForMap(supabase, activeBaseId),
    ]);
    if (!h.error) setHidrantes((h.data ?? []) as HidranteRow[]);
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
        if (floors.length === 0) {
          setPavimentos(FALLBACK_PAVIMENTOS);
          setPavimento((prev) =>
            FALLBACK_PAVIMENTOS.find((item) => item.key === prev.key) ?? FALLBACK_PAVIMENTOS[0],
          );
          return;
        }
        const mapped = floors.map(mapBaseFloorToPavimento);
        setPavimentos(mapped);
        setPavimento((prev) => mapped.find((item) => item.key === prev.key) ?? mapped[0]);
      } catch {
        if (cancelled) return;
        setPavimentos(FALLBACK_PAVIMENTOS);
        setPavimento((prev) =>
          FALLBACK_PAVIMENTOS.find((item) => item.key === prev.key) ?? FALLBACK_PAVIMENTOS[0],
        );
      }
    };

    void loadFloors();
    return () => {
      cancelled = true;
    };
  }, [activeBaseId]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadExtintores();
    void loadHidrantesEMarcadores();
    const mesAposSessao = async () => {
      await getCurrentSession();
      await loadConferenciasDoMes();
      await loadConferenciasHidrantesDoMes();
    };
    void mesAposSessao();
  }, [loadConferenciasDoMes, loadConferenciasHidrantesDoMes, loadExtintores, loadHidrantesEMarcadores]);

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
          setMode(inspectAllowed ? "inspecao" : "edicao");
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
    // Em dispositivos móveis evitamos preloading agressivo para reduzir consumo de memória
    // e evitar fechamento da aba/navegador ao abrir o mapa.
    if (isMobile) return;

    const currentIndex = orderedMapImagePaths.findIndex((item) => item.key === pavimento.key);
    if (currentIndex === -1) return;

    const preloadQueue = orderedMapImagePaths
      .filter((item) => item.key !== pavimento.key)
      .map((_, index) => orderedMapImagePaths[(currentIndex + index + 1) % orderedMapImagePaths.length]);

    const preloadOne = (path: string, fallbackPath?: string) => {
      if (preloadedImages.has(path)) return;
      const image = new Image();
      image.src = path;
      image.onload = () => preloadedImages.add(path);
      image.onerror = () => {
        if (!fallbackPath || preloadedImages.has(fallbackPath)) return;
        const fallbackImage = new Image();
        fallbackImage.src = fallbackPath;
        fallbackImage.onload = () => preloadedImages.add(fallbackPath);
      };
    };

    const preloadAll = () => {
      preloadQueue.forEach((item) => preloadOne(item.primaryPath, item.fallbackPath));
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleWindow = window as Window &
        typeof globalThis & {
          requestIdleCallback: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
          cancelIdleCallback: (id: number) => void;
        };
      const idleId = idleWindow.requestIdleCallback(() => preloadAll(), { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(preloadAll, 300);
    return () => globalThis.clearTimeout(timeoutId);
  }, [isMobile, orderedMapImagePaths, pavimento.key]);

  const extintoresSemPosicao = useMemo(() => {
    const list = extintores.filter(
      (item) =>
        item.coord_x == null && item.coord_y == null && isSameFloor(item.pavimento, pavimento.label),
    );
    return [...list].sort(compareExtintorCodigoAsc);
  }, [extintores, pavimento.label]);

  const markersDoPavimento = useMemo(() => {
    const list = extintores.filter(
      (item) =>
        item.coord_x != null &&
        item.coord_y != null &&
        isSameFloor(item.pavimento, pavimento.label),
    );
    const sorted = [...list].sort(compareExtintorCodigoAsc);
    return filtrarPorEquipe(sorted, filtroEquipe, "extintor");
  }, [extintores, pavimento.label, filtroEquipe]);

  const hidrantesSemPosicao = useMemo(
    () =>
      hidrantes.filter(
        (item) =>
          item.coord_x == null &&
          item.coord_y == null &&
          isSameFloor(item.pavimento, pavimento.label),
      ),
    [hidrantes, pavimento.label],
  );

  const hidrantesDoPavimento = useMemo(() => {
    const list = hidrantes.filter(
      (item) =>
        item.coord_x != null &&
        item.coord_y != null &&
        isSameFloor(item.pavimento, pavimento.label),
    );
    return filtrarPorEquipe(list, filtroEquipe, "hidrante");
  }, [hidrantes, pavimento.label, filtroEquipe]);

  const mostrarFiltroEquipe =
    mode === "inspecao" && canInspect && baseHasEquipesConferencia(activeBase);

  useEffect(() => {
    if (!baseHasEquipesConferencia(activeBase)) {
      setFiltroEquipe("");
    }
  }, [activeBase]);

  const marcadoresDoPavimento = useMemo(
    () => marcadoresEmergencia.filter((m) => isSameFloor(m.pavimento, pavimento.label)),
    [marcadoresEmergencia, pavimento.label],
  );

  const mapClickPlacementEnabled =
    canEdit &&
    mode === "edicao" &&
    ((placementExtra == null && Boolean(selectedExtintorId)) ||
      (placementExtra === "hidrante" && Boolean(selectedHidranteId)) ||
      placementExtra === "luz_emergencia" ||
      placementExtra === "placa_saida_emergencia");

  function extintorMarkerStyle(item: Extintor): MarkerColors {
    const ult = ultimoChecklistExtintorMes.get(item.id);
    return extintorMarkerColors(item, conferidosNoMesIds.has(item.id), ult);
  }

  function hidranteMarkerStyle(h: HidranteRow): MarkerColors {
    const ult = ultimoChecklistHidranteMes.get(h.id);
    return hidranteMarkerColors(h, conferidosHidranteMesIds.has(h.id), ult as Record<string, string | null> | undefined);
  }

  /** Legado para painéis que usam uma cor única no indicador. */
  function extintorIconColor(item: Extintor): "green" | "red" | "amber" {
    const { bg } = extintorMarkerStyle(item);
    if (bg === "#16a34a") return "green";
    if (bg === "#dc2626") return "red";
    return "amber";
  }

  function hidranteIconColor(h: HidranteRow): "green" | "red" | "amber" {
    const { bg } = hidranteMarkerStyle(h);
    if (bg === "#16a34a") return "green";
    if (bg === "#dc2626") return "red";
    return "amber";
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

    if (placementExtra === "luz_emergencia" || placementExtra === "placa_saida_emergencia") {
      const raw = typeof window !== "undefined" ? window.prompt("Quantidade (1–999)", "1") : "1";
      const parsed = Number.parseInt(String(raw ?? "1"), 10);
      const qty = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 999) : 1;

      setSavingPosition(true);
      setMessage("");
      const { error } = await supabase.from("marcadores_emergencia").insert({
        kind: placementExtra,
        pavimento: pavimento.label,
        coord_x: lng,
        coord_y: lat,
        quantidade: qty,
        ...(activeBaseId ? { base_id: activeBaseId } : {}),
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
      const { error } = await supabase
        .from("hidrantes")
        .update({ coord_x: lng, coord_y: lat, pavimento: pavimento.label })
        .eq("id", selectedHidranteId);
      if (error) {
        setMessage(`Erro ao salvar hidrante: ${error.message}`);
      } else {
        setSelectedHidranteId("");
        setMessage("Posição do hidrante salva.");
        await loadHidrantesEMarcadores();
      }
      setSavingPosition(false);
      return;
    }

    if (!selectedExtintorId) return;

    setSavingPosition(true);
    setMessage("");

    const { error } = await supabase
      .from("extintores")
      .update({ coord_x: lng, coord_y: lat, pavimento: pavimento.label })
      .eq("id", selectedExtintorId);

    if (error) {
      setMessage(`Erro ao salvar posição: ${error.message}`);
      setSavingPosition(false);
      return;
    }

    setSelectedExtintorId("");
    setMessage("Posição salva com sucesso.");
    await loadExtintores();
    setSavingPosition(false);
  }

  function openChecklistModal(extintor: Extintor) {
    setSelectedMarker(extintor);
    setChecklistForm({ ...INITIAL_CHECKLIST, conferente: conferenteNome, detalhesNaoConformidade: {} });
  }

  function openHidranteChecklistModal(h: HidranteRow) {
    setSelectedHidrante(h);
    setHidranteChecklistForm({ ...HIDRANTE_CHECKLIST_INITIAL, conferente: conferenteNome, detalhesNaoConformidade: {} });
  }

  async function removeMarker(extintor: Extintor) {
    setInfoMarker(null);
    setSavingPosition(true);
    setMessage("");

    const { error } = await supabase
      .from("extintores")
      .update({ coord_x: null, coord_y: null, pavimento: null })
      .eq("id", extintor.id);

    if (error) {
      setMessage(`Erro ao remover posição: ${error.message}`);
      setSavingPosition(false);
      return;
    }

    setMessage(`Marcador de ${extintor.codigo} removido.`);
    await loadExtintores();
    setSavingPosition(false);
  }

  async function saveChecklist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMarker) return;

    setSavingChecklist(true);
    setMessage("");

    const session = await getCurrentSession();
    const profile = session
      ? await getProfileBySession(session).catch(() => actorProfile)
      : actorProfile;
    const conferente =
      resolveConferenteNome(session, profile ?? actorProfile, checklistForm.conferente) ||
      conferenteNome.trim();
    if (!conferente) {
      setMessage("Informe o nome do conferente.");
      setSavingChecklist(false);
      return;
    }

    const observacoesFinal = mergeObservacoesComNaoConformidades(checklistForm);

    const payloadNovo = {
      extintor_id: selectedMarker.id,
      data_conferencia: new Date().toISOString(),
      conferente,
      status_lacre: checklistForm.alca_gatilho_status === "conforme",
      status_manometro: checklistForm.medidor_pressao_status === "conforme",
      local_correto: checklistForm.local_correto,
      dados_corretos: checklistForm.dados_corretos,
      sinalizacao_correta: checklistForm.sinalizacao_correta,
      mangueira_status: checklistForm.mangueira_status,
      bico_difusor_status: checklistForm.bico_difusor_status,
      alca_gatilho_status: checklistForm.alca_gatilho_status,
      medidor_pressao_status: checklistForm.medidor_pressao_status,
      cilindro_status: checklistForm.cilindro_status,
      observacoes: observacoesFinal || null,
      ...(activeBaseId ? { base_id: activeBaseId } : {}),
    };

    const { error } = await supabase
      .from("checklists")
      .insert(payloadNovo as unknown as Record<string, unknown>);

    let finalError = error;

    if (error?.message?.includes("schema cache") || error?.message?.includes("column")) {
      const observacoesLegado = buildObservacoesLegadoApenasNaoConformidades(
        observacoesFinal,
        checklistForm,
      );

      const payloadLegado = {
        extintor_id: selectedMarker.id,
        data_conferencia: new Date().toISOString(),
        conferente,
        status_lacre: checklistForm.alca_gatilho_status === "conforme",
        status_manometro: checklistForm.medidor_pressao_status === "conforme",
        observacoes: observacoesLegado || null,
        ...(activeBaseId ? { base_id: activeBaseId } : {}),
      } as unknown as Record<string, unknown>;

      const retry = await supabase.from("checklists").insert(payloadLegado);
      finalError = retry.error;
    }

    if (finalError) {
      setMessage(`Erro ao salvar checklist: ${finalError.message}`);
      setSavingChecklist(false);
      return;
    }

    const ts = String(payloadNovo.data_conferencia);
    const checklistRowMes: ChecklistExtintorMesRow = {
      extintor_id: selectedMarker.id,
      data_conferencia: ts,
      local_correto: checklistForm.local_correto,
      dados_corretos: checklistForm.dados_corretos,
      sinalizacao_correta: checklistForm.sinalizacao_correta,
      mangueira_status: checklistForm.mangueira_status,
      bico_difusor_status: checklistForm.bico_difusor_status,
      alca_gatilho_status: checklistForm.alca_gatilho_status,
      medidor_pressao_status: checklistForm.medidor_pressao_status,
      cilindro_status: checklistForm.cilindro_status,
    };
    setUltimoChecklistExtintorMes((prev) => {
      const next = new Map(prev);
      const existing = next.get(selectedMarker.id);
      if (existing && new Date(existing.data_conferencia).getTime() > new Date(checklistRowMes.data_conferencia).getTime()) {
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
    setSavingChecklist(false);
  }

  async function saveHidranteChecklist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedHidrante) return;

    setSavingHidranteChecklist(true);
    setMessage("");

    const session = await getCurrentSession();
    const profile = session
      ? await getProfileBySession(session).catch(() => actorProfile)
      : actorProfile;
    const conferente =
      resolveConferenteNome(session, profile ?? actorProfile, hidranteChecklistForm.conferente) ||
      conferenteNome.trim();
    if (!conferente) {
      setMessage("Informe o nome do conferente.");
      setSavingHidranteChecklist(false);
      return;
    }

    const observacoesFinal = mergeHidranteObservacoes(hidranteChecklistForm);

    const payload = {
      hidrante_id: selectedHidrante.id,
      data_conferencia: new Date().toISOString(),
      conferente,
      acesso_desobstruido: hidranteChecklistForm.acesso_desobstruido,
      identificacao_sinalizacao: hidranteChecklistForm.identificacao_sinalizacao,
      mangueira_esguicho: hidranteChecklistForm.mangueira_esguicho,
      valvulas_registros: hidranteChecklistForm.valvulas_registros,
      pressao_abastecimento: hidranteChecklistForm.pressao_abastecimento,
      gabinete_caixa: hidranteChecklistForm.gabinete_caixa,
      hidrante_integridade: hidranteChecklistForm.hidrante_integridade,
      documentacao_acesso: hidranteChecklistForm.documentacao_acesso,
      observacoes: observacoesFinal || null,
      ...(activeBaseId ? { base_id: activeBaseId } : {}),
    };

    const { error } = await supabase.from("checklists_hidrantes").insert(payload as Record<string, unknown>);

    if (error) {
      setMessage(`Erro ao salvar inspeção do hidrante: ${error.message}`);
      setSavingHidranteChecklist(false);
      return;
    }

    const tsH = String(payload.data_conferencia);
    const hidRowMes: ChecklistHidranteMesRow = {
      hidrante_id: selectedHidrante.id,
      data_conferencia: tsH,
      acesso_desobstruido: hidranteChecklistForm.acesso_desobstruido,
      identificacao_sinalizacao: hidranteChecklistForm.identificacao_sinalizacao,
      mangueira_esguicho: hidranteChecklistForm.mangueira_esguicho,
      valvulas_registros: hidranteChecklistForm.valvulas_registros,
      pressao_abastecimento: hidranteChecklistForm.pressao_abastecimento,
      gabinete_caixa: hidranteChecklistForm.gabinete_caixa,
      hidrante_integridade: hidranteChecklistForm.hidrante_integridade,
      documentacao_acesso: hidranteChecklistForm.documentacao_acesso,
    };
    setUltimoChecklistHidranteMes((prev) => {
      const next = new Map(prev);
      const existing = next.get(selectedHidrante.id);
      if (existing && new Date(existing.data_conferencia).getTime() > new Date(hidRowMes.data_conferencia).getTime()) {
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
    setHidranteChecklistForm({ ...HIDRANTE_CHECKLIST_INITIAL, conferente: conferenteNome, detalhesNaoConformidade: {} });
    setMessage("Inspeção do hidrante salva com sucesso.");
    await loadConferenciasHidrantesDoMes();
    setSavingHidranteChecklist(false);
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
    const { error } = await supabase
      .from("hidrantes")
      .update({ coord_x: null, coord_y: null, pavimento: null })
      .eq("id", h.id);
    if (error) setMessage(error.message);
    else {
      await loadHidrantesEMarcadores();
      setMessage(`Marcador de ${h.codigo} removido.`);
    }
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

  const leafletRotateOpts = isMobile
    ? { rotate: true, touchRotate: true, bearing: 0, rotateControl: false, touchRotateThreshold: 12 }
    : { rotate: false, rotateControl: false };

  const mapContent = (
    <MapContainer
      key={pavimento.key}
      crs={L.CRS.Simple}
      preferCanvas
      zoomSnap={0.25}
      zoomDelta={0.5}
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
      inertia={isMobile}
      wheelDebounceTime={isMobile ? 80 : 40}
      zoomAnimationThreshold={4}
      maxBoundsViscosity={1}
      attributionControl={false}
      style={{ height: "100%", width: "100%" }}
      {...(leafletRotateOpts as Record<string, unknown>)}
    >
      <FitBounds
        bounds={mapBounds}
        maxZoomExtra={isMobile ? 36 : 32}
        bottomOffset={0}
        initialZoomOut={0}
        minZoomAbsolute={isMobile ? -22 : -16}
        boundsPad={isMobile ? 2.8 : 0.15}
      />
      <ImageOverlay url={mapImagePath} bounds={mapBounds} className="map-plant-overlay" />
      <MapClickHandler enabled={mapClickPlacementEnabled} onClick={handleMapClick} />

      {showLayers.extintor &&
        markersDoPavimento.map((item) => (
          <Marker
            key={item.id}
            position={[item.coord_y as number, item.coord_x as number]}
            icon={extinguisherIcon(extintorMarkerStyle(item), item.codigo, isMobile)}
            eventHandlers={{
              click: () => {
                if (mode === "inspecao" && canInspect) openChecklistModal(item);
              },
              contextmenu: () => {
                if (isMobile) setInfoMarker(item);
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
                      style={{ background: "#E02020" }}
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
        ))}

      {showLayers.hidrante &&
        hidrantesDoPavimento.map((h) => (
          <Marker
            key={h.id}
            position={[h.coord_y as number, h.coord_x as number]}
            icon={hydrantIcon(hidranteMarkerStyle(h), h.codigo, isMobile)}
            eventHandlers={{
              click: () => {
                if (mode === "inspecao" && canInspect) openHidranteChecklistModal(h);
              },
              contextmenu: () => {
                if (isMobile) setInfoHidrante(h);
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
        ))}

    </MapContainer>
  );

  if (isMobile) {
    return (
      <main className="flex min-h-0 flex-1 w-full flex-col bg-[#f6f7fb]">
        {/* ── Barra única: pavimento + modo + camadas ── */}
        <div className="shrink-0 border-b border-slate-200 bg-white">
          {/* Linha 1: pavimento + botões de modo */}
          <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-1">
            <select
              aria-label="Selecionar pavimento"
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700"
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
                className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  mode === "edicao" ? "brand-gradient text-white" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setMode("edicao")}
              >
                Edição
              </button>
            )}
            {canInspect && (
              <button
                type="button"
                className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  mode === "inspecao" ? "brand-gradient text-white" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setMode("inspecao")}
              >
                Inspeção
              </button>
            )}
          </div>

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
                  showLayers[key] ? "brand-gradient text-white" : "bg-slate-100 text-slate-600"
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
        <div className="relative min-h-0" style={{ flex: "1 1 0" }}>
          <div className="absolute inset-0">
            <MapErrorBoundary>{mapContent}</MapErrorBoundary>
          </div>

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

        {/* Bottom sheet de informação — aparece ao segurar o dedo (long press) no marcador */}
        {infoMarker && !selectedMarker && !selectedHidrante && !infoEmergencia && !infoHidrante && (
          <div
            className="fixed inset-0 z-[999] flex items-end"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setInfoMarker(null)}
          >
            <div
              className="w-full rounded-t-2xl bg-white shadow-2xl"
              style={{ maxHeight: "60dvh", overflowY: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Alça visual */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-zinc-300" />
              </div>

              {/* Cabeçalho */}
              <div className="flex items-start justify-between px-5 pt-2 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        background:
                          extintorIconColor(infoMarker) === "red"
                            ? "#dc2626"
                            : extintorIconColor(infoMarker) === "green"
                              ? "#16a34a"
                              : "#d97706",
                      }}
                    />
                    <h3 className="text-lg font-bold text-zinc-900">{infoMarker.codigo}</h3>
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-500">{formatExtintorLocalizacao(infoMarker)}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400"
                  onClick={() => setInfoMarker(null)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status */}
              <div className="mx-5 mb-4 flex flex-col gap-2 rounded-xl bg-zinc-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Conferência</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      (() => {
                        const u = ultimoChecklistExtintorMes.get(infoMarker.id);
                        if (u && checklistTemNaoConformidade(u)) return "bg-red-100 text-red-800";
                        return conferidosNoMesIds.has(infoMarker.id)
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-800";
                      })()
                    }`}
                  >
                    {(() => {
                      const u = ultimoChecklistExtintorMes.get(infoMarker.id);
                      if (u && checklistTemNaoConformidade(u)) return "⚠ Não conformidade";
                      return conferidosNoMesIds.has(infoMarker.id) ? "✓ Conferido no mês" : "⚠ Não conferido";
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Tipo / Tamanho</span>
                  <span className="text-xs font-medium text-zinc-700">
                    {[infoMarker.tipo, infoMarker.tamanho].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Manutenção</span>
                  <span
                    className={`text-xs font-semibold ${
                      getMaintenanceStatus(infoMarker) === "Vencido"
                        ? "text-red-600"
                        : getMaintenanceStatus(infoMarker) === "Próximo de vencer (30 dias)"
                          ? "text-amber-600"
                          : "text-green-600"
                    }`}
                  >
                    {getMaintenanceStatus(infoMarker)}
                  </span>
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-2 px-5 pb-6">
                {mode === "inspecao" && canInspect && (
                  <button
                    type="button"
                    className="w-full rounded-xl py-3 text-sm font-bold text-white"
                    style={{ background: "linear-gradient(90deg,#E02020,#B51313)" }}
                    onClick={() => {
                      setInfoMarker(null);
                      openChecklistModal(infoMarker);
                    }}
                  >
                    🧯 Realizar Conferência
                  </button>
                )}

                {canEdit && mode === "edicao" && (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600"
                    onClick={() => {
                      if (window.confirm(`Remover marcador de ${infoMarker.codigo} do mapa?`)) {
                        void removeMarker(infoMarker);
                      }
                    }}
                  >
                    🗑 Remover do Mapa
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de checklist — incluso no branch mobile também */}
        {infoHidrante && !selectedHidrante && (
          <div
            className="fixed inset-0 z-[999] flex items-end bg-black/40"
            onClick={() => setInfoHidrante(null)}
          >
            <div
              className="w-full rounded-t-2xl bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300" />
              <h3 className="text-lg font-bold text-zinc-900">{infoHidrante.codigo}</h3>
              <p className="text-sm text-zinc-500">Hidrante</p>
              <div className="mt-4 flex flex-col gap-2">
                {mode === "inspecao" && canInspect && (
                  <button
                    type="button"
                    className="w-full rounded-xl bg-blue-700 py-3 text-sm font-bold text-white"
                    onClick={() => {
                      setInfoHidrante(null);
                      openHidranteChecklistModal(infoHidrante);
                    }}
                  >
                    Inspecionar hidrante
                  </button>
                )}
                {canEdit && mode === "edicao" && (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600"
                    onClick={() => void removerHidranteDoMapa(infoHidrante)}
                  >
                    Remover do mapa
                  </button>
                )}
                <button type="button" className="py-2 text-sm text-zinc-500" onClick={() => setInfoHidrante(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {infoEmergencia && !selectedMarker && !selectedHidrante && (
          <div
            className="fixed inset-0 z-[999] flex items-end bg-black/40"
            onClick={() => setInfoEmergencia(null)}
          >
            <div
              className="w-full rounded-t-2xl bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300" />
              <h3 className="text-lg font-bold text-zinc-900">
                {infoEmergencia.kind === "luz_emergencia" ? "Luz de emergência" : "Placa de saída"}
              </h3>
              <p className="text-sm text-zinc-600">Quantidade marcada: {infoEmergencia.quantidade}</p>
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
              cabecalho={{
                codigo: selectedMarker.codigo,
                pavimento: selectedMarker.pavimento,
                local_detalhado: selectedMarker.local_detalhado,
                num_inmetro: selectedMarker.num_inmetro,
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
              hidrante={hidranteCabecalhoForm(selectedHidrante)}
            />
          </InspecaoModalFrame>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col gap-2 overflow-hidden px-2 py-2 sm:px-3">
      <header className="surface-card flex shrink-0 flex-col gap-2 p-2 sm:p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-base font-bold leading-tight text-slate-900 sm:text-lg">
            {canInspect ? "Mapeamento e inspeção de extintores" : "Mapeamento de extintores e hidrantes"}
          </h1>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {canEdit && (
              <button
                type="button"
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                  mode === "edicao" ? "brand-gradient text-white" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setMode("edicao")}
              >
                Modo edição
              </button>
            )}
            {canInspect && (
              <button
                type="button"
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                  mode === "inspecao" ? "brand-gradient text-white" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setMode("inspecao")}
              >
                Modo inspeção
              </button>
            )}
          </div>
        </div>
        <details className="rounded-md border border-slate-200 bg-slate-50 text-[11px] leading-snug text-slate-700 sm:text-xs sm:leading-relaxed">
          <summary className="cursor-pointer list-none px-2 py-1.5 font-semibold text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden hover:bg-slate-100">
            Legenda dos marcadores (mês atual) — clique para expandir
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
        <aside className="surface-card flex shrink-0 flex-col overflow-y-auto p-2.5 sm:p-3 lg:w-[290px] lg:overflow-y-auto">
          <label htmlFor="pavimento" className="mb-1 block text-sm font-semibold text-slate-700">
            Pavimento
          </label>
          <select
            id="pavimento"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
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
                className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                  showLayers[key] ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-900">
            Extintores pendentes no mês:{" "}
            <span className="font-bold">{extintores.filter((item) => !conferidosNoMesIds.has(item.id)).length}</span>
          </div>

          {canEdit && mode === "edicao" && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-1">
                <span className="w-full text-[11px] font-bold uppercase text-slate-500">Posicionar</span>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    placementExtra === null ? "bg-[#b42318] text-white" : "bg-slate-100 text-slate-700"
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
                    placementExtra === "hidrante" ? "bg-[#b42318] text-white" : "bg-slate-100 text-slate-700"
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
                              ? "border-[#b42318] bg-[#b42318] text-white"
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
                      <p className="text-sm text-zinc-500">Nenhum extintor pendente neste pavimento.</p>
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

        <section className="surface-card relative min-h-0 flex-1 overflow-hidden">
          <div className="absolute inset-0">{mapContent}</div>
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
            cabecalho={{
              codigo: selectedMarker.codigo,
              pavimento: selectedMarker.pavimento,
              local_detalhado: selectedMarker.local_detalhado,
              num_inmetro: selectedMarker.num_inmetro,
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
            hidrante={hidranteCabecalhoForm(selectedHidrante)}
          />
        </InspecaoModalFrame>
      )}
    </main>
  );
}
