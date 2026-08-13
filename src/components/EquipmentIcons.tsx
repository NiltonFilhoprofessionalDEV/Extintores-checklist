import type { CSSProperties } from "react";

type EquipmentIconProps = {
  size?: number;
  className?: string;
  color?: string;
};

type EquipmentKind = "extintor" | "hidrante";

/**
 * Silhuetas monocromáticas derivadas dos ícones Magnific (Flaticon).
 * Aplicadas via CSS mask com currentColor (uma cor só).
 * Extintor: https://www.flaticon.com/br/icones-gratis/fogo
 * Hidrante: https://www.flaticon.com/br/icones-gratis/hidrante
 */
export const EQUIPMENT_ICON_SRC: Record<EquipmentKind, string> = {
  extintor: "/icons/extintor-magnific.png",
  hidrante: "/icons/hidrante-magnific.png",
};

function equipmentMaskStyle(kind: EquipmentKind, size: number, color: string): CSSProperties {
  const src = EQUIPMENT_ICON_SRC[kind];
  return {
    width: size,
    height: size,
    display: "inline-block",
    flexShrink: 0,
    backgroundColor: color,
    WebkitMask: `url(${src}) center / contain no-repeat`,
    mask: `url(${src}) center / contain no-repeat`,
  };
}

/** Markup para Leaflet divIcon — silhueta em uma cor. */
export function equipmentIconMarkup(
  kind: EquipmentKind,
  size: number,
  color = "currentColor",
): string {
  const src = EQUIPMENT_ICON_SRC[kind];
  return `<span aria-hidden="true" style="display:inline-block;width:${size}px;height:${size}px;background:${color};-webkit-mask:url(${src}) center/contain no-repeat;mask:url(${src}) center/contain no-repeat;"></span>`;
}

function EquipmentMaskIcon({
  kind,
  size = 24,
  className = "",
  color = "currentColor",
}: EquipmentIconProps & { kind: EquipmentKind }) {
  return (
    <span
      aria-hidden
      className={className}
      style={equipmentMaskStyle(kind, size, color)}
    />
  );
}

export function ExtinguisherIcon({ size = 24, className = "", color = "currentColor" }: EquipmentIconProps) {
  return <EquipmentMaskIcon kind="extintor" size={size} className={className} color={color} />;
}

export function HydrantIcon({ size = 24, className = "", color = "currentColor" }: EquipmentIconProps) {
  return <EquipmentMaskIcon kind="hidrante" size={size} className={className} color={color} />;
}

export function EquipmentPairIcon({ size = 24, className = "" }: EquipmentIconProps) {
  const iconSize = Math.round(size * 0.72);
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ width: size + 8, height: size }}
      aria-hidden
    >
      <EquipmentMaskIcon kind="extintor" size={iconSize} />
      <span style={{ width: Math.max(4, Math.round(size * 0.12)) }} />
      <EquipmentMaskIcon kind="hidrante" size={iconSize} />
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
      ? { background: "#fff1f2", color: "#e11d48", ring: "#fecdd3" }
      : variant === "pendente"
        ? { background: "#fff7ed", color: "#ea580c", ring: "#fed7aa" }
        : { background: "#ecfdf5", color: "#059669", ring: "#a7f3d0" };

  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border shadow-sm"
      style={{
        background: palette.background,
        color: palette.color,
        borderColor: palette.ring,
      }}
    >
      <EquipmentMaskIcon kind={kind} size={26} />
    </span>
  );
}
