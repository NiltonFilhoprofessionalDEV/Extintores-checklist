import L from "leaflet";
import { equipmentIconMarkup } from "@/src/components/EquipmentIcons";
import type { MarkerColors } from "@/lib/map/marker-styles";
import type { MarkerLod } from "@/lib/map/marker-lod";

const MARCADOR_RING_PAD = 4;

const markerIconCache = new Map<string, L.DivIcon>();

function getCachedDivIcon(key: string, factory: () => L.DivIcon): L.DivIcon {
  const cached = markerIconCache.get(key);
  if (cached) return cached;
  const icon = factory();
  markerIconCache.set(key, icon);
  if (markerIconCache.size > 500) {
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

function dotIcon(colors: MarkerColors, kind: "ext" | "hid", selected: boolean): L.DivIcon {
  const ring = selected ? "#2563eb" : colors.ring;
  const size = selected ? 16 : 12;
  const cacheKey = `dot-${kind}-${colors.bg}-${ring}-${selected}`;
  return getCachedDivIcon(cacheKey, () =>
    L.divIcon({
      className: "map-marker-dot-icon",
      iconSize: [size + 4, size + 4],
      iconAnchor: [(size + 4) / 2, (size + 4) / 2],
      html: `<div class="map-marker-dot${selected ? " map-marker-dot--selected" : ""}" style="--marker-bg:${colors.bg};--marker-ring:${ring};width:${size}px;height:${size}px;"></div>`,
    }),
  );
}

export function extinguisherIcon(
  colors: MarkerColors,
  codigo = "",
  lod: MarkerLod = "detail",
  selected = false,
): L.DivIcon {
  if (lod === "dot") return dotIcon(colors, "ext", selected);

  const { bg: statusBg, ring } = colors;
  const safeLabel = codigoLabel(codigo);
  const showLabel = lod === "detail";
  const cacheKey = `ext-${statusBg}-${ring}-${safeLabel}-${lod}-${selected ? "sel" : "n"}`;

  return getCachedDivIcon(cacheKey, () => {
    if (lod === "icon") {
      return L.divIcon({
        className: "map-mobile-marker-icon",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        html: `<div class="map-marker-mobile map-marker-mobile--icon-only" style="--marker-bg:${statusBg};--marker-ring:${ring};">
        <div class="map-marker-mobile__ring-wrap">
          <div class="map-marker-mobile__symbol map-marker-mobile__symbol--ext">${equipmentIconMarkup("extintor", 15)}</div>
        </div>
      </div>`,
      });
    }

    return L.divIcon({
      className: showLabel ? "map-mobile-marker-icon" : "",
      iconSize: [38, 50],
      iconAnchor: [19, 16],
      html: showLabel
        ? `<div class="map-marker-mobile" style="--marker-bg:${statusBg};--marker-ring:${ring};">
        <div class="map-marker-mobile__ring-wrap">
          <div class="map-marker-mobile__symbol map-marker-mobile__symbol--ext">${equipmentIconMarkup("extintor", 16)}</div>
        </div>
        <span class="map-marker-mobile__label">${safeLabel}</span>
      </div>`
        : `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="padding:${MARCADOR_RING_PAD}px;border-radius:9999px;background:${ring};box-shadow:0 2px 4px rgba(0,0,0,0.28);">
        <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#fff;border:2px solid #fff;">${equipmentIconMarkup("extintor", 16)}</div>
      </div>
      <span style="background:rgba(0,0,0,0.65);color:#fff;font-size:9px;font-weight:700;border-radius:3px;padding:1px 4px;">${safeLabel}</span>
    </div>`,
    });
  });
}

export function hydrantIcon(
  colors: MarkerColors,
  codigo: string,
  lod: MarkerLod = "detail",
  selected = false,
): L.DivIcon {
  if (lod === "dot") return dotIcon(colors, "hid", selected);

  const { bg: statusBg, ring } = colors;
  const safeLabel = codigoLabel(codigo);
  const showLabel = lod === "detail";
  const cacheKey = `hid-${statusBg}-${ring}-${safeLabel}-${lod}-${selected ? "sel" : "n"}`;

  return getCachedDivIcon(cacheKey, () => {
    if (lod === "icon") {
      return L.divIcon({
        className: "map-mobile-marker-icon",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<div class="map-marker-mobile map-marker-mobile--icon-only" style="--marker-bg:${statusBg};--marker-ring:${ring};">
        <div class="map-marker-mobile__ring-wrap map-marker-mobile__ring-wrap--square">
          <div class="map-marker-mobile__symbol map-marker-mobile__symbol--hyd">${equipmentIconMarkup("hidrante", 14)}</div>
        </div>
      </div>`,
      });
    }

    return L.divIcon({
      className: showLabel ? "map-mobile-marker-icon" : "",
      iconSize: [34, 44],
      iconAnchor: [17, 15],
      html: showLabel
        ? `<div class="map-marker-mobile" style="--marker-bg:${statusBg};--marker-ring:${ring};">
        <div class="map-marker-mobile__ring-wrap map-marker-mobile__ring-wrap--square">
          <div class="map-marker-mobile__symbol map-marker-mobile__symbol--hyd">${equipmentIconMarkup("hidrante", 15)}</div>
        </div>
        <span class="map-marker-mobile__label">${safeLabel}</span>
      </div>`
        : `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="padding:${MARCADOR_RING_PAD}px;border-radius:9px;background:${ring};box-shadow:0 2px 4px rgba(0,0,0,0.28);">
        <div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:4px;background:#fff;border:2px solid #fff;">${equipmentIconMarkup("hidrante", 15)}</div>
      </div>
      <span style="background:rgba(0,0,0,0.65);color:#fff;font-size:9px;font-weight:700;border-radius:2px;padding:1px 4px;">${safeLabel}</span>
    </div>`,
    });
  });
}
