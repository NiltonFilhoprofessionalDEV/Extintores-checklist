import { parseNumeroSequencialCodigo } from "@/lib/equipes/conferencia-filtro";

export type MapEquipmentKind = "extintor" | "hidrante";

/** Prefixo visual no mapa. Não altera o código persistido. */
export function mapKindPrefix(kind: MapEquipmentKind): "E" | "H" {
  return kind === "hidrante" ? "H" : "E";
}

export function mapKindLabel(kind: MapEquipmentKind): "Extintor" | "Hidrante" {
  return kind === "hidrante" ? "Hidrante" : "Extintor";
}

/**
 * Número exibido no marcador: dígitos do código, com zero à esquerda até 2 casas.
 * "7" → "07", "25" → "25", "190" → "190".
 */
export function mapEquipmentNumber(codigo: string): string {
  const n = parseNumeroSequencialCodigo(codigo);
  if (n == null) {
    const trimmed = codigo.trim();
    return trimmed ? trimmed.slice(0, 6) : "—";
  }
  return n < 10 ? String(n).padStart(2, "0") : String(n);
}

/** Rótulo visual E-25 / H-07. Não altera o código persistido. */
export function formatEquipmentIdentifier(kind: MapEquipmentKind, codigo: string): string {
  return `${mapKindPrefix(kind)}-${mapEquipmentNumber(codigo)}`;
}

/** Alias usado no mapa. */
export function formatMapMarkerLabel(kind: MapEquipmentKind, codigo: string): string {
  return formatEquipmentIdentifier(kind, codigo);
}
