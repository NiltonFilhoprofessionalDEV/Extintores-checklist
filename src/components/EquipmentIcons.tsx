type EquipmentIconProps = {
  size?: number;
  className?: string;
};

type EquipmentKind = "extintor" | "hidrante";

/**
 * Ícones Magnific (Flaticon) — uso com atribuição obrigatória no app/README.
 * Extintor: https://www.flaticon.com/br/icones-gratis/fogo
 * Hidrante: https://www.flaticon.com/br/icones-gratis/hidrante
 */
export const EQUIPMENT_ICON_SRC: Record<EquipmentKind, string> = {
  extintor: "/icons/extintor-magnific.png",
  hidrante: "/icons/hidrante-magnific.png",
};

export const EQUIPMENT_ICON_ATTRIBUTION_HTML = [
  '<a href="https://www.flaticon.com/br/icones-gratis/fogo" title="fogo ícones">Fogo ícones criados por Magnific - Flaticon</a>',
  '<a href="https://www.flaticon.com/br/icones-gratis/hidrante" title="hidrante ícones">Hidrante ícones criados por Magnific - Flaticon</a>',
] as const;

const EXTINGUISHER_OUTLINE_PATHS = [
  `<path d="M9.5 3.75h5" />`,
  `<path d="M14.5 3.75c1.35 0 2.5.9 2.5 2.15V8" />`,
  `<path d="M17 8c0 1.4-1.2 2.15-2.5 2.15" />`,
  `<path d="M12 3.75V6.5" />`,
  `<path d="M9.25 6.5h5.5" />`,
  `<path d="M8.4 8.25h7.2a1.4 1.4 0 011.4 1.4v9.1A2.75 2.75 0 0114.25 21.5h-4.5A2.75 2.75 0 017 18.75v-9.1a1.4 1.4 0 011.4-1.4z" />`,
  `<path d="M9.75 12.25h4.5" />`,
].join("");

const HYDRANT_OUTLINE_PATHS = [
  `<path d="M9 6.5h6v2.25H9z" />`,
  `<path d="M10.25 3.75h3.5v2.75h-3.5z" />`,
  `<path d="M8.5 8.75h7v8.5h-7z" />`,
  `<path d="M6.25 10.75H8.5v2.5H6.25a.75.75 0 01-.75-.75v-1a.75.75 0 01.75-.75z" />`,
  `<path d="M15.5 10.75h2.25a.75.75 0 01.75.75v1a.75.75 0 01-.75.75H15.5z" />`,
  `<path d="M7.5 17.25h9v3H7.5z" />`,
].join("");

/** Markup para Leaflet divIcon — mesmo outline da lista de inspeções. */
export function equipmentIconMarkup(
  kind: EquipmentKind,
  size: number,
  color = "#334155",
): string {
  const paths = kind === "extintor" ? EXTINGUISHER_OUTLINE_PATHS : HYDRANT_OUTLINE_PATHS;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const outlineProps = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Extintor outline — silhueta de planta de emergência, não ilustração colorida. */
export function ExtinguisherIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      {...outlineProps}
      dangerouslySetInnerHTML={{ __html: EXTINGUISHER_OUTLINE_PATHS }}
    />
  );
}

/** Hidrante outline — corpo, tampão e saídas laterais. */
export function HydrantIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      {...outlineProps}
      dangerouslySetInnerHTML={{ __html: HYDRANT_OUTLINE_PATHS }}
    />
  );
}

export function EquipmentPairIcon({ size = 24, className = "" }: EquipmentIconProps) {
  const iconSize = Math.round(size * 0.72);
  return (
    <span
      className={`inline-flex items-center text-slate-700 ${className}`}
      style={{ width: size + 8, height: size }}
      aria-hidden
    >
      <ExtinguisherIcon size={iconSize} />
      <span style={{ width: Math.max(4, Math.round(size * 0.12)) }} />
      <HydrantIcon size={iconSize} />
    </span>
  );
}

export function EquipmentStatusIcon({
  kind,
}: {
  kind: EquipmentKind;
  /** Mantido por compatibilidade; o container do ícone não usa mais cor de status. */
  variant?: "ok" | "pendente" | "alerta";
}) {
  return (
    <span className="inspecao-equipment-icon" aria-hidden>
      {kind === "extintor" ? <ExtinguisherIcon size={22} /> : <HydrantIcon size={22} />}
    </span>
  );
}
