import { filtrarPorEquipe, type EquipeConferenciaId } from "@/lib/equipes/conferencia-filtro";
import { hasStoredMapPosition, type MapCoordinateFields } from "@/lib/map/coordinates";
import { itemMatchesFloor, type FloorMatchableItem, type FloorRef } from "@/lib/map/floor-matching";
import {
  formatMapMarkerLabel,
  mapKindLabel,
  type MapEquipmentKind,
} from "@/lib/map/marker-label";
import { matchesInspectionStatus, type MapFilterState } from "@/lib/map/map-filters";

export type SearchableMapEquipment = FloorMatchableItem &
  MapCoordinateFields & {
    id: string;
    codigo: string;
    kind: MapEquipmentKind;
    localizacao: string;
    conferido: boolean;
    naoConforme: boolean;
  };

export type MapSearchHit = {
  id: string;
  kind: MapEquipmentKind;
  codigo: string;
  displayLabel: string;
  tipoLabel: "Extintor" | "Hidrante";
  setorLabel: string;
  localizacao: string;
  floorId: string | null;
  hasPosition: boolean;
};

export type ParsedEquipmentQuery = {
  kind: MapEquipmentKind | null;
  digits: string;
  text: string;
};

export function parseEquipmentSearchQuery(raw: string): ParsedEquipmentQuery {
  const text = raw.trim().toLowerCase();
  if (!text) return { kind: null, digits: "", text: "" };

  const prefixed = text.match(/^([eh])[\s\-–.]*(\d+)$/i);
  if (prefixed) {
    const kind: MapEquipmentKind = prefixed[1].toLowerCase() === "h" ? "hidrante" : "extintor";
    return { kind, digits: prefixed[2], text };
  }

  const onlyDigits = text.match(/^\d+$/);
  return { kind: null, digits: onlyDigits ? onlyDigits[0] : "", text };
}

export function resolveFloorForEquipment(
  item: FloorMatchableItem,
  floors: FloorRef[],
): FloorRef | null {
  const floorId = item.floor_id?.trim();
  if (floorId) {
    return floors.find((floor) => floor.id === floorId) ?? null;
  }
  return floors.find((floor) => itemMatchesFloor(item, floor)) ?? null;
}

function scoreEquipmentHit(item: SearchableMapEquipment, parsed: ParsedEquipmentQuery): number {
  const codigo = item.codigo.toLowerCase();
  const loc = item.localizacao.toLowerCase();
  const label = formatMapMarkerLabel(item.kind, item.codigo).toLowerCase();
  const num = mapEquipmentNumberSafe(item.codigo);

  if (parsed.kind && parsed.kind !== item.kind) return -1;

  if (parsed.digits) {
    if (num === parsed.digits || num === parsed.digits.replace(/^0+/, "") || Number(num) === Number(parsed.digits)) {
      return 100;
    }
    if (num.startsWith(parsed.digits) || parsed.digits.startsWith(num)) return 70;
    if (codigo.includes(parsed.digits) || label.includes(parsed.digits)) return 40;
  }

  if (parsed.text) {
    if (label === parsed.text || codigo === parsed.text) return 90;
    if (label.startsWith(parsed.text) || codigo.startsWith(parsed.text)) return 60;
    if (codigo.includes(parsed.text) || label.includes(parsed.text)) return 35;
    if (loc.includes(parsed.text)) return 20;
  }

  return parsed.text || parsed.digits ? -1 : 0;
}

function mapEquipmentNumberSafe(codigo: string): string {
  const match = codigo.match(/(\d+)\s*$/);
  if (!match) return "";
  return String(Number.parseInt(match[1], 10));
}

export function searchBaseEquipment(
  items: SearchableMapEquipment[],
  query: string,
  filters: MapFilterState,
  floors: FloorRef[],
  limit = 8,
): MapSearchHit[] {
  const parsed = parseEquipmentSearchQuery(query);
  if (!parsed.text) return [];

  const byLayer = items.filter((item) => {
    if (item.kind === "extintor" && !filters.layers.extintor) return false;
    if (item.kind === "hidrante" && !filters.layers.hidrante) return false;
    return matchesInspectionStatus(item.conferido, item.naoConforme, filters.status);
  });

  const byEquipe = [
    ...filtrarPorEquipe(
      byLayer.filter((item) => item.kind === "extintor"),
      filters.equipe as EquipeConferenciaId | "",
      "extintor",
    ),
    ...filtrarPorEquipe(
      byLayer.filter((item) => item.kind === "hidrante"),
      filters.equipe as EquipeConferenciaId | "",
      "hidrante",
    ),
  ];

  const ranked = byEquipe
    .map((item) => ({ item, score: scoreEquipmentHit(item, parsed) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.codigo.localeCompare(b.item.codigo, "pt-BR", { numeric: true });
    })
    .slice(0, limit);

  return ranked.map(({ item }) => {
    const floor = resolveFloorForEquipment(item, floors);
    return {
      id: item.id,
      kind: item.kind,
      codigo: item.codigo,
      displayLabel: formatMapMarkerLabel(item.kind, item.codigo),
      tipoLabel: mapKindLabel(item.kind),
      setorLabel: floor?.label ?? item.pavimento?.trim() ?? "—",
      localizacao: item.localizacao,
      floorId: item.floor_id?.trim() || floor?.id || null,
      hasPosition: hasStoredMapPosition(item),
    };
  });
}
