"use client";

import { Component, useCallback, useEffect, useMemo, useState } from "react";
import {
  ImageOverlay,
  MapContainer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { type LatLngBoundsExpression, type LatLngBoundsLiteral } from "leaflet";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";
import ChecklistForm from "@/src/components/ChecklistForm";
import { CHECKLIST_INITIAL, type ChecklistData } from "@/lib/checklist/types";

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

type ChecklistForm = ChecklistData;

const PAVIMENTOS: PavimentoOption[] = [
  { key: "terreo", label: "Térreo", imageBase: "/maps/terreo" },
  { key: "pavimento_1", label: "Pavimento 1", imageBase: "/maps/pavimento 1" },
  { key: "galeria_tecnica", label: "Galeria Técnica", imageBase: "/maps/galeria_tecniica" },
  { key: "pavimento_tecnico", label: "Pavimento Técnico", imageBase: "/maps/pavimento_tecnico" },
  { key: "subsolo", label: "Subsolo", imageBase: "/maps/subsolo" },
];

const INITIAL_CHECKLIST: ChecklistForm = CHECKLIST_INITIAL;

const preloadedImages = new Set<string>();

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
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

function isMaintenanceAtRisk(extintor: Extintor) {
  const today = new Date();
  const inThirtyDays = new Date();
  inThirtyDays.setDate(today.getDate() + 30);

  const m2 = parseDate(extintor.manutencao_2_nivel);
  const m3 = parseDate(extintor.manutencao_3_nivel);

  const dates = [m2, m3].filter(Boolean) as Date[];
  if (dates.length === 0) return true;

  return dates.some((date) => date <= inThirtyDays);
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

function extinguisherIcon(color: "green" | "red" | "amber", codigo = "") {
  const background =
    color === "green" ? "#16a34a" : color === "red" ? "#dc2626" : "#d97706";
  // Label mostra apenas o número extraído do código (ex: "EXT-042" → "42", "E042" → "42")
  const numMatch = codigo.match(/\d+/);
  const label = numMatch ? numMatch[0].replace(/^0+/, "") || numMatch[0] : codigo;
  return L.divIcon({
    className: "",
    iconSize: [30, 44],
    iconAnchor: [15, 13],
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${background};color:#fff;font-size:14px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.25);">🧯</div>
      <span style="background:rgba(0,0,0,0.65);color:#fff;font-size:9px;font-weight:700;font-family:system-ui,sans-serif;border-radius:3px;padding:1px 4px;white-space:nowrap;letter-spacing:0.02em;line-height:1.4;">${label}</span>
    </div>`,
  });
}

function FitBounds({
  bounds,
  maxZoomExtra = 4,
  bottomOffset = 0,
}: {
  bounds: LatLngBoundsExpression;
  maxZoomExtra?: number;
  bottomOffset?: number;
}) {
  const map = useMap();
  useEffect(() => {
    const leafletBounds = L.latLngBounds(bounds as LatLngBoundsLiteral);

    const applyFit = () => {
      map.invalidateSize({ animate: false });
      // Aguarda o container ter dimensões reais antes de calcular
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;

      map.setMaxBounds(leafletBounds.pad(0.1));
      map.fitBounds(leafletBounds, {
        paddingTopLeft: [20, 20],
        paddingBottomRight: [20, 20 + bottomOffset],
        animate: false,
      });

      const fittedZoom = map.getZoom();
      // Permite zoom-out para ver a planta inteira + zoom-in para detalhes
      map.setMinZoom(fittedZoom - 2);
      map.setMaxZoom(fittedZoom + maxZoomExtra);
    };

    // ResizeObserver: re-fit sempre que o container muda de tamanho (CSS, rotação, etc.)
    const container = map.getContainer();
    const ro = new ResizeObserver(applyFit);
    ro.observe(container);

    // Passagem imediata + fallback com delay para garantir execução
    applyFit();
    const id = globalThis.setTimeout(applyFit, 300);

    return () => {
      ro.disconnect();
      globalThis.clearTimeout(id);
    };
  }, [bounds, map, maxZoomExtra, bottomOffset]);
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

export default function MapView() {
  const [mode, setMode] = useState<Mode>("edicao");
  const [pavimento, setPavimento] = useState<PavimentoOption>(PAVIMENTOS[0]);
  const [extintores, setExtintores] = useState<Extintor[]>([]);
  const [selectedExtintorId, setSelectedExtintorId] = useState<string>("");
  const [mapImageSize] = useState({ width: FULL_IMAGE_WIDTH, height: FULL_IMAGE_HEIGHT });
  const [loading, setLoading] = useState(true);
  const [savingPosition, setSavingPosition] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedMarker, setSelectedMarker] = useState<Extintor | null>(null);
  const [checklistForm, setChecklistForm] = useState<ChecklistForm>(INITIAL_CHECKLIST);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1024px)").matches : false,
  );
  const [canEdit, setCanEdit] = useState(false);
  const [conferidosNoMesIds, setConferidosNoMesIds] = useState<Set<string>>(new Set());
  const [supportsWebp] = useState(() => {
    if (typeof window === "undefined") return true;
    const canvas = document.createElement("canvas");
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  });
  const [conferenteNome, setConferenteNome] = useState("");
  // Painel de informação (long press no mobile)
  const [infoMarker, setInfoMarker] = useState<Extintor | null>(null);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const currentMonthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);

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
    return `${pavimento.imageBase}${supportsWebp ? ".webp" : ".jpg"}`;
  }, [pavimento.imageBase, supportsWebp]);

  const orderedMapImagePaths = useMemo(() => {
    return PAVIMENTOS.map((item) => ({
      key: item.key,
      primaryPath: `${item.imageBase}${supportsWebp ? ".webp" : ".jpg"}`,
      fallbackPath: `${item.imageBase}.jpg`,
    }));
  }, [supportsWebp]);

  const loadExtintores = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("extintores")
      .select(
        "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,pavimento",
      )
      .order("codigo", { ascending: true });

    if (error) {
      setMessage(`Erro ao carregar extintores: ${error.message}`);
      setLoading(false);
      return;
    }

    setExtintores((data ?? []) as Extintor[]);
    setLoading(false);
  }, [supabase]);

  const loadConferenciasDoMes = useCallback(async () => {
    const { data, error } = await supabase
      .from("checklists")
      .select("extintor_id,data_conferencia")
      .gte("data_conferencia", currentMonthRange.start)
      .lt("data_conferencia", currentMonthRange.end);

    if (error) return;

    const set = new Set<string>();
    for (const row of (data ?? []) as Array<{ extintor_id: string }>) {
      if (row.extintor_id) set.add(row.extintor_id);
    }
    setConferidosNoMesIds(set);
  }, [supabase, currentMonthRange.start, currentMonthRange.end]);

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
    void loadConferenciasDoMes();
  }, [loadConferenciasDoMes, loadExtintores]);

  useEffect(() => {
    let mounted = true;
    const resolvePermissions = async () => {
      try {
        const session = await getCurrentSession();
        if (!session) {
          if (mounted) {
            setCanEdit(false);
            setMode("inspecao");
          }
          return;
        }
        const profile = await getProfileBySession(session);
        const isAdmin = profile?.role === "admin";
        const nome = profile?.nome?.trim() ?? "";
        if (mounted) {
          setCanEdit(Boolean(isAdmin));
          setConferenteNome(nome);
          setChecklistForm((prev) => ({ ...prev, conferente: prev.conferente || nome }));
          if (!isAdmin) setMode("inspecao");
        }
      } catch {
        if (mounted) {
          setCanEdit(false);
          setMode("inspecao");
        }
      }
    };

    void resolvePermissions();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1024px)");
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

  const extintoresSemPosicao = useMemo(
    () =>
      extintores.filter(
        (item) =>
          item.coord_x == null && item.coord_y == null && isSameFloor(item.pavimento, pavimento.label),
      ),
    [extintores, pavimento.label],
  );

  const markersDoPavimento = useMemo(
    () =>
      extintores.filter(
        (item) =>
          item.coord_x != null &&
          item.coord_y != null &&
          isSameFloor(item.pavimento, pavimento.label),
      ),
    [extintores, pavimento.label],
  );

  async function handleMapClick(lat: number, lng: number) {
    if (mode !== "edicao" || !selectedExtintorId) return;

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
    setChecklistForm({ ...INITIAL_CHECKLIST, conferente: conferenteNome });
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

    const payloadNovo = {
      extintor_id: selectedMarker.id,
      data_conferencia: new Date().toISOString(),
      conferente: checklistForm.conferente.trim(),
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
      observacoes: checklistForm.observacoes.trim() || null,
    };

    const { error } = await supabase
      .from("checklists")
      .insert(payloadNovo as unknown as Record<string, unknown>);

    let finalError = error;

    if (error?.message?.includes("schema cache") || error?.message?.includes("column")) {
      const observacoesLegado = [
        checklistForm.observacoes.trim(),
        `Local correto conforme mapa: ${checklistForm.local_correto ?? ""}`,
        `Dados do extintor corretos: ${checklistForm.dados_corretos ?? ""}`,
        `Sinalização correta: ${checklistForm.sinalizacao_correta ?? ""}`,
        `Mangueira em boas condições: ${checklistForm.mangueira_status ?? ""}`,
        `Bico/Difusor em boas condições: ${checklistForm.bico_difusor_status ?? ""}`,
        `Alça/Gatilho/Lacre/Pino em boas condições: ${checklistForm.alca_gatilho_status ?? ""}`,
        `Medidor de pressão correto: ${checklistForm.medidor_pressao_status ?? ""}`,
        `Cilindro em boas condições: ${checklistForm.cilindro_status ?? ""}`,
      ]
        .filter(Boolean)
        .join(" | ");

      const payloadLegado = {
        extintor_id: selectedMarker.id,
        data_conferencia: new Date().toISOString(),
        conferente: checklistForm.conferente.trim(),
        status_lacre: checklistForm.alca_gatilho_status === "conforme",
        status_manometro: checklistForm.medidor_pressao_status === "conforme",
        observacoes: observacoesLegado || null,
      } as unknown as Record<string, unknown>;

      const retry = await supabase.from("checklists").insert(payloadLegado);
      finalError = retry.error;
    }

    if (finalError) {
      setMessage(`Erro ao salvar checklist: ${finalError.message}`);
      setSavingChecklist(false);
      return;
    }

    setSelectedMarker(null);
    setChecklistForm({ ...INITIAL_CHECKLIST, conferente: conferenteNome });
    setMessage("Checklist salvo com sucesso.");
    await loadConferenciasDoMes();
    setSavingChecklist(false);
  }

  const mapContent = (
    <MapContainer
      key={pavimento.key}
      crs={L.CRS.Simple}
      preferCanvas={!isMobile}
      zoomSnap={isMobile ? 0.5 : 0.25}
      zoomDelta={isMobile ? 0.5 : 0.5}
      zoomAnimation={!isMobile}
      maxBoundsViscosity={1}
      attributionControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      <FitBounds bounds={mapBounds} maxZoomExtra={isMobile ? 3 : 4} bottomOffset={isMobile ? 64 : 0} />
      <ImageOverlay url={mapImagePath} bounds={mapBounds} className="map-plant-overlay" />
      <MapClickHandler
        enabled={canEdit && mode === "edicao" && Boolean(selectedExtintorId)}
        onClick={handleMapClick}
      />

      {markersDoPavimento.map((item) => (
        <Marker
          key={item.id}
          position={[item.coord_y as number, item.coord_x as number]}
          icon={extinguisherIcon(
            conferidosNoMesIds.has(item.id) ? "green" : "amber",
            item.codigo,
          )}
          eventHandlers={{
            click: () => {
              if (mode === "inspecao") openChecklistModal(item);
            },
            // contextmenu = long press no mobile (iOS/Android) em qualquer modo
            contextmenu: () => {
              if (isMobile) setInfoMarker(item);
            },
          }}
        >
          {/* No mobile em modo inspeção, o click já abre o modal diretamente.
              No desktop ou modo edição, mostra popup com informações. */}
          {!(isMobile && mode === "inspecao") && (
            <Popup>
              <div className="text-sm" style={{ minWidth: 160 }}>
                <p className="font-semibold">{item.codigo}</p>
                <p className="text-zinc-500">{item.local_detalhado}</p>
                <p
                  className={`mt-1 text-xs font-semibold ${
                    conferidosNoMesIds.has(item.id) ? "text-green-700" : "text-amber-700"
                  }`}
                >
                  {conferidosNoMesIds.has(item.id)
                    ? "✓ Conferido no mês"
                    : "⚠ Não conferido no mês"}
                </p>
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
                {mode === "inspecao" && (
                  <button
                    type="button"
                    className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-white"
                    style={{ background: "#E02020" }}
                    onClick={() => openChecklistModal(item)}
                  >
                    Realizar Conferência
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
      <main className="flex w-full flex-col bg-[#F5F5F5]" style={{ height: "100%", minHeight: 0 }}>
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white p-2">
          <select
            aria-label="Selecionar pavimento"
            className="min-w-36 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
            value={pavimento.key}
            onChange={(event) => {
              const selected = PAVIMENTOS.find((item) => item.key === event.target.value);
              if (selected) setPavimento(selected);
            }}
          >
            {PAVIMENTOS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          {canEdit && (
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                mode === "edicao" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
              onClick={() => setMode("edicao")}
            >
              Edição
            </button>
          )}

          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              mode === "inspecao" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
            }`}
            onClick={() => setMode("inspecao")}
          >
            Inspeção
          </button>
        </div>

        {canEdit && mode === "edicao" && (
          <div className="border-b border-zinc-200 bg-white p-2">
            <select
              aria-label="Selecionar extintor sem posição"
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
              value={selectedExtintorId}
              onChange={(event) => setSelectedExtintorId(event.target.value)}
            >
              <option value="">Selecione um extintor sem posição</option>
              {extintoresSemPosicao.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.codigo} - {item.local_detalhado || item.setor}
                </option>
              ))}
            </select>
          </div>
        )}

        <section
          className="relative overflow-hidden bg-white"
          style={{ flex: "1 1 0", minHeight: 0 }}
        >
          <MapErrorBoundary>{mapContent}</MapErrorBoundary>
        </section>

        {savingPosition && (
          <p className="border-t border-zinc-200 bg-white px-3 py-2 text-xs text-amber-700">
            Salvando posição...
          </p>
        )}
        {message && (
          <p className="border-t border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">{message}</p>
        )}

        {/* Bottom sheet de informação — aparece ao segurar o dedo (long press) no marcador */}
        {infoMarker && !selectedMarker && (
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
                        background: conferidosNoMesIds.has(infoMarker.id) ? "#16a34a" : "#d97706",
                      }}
                    />
                    <h3 className="text-lg font-bold text-zinc-900">{infoMarker.codigo}</h3>
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-500">{infoMarker.setor}</p>
                  <p className="text-sm text-zinc-500">{infoMarker.local_detalhado}</p>
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
                      conferidosNoMesIds.has(infoMarker.id)
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {conferidosNoMesIds.has(infoMarker.id) ? "✓ Conferido no mês" : "⚠ Não conferido"}
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
                {mode === "inspecao" && (
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
        {selectedMarker && (
          <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50">
            <div className="w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl" style={{ maxHeight: "90dvh" }}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Inspeção do Extintor
                  </p>
                  <h3 className="text-xl font-bold text-zinc-900">{selectedMarker.codigo}</h3>
                  <p className="text-sm text-zinc-600">
                    {selectedMarker.setor} - {selectedMarker.local_detalhado}
                  </p>
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      getMaintenanceStatus(selectedMarker) === "Vencido"
                        ? "text-red-700"
                        : getMaintenanceStatus(selectedMarker) === "Próximo de vencer (30 dias)"
                          ? "text-amber-700"
                          : "text-zinc-600"
                    }`}
                  >
                    Manutenção: {getMaintenanceStatus(selectedMarker)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  onClick={() => setSelectedMarker(null)}
                >
                  Fechar
                </button>
              </div>

              <ChecklistForm
                data={checklistForm}
                onChange={setChecklistForm}
                onSubmit={saveChecklist}
                onCancel={() => setSelectedMarker(null)}
                isSaving={savingChecklist}
              />
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Mapeamento e Inspeção de Extintores</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === "edicao" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
              onClick={() => setMode("edicao")}
            >
              Modo Edição
            </button>
          )}
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              mode === "inspecao" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
            }`}
            onClick={() => setMode("inspecao")}
          >
            Modo Inspeção
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[320px,1fr]">
        <aside className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <label htmlFor="pavimento" className="mb-1 block text-sm font-semibold text-zinc-700">
            Pavimento
          </label>
          <select
            id="pavimento"
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
            value={pavimento.key}
            onChange={(event) => {
              const selected = PAVIMENTOS.find((item) => item.key === event.target.value);
              if (selected) setPavimento(selected);
            }}
          >
            {PAVIMENTOS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
            <p>
              <span className="font-semibold text-zinc-800">Legenda:</span> 🧯{" "}
              <span className="font-semibold text-green-600">Verde</span> (conferido no mês) e{" "}
              <span className="font-semibold text-amber-600">Laranja</span> (não conferido no mês).
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Pendentes no mês atual:{" "}
            <span className="font-bold">
              {extintores.filter((item) => !conferidosNoMesIds.has(item.id)).length}
            </span>
          </div>

          {canEdit && mode === "edicao" && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-zinc-800">Extintores sem posição</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Selecione um item e clique no mapa para definir coordenadas.
              </p>
              <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">
                {extintoresSemPosicao.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full rounded-lg border p-2 text-left text-sm ${
                      selectedExtintorId === item.id
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700"
                    }`}
                    onClick={() => setSelectedExtintorId(item.id)}
                  >
                    <p className="font-semibold">{item.codigo}</p>
                    <p className="text-xs opacity-80">{item.local_detalhado || item.setor}</p>
                    {item.pavimento && (
                      <p className="text-[11px] opacity-70">Pavimento informado: {item.pavimento}</p>
                    )}
                  </button>
                ))}
                {extintoresSemPosicao.length === 0 && (
                  <p className="text-sm text-zinc-500">Nenhum extintor pendente neste pavimento.</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-zinc-500">
            {loading ? "Carregando dados..." : `${extintores.length} extintores encontrados.`}
          </div>
          {savingPosition && <p className="mt-1 text-xs text-amber-700">Salvando posição...</p>}
          {message && <p className="mt-2 rounded bg-zinc-100 p-2 text-xs text-zinc-700">{message}</p>}
        </aside>

        <section className="relative h-[78vh] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          {mapContent}
        </section>
      </div>

      {selectedMarker && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Inspeção do Extintor
                </p>
                <h3 className="text-xl font-bold text-zinc-900">{selectedMarker.codigo}</h3>
                <p className="text-sm text-zinc-600">
                  {selectedMarker.setor} - {selectedMarker.local_detalhado}
                </p>
                <p
                  className={`mt-1 text-xs font-semibold ${
                    getMaintenanceStatus(selectedMarker) === "Vencido"
                      ? "text-red-700"
                      : getMaintenanceStatus(selectedMarker) === "Próximo de vencer (30 dias)"
                        ? "text-amber-700"
                        : "text-zinc-600"
                  }`}
                >
                  Manutenção: {getMaintenanceStatus(selectedMarker)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                onClick={() => setSelectedMarker(null)}
              >
                Fechar
              </button>
            </div>

            <ChecklistForm
              data={checklistForm}
              onChange={setChecklistForm}
              onSubmit={saveChecklist}
              onCancel={() => setSelectedMarker(null)}
              isSaving={savingChecklist}
            />
          </div>
        </div>
      )}
    </main>
  );
}
