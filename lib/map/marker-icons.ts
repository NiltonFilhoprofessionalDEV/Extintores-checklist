import L from "leaflet";
import { equipmentIconMarkup } from "@/src/components/EquipmentIcons";
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

function codigoLabel(codigo: string, maxLen = 6): string {
  const numMatch = codigo.match(/\d+/);
  const label = numMatch ? numMatch[0].replace(/^0+/, "") || numMatch[0] : codigo.slice(0, maxLen);
  return escapeMarkerLabel(label);
}

/** Âmbar puro falha contraste com número branco — escurece só o badge. */
function badgeFill(bg: string): string {
  return bg === MARKER_AMBER ? "#ea580c" : bg;
}

function badgeFontSize(label: string, compact: boolean): number {
  if (label.length >= 4) return compact ? 8 : 9;
  if (label.length === 3) return compact ? 9 : 10;
  return compact ? 10 : 11;
}

function numberedBadgeIcon(
  colors: MarkerColors,
  codigo: string,
  kind: "ext" | "hid",
  lod: MarkerLod,
  selected: boolean,
): L.DivIcon {
  const fill = badgeFill(colors.bg);
  const safeLabel = codigoLabel(codigo);
  const cacheKey = `badge-${kind}-${fill}-${safeLabel}-${lod}-${selected ? "sel" : "n"}`;

  return getCachedDivIcon(cacheKey, () => {
    const kindClass = kind === "hid" ? " map-marker-badge--hyd" : "";
    const selectedClass = selected ? " map-marker-badge--selected" : "";

    if (lod === "detail") {
      const width = selected ? 56 : 50;
      const height = selected ? 30 : 26;
      const iconSize = kind === "ext" ? 14 : 13;
      return L.divIcon({
        className: "map-marker-badge-icon",
        iconSize: [width, height],
        iconAnchor: [width / 2, height / 2],
        html: `<div class="map-marker-badge map-marker-badge--detail${kindClass}${selectedClass}" style="--marker-bg:${fill};width:${width}px;height:${height}px;">
          <span class="map-marker-badge__glyph">${equipmentIconMarkup(kind === "ext" ? "extintor" : "hidrante", iconSize)}</span>
          <span class="map-marker-badge__code">${safeLabel}</span>
        </div>`,
      });
    }

    const compact = lod === "dot";
    const size = compact ? (selected ? 26 : 22) : selected ? 30 : 26;
    const fontSize = badgeFontSize(safeLabel, compact);
    return L.divIcon({
      className: "map-marker-badge-icon",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div class="map-marker-badge map-marker-badge--${compact ? "compact" : "mid"}${kindClass}${selectedClass}" style="--marker-bg:${fill};width:${size}px;height:${size}px;font-size:${fontSize}px;">${safeLabel}</div>`,
    });
  });
}

export function extinguisherIcon(
  colors: MarkerColors,
  codigo = "",
  lod: MarkerLod = "detail",
  selected = false,
): L.DivIcon {
  return numberedBadgeIcon(colors, codigo, "ext", lod, selected);
}

export function hydrantIcon(
  colors: MarkerColors,
  codigo: string,
  lod: MarkerLod = "detail",
  selected = false,
): L.DivIcon {
  return numberedBadgeIcon(colors, codigo, "hid", lod, selected);
}
