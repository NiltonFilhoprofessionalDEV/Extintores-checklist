import type { CSSProperties } from "react";

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

function imageStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    display: "inline-block",
    flexShrink: 0,
    objectFit: "contain",
    verticalAlign: "middle",
  };
}

/** Markup para Leaflet divIcon — ícone colorido Magnific. */
export function equipmentIconMarkup(
  kind: EquipmentKind,
  size: number,
  _color = "currentColor",
): string {
  const src = EQUIPMENT_ICON_SRC[kind];
  const alt = kind === "extintor" ? "Extintor" : "Hidrante";
  return `<img src="${src}" width="${size}" height="${size}" alt="${alt}" aria-hidden="true" style="display:block;width:${size}px;height:${size}px;object-fit:contain;" />`;
}

function EquipmentImageIcon({
  kind,
  size = 24,
  className,
}: EquipmentIconProps & { kind: EquipmentKind }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- asset estático em /public
    <img
      src={EQUIPMENT_ICON_SRC[kind]}
      alt=""
      aria-hidden
      className={className}
      style={imageStyle(size)}
      draggable={false}
    />
  );
}

export function ExtinguisherIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return <EquipmentImageIcon kind="extintor" size={size} className={className} />;
}

export function HydrantIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return <EquipmentImageIcon kind="hidrante" size={size} className={className} />;
}

export function EquipmentPairIcon({ size = 24, className = "" }: EquipmentIconProps) {
  const iconSize = Math.round(size * 0.72);
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ width: size + 8, height: size }}
      aria-hidden
    >
      <EquipmentImageIcon kind="extintor" size={iconSize} />
      <span style={{ width: Math.max(4, Math.round(size * 0.12)) }} />
      <EquipmentImageIcon kind="hidrante" size={iconSize} />
    </span>
  );
}

export function EquipmentStatusIcon({
  kind,
  variant,
}: {
  kind: EquipmentKind;
  variant: "ok" | "pendente" | "alerta";
}) {
  const palette =
    variant === "alerta"
      ? { background: "#fff1f2", ring: "#fecdd3" }
      : variant === "pendente"
        ? { background: "#fff7ed", ring: "#fed7aa" }
        : { background: "#ecfdf5", ring: "#a7f3d0" };

  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border shadow-sm"
      style={{
        background: palette.background,
        borderColor: palette.ring,
      }}
    >
      <EquipmentImageIcon kind={kind} size={28} />
    </span>
  );
}
