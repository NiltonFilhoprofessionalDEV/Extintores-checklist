import type { CSSProperties } from "react";

type EquipmentIconProps = {
  size?: number;
  className?: string;
};

type EquipmentKind = "extintor" | "hidrante";

/** Assets reais em public/icons — substitua pelos PNGs enviados pelo usuário. */
export const EQUIPMENT_ICON_SRC: Record<EquipmentKind, string> = {
  extintor: "/icons/extintor.png",
  hidrante: "/icons/hidrante.png",
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

export function equipmentIconMarkup(
  kind: EquipmentKind,
  size: number,
  color = "currentColor",
): string {
  const src = EQUIPMENT_ICON_SRC[kind];
  return `<span aria-hidden="true" style="display:inline-block;width:${size}px;height:${size}px;background:${color};-webkit-mask:url(${src}) center/contain no-repeat;mask:url(${src}) center/contain no-repeat;"></span>`;
}

function EquipmentImageIcon({
  kind,
  size = 24,
  className,
}: EquipmentIconProps & { kind: EquipmentKind }) {
  return (
    <span
      aria-hidden
      className={className}
      style={equipmentMaskStyle(kind, size, "currentColor")}
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
      <EquipmentImageIcon kind={kind} size={26} />
    </span>
  );
}
