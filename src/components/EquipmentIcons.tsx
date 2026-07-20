type EquipmentIconProps = {
  size?: number;
  className?: string;
};

/** Corpo do extintor — silhueta lateral com mangueira à esquerda. */
const EXTINGUISHER_PATHS = [
  "M11.25 2.75h1.5v1.75h-1.5V2.75Z",
  "M9.75 5h4.5v1.25H9.75V5Z",
  "M10.25 6.75h3.5c1.1 0 2 .9 2 2v11.25c0 1.24-1.01 2.25-2.25 2.25h-3c-1.24 0-2.25-1.01-2.25-2.25V8.75c0-1.1.9-2 2-2Z",
  "M10.25 9.25H9.1c-1.93 0-3.5 1.57-3.5 3.5v2.75c0 .69.56 1.25 1.25 1.25h1.15v-1.25H7.35v-2.75c0-1.04.84-1.88 1.88-1.88h1.02V9.25Z",
  "M5.15 16h2.1v1.75H5.15V16Z",
];

/** Hidrante — cúpula, coluna, saídas laterais e base. */
const HYDRANT_PATHS = [
  "M12 2.75c2.07 0 3.75 1.68 3.75 3.75S14.07 10.25 12 10.25 8.25 8.57 8.25 6.5 9.93 2.75 12 2.75Z",
  "M10.5 10.25h3v8h-3v-8Z",
  "M6.75 12h2.75v2H6.75v-2Z",
  "M14.5 12h2.75v2H14.5v-2Z",
  "M7.5 18.75h9v2.25h-9v-2.25Z",
];

function renderIconPaths(paths: string[], color = "currentColor") {
  return paths.map((d) => `<path d="${d}"/>`).join("");
}

export function equipmentIconMarkup(
  kind: "extintor" | "hidrante",
  size: number,
  color = "currentColor",
): string {
  const paths = kind === "extintor" ? EXTINGUISHER_PATHS : HYDRANT_PATHS;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" aria-hidden="true">${renderIconPaths(paths, color)}</svg>`;
}

function IconSvg({
  paths,
  size,
  className,
}: EquipmentIconProps & { paths: string[] }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Silhueta de extintor (referência do app). */
export function ExtinguisherIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return <IconSvg paths={EXTINGUISHER_PATHS} size={size} className={className} />;
}

/** Silhueta de hidrante (referência do app). */
export function HydrantIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return <IconSvg paths={HYDRANT_PATHS} size={size} className={className} />;
}

export function EquipmentPairIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <g transform="translate(1 0) scale(0.72)">
        {EXTINGUISHER_PATHS.map((d) => (
          <path key={`ext-${d}`} d={d} />
        ))}
      </g>
      <g transform="translate(14 0) scale(0.72)">
        {HYDRANT_PATHS.map((d) => (
          <path key={`hid-${d}`} d={d} />
        ))}
      </g>
    </svg>
  );
}

export function EquipmentStatusIcon({
  kind,
  variant,
}: {
  kind: "extintor" | "hidrante";
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
      {kind === "extintor" ? <ExtinguisherIcon size={26} /> : <HydrantIcon size={26} />}
    </span>
  );
}
