import L from "leaflet";
import { equipmentIconMarkup } from "@/src/components/EquipmentIcons";
import { formatMapMarkerLabel, type MapEquipmentKind } from "@/lib/map/marker-label";
import { MARKER_AMBER, type MarkerColors } from "@/lib/map/marker-styles";
import type { MarkerLod } from "@/lib/map/marker-lod";

const markerIconCache = new Map<string, L.DivIcon>();

function getCachedDivIcon(key: string, factory: () => L.DivIcon): L.DivIcon {
  const cached = markerIconCache.get(key);
  if (cached) return cached;
  const icon = factory();
  markerIconCache.set(key, icon);
  if (markerIconCache.size > 1600) {
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

/** Âmbar puro falha contraste com número branco — escurece só o badge. */
function badgeFill(bg: string): string {
  return bg === MARKER_AMBER ? "#ea580c" : bg;
}

function badgeFontSize(label: string, lod: MarkerLod): number {
  const long = label.length >= 6;
  if (lod === "dot") return long ? 9 : 10;
  if (lod === "icon") return long ? 10 : 11;
  return long ? 11 : 12;
}

function badgeBox(label: string, lod: MarkerLod, selected: boolean): { width: number; height: number } {
  const extra = selected ? 4 : 0;
  const charW = lod === "dot" ? 7 : lod === "icon" ? 7.5 : 8;
  const padX = lod === "detail" ? 28 : 12;
  const width = Math.round(label.length * charW + padX + extra);
  const height = (lod === "dot" ? 20 : lod === "icon" ? 24 : 28) + extra;
  return { width: Math.max(width, lod === "dot" ? 40 : 44), height };
}

function numberedBadgeIcon(
  colors: MarkerColors,
  codigo: string,
  kind: MapEquipmentKind,
  lod: MarkerLod,
  selected: boolean,
  pulse: boolean,
): L.DivIcon {
  const fill = badgeFill(colors.bg);
  const label = formatMapMarkerLabel(kind, codigo);
  const safeLabel = escapeMarkerLabel(label);
  const cacheKey = `badge-${kind}-${fill}-${safeLabel}-${lod}-${selected ? "sel" : "n"}-${pulse ? "p" : "0"}`;

  return getCachedDivIcon(cacheKey, () => {
    const selectedClass = selected ? " map-marker-badge--selected" : "";
    const pulseClass = pulse ? " map-marker-badge--pulse" : "";
    const { width, height } = badgeBox(label, lod, selected);
    const hitW = width + 10;
    const hitH = height + 12;
    const fontSize = badgeFontSize(label, lod);

    const inner =
      lod === "detail"
        ? `<span class="map-marker-badge__glyph">${equipmentIconMarkup(kind === "extintor" ? "extintor" : "hidrante", 13)}</span><span class="map-marker-badge__code">${safeLabel}</span>`
        : `<span class="map-marker-badge__code">${safeLabel}</span>`;

    return L.divIcon({
      className: "map-marker-badge-icon",
      iconSize: [hitW, hitH],
      iconAnchor: [hitW / 2, hitH / 2],
      html: `<div class="map-marker-hit"><div class="map-marker-badge map-marker-badge--${lod}${selectedClass}${pulseClass}" style="--marker-bg:${fill};width:${width}px;height:${height}px;font-size:${fontSize}px;">${inner}</div></div>`,
    });
  });
}

export function extinguisherIcon(
  colors: MarkerColors,
  codigo = "",
  lod: MarkerLod = "detail",
  selected = false,
  pulse = false,
): L.DivIcon {
  return numberedBadgeIcon(colors, codigo, "extintor", lod, selected, pulse);
}

export function hydrantIcon(
  colors: MarkerColors,
  codigo: string,
  lod: MarkerLod = "detail",
  selected = false,
  pulse = false,
): L.DivIcon {
  return numberedBadgeIcon(colors, codigo, "hidrante", lod, selected, pulse);
}
