type EquipmentIconProps = {
  size?: number;
  className?: string;
};

export const EXTINGUISHER_ICON_PATH =
  "M11 2.25h2v2h-2v-2Zm-1.25 3.25h4.5v1.5h-4.5v-1.5ZM8 7.5h8c1.1 0 2 .9 2 2v10.75c0 1.52-1.23 2.75-2.75 2.75h-6.5C7.23 23 6 21.77 6 20.25V9.5c0-1.1.9-2 2-2Zm8.75 2.25c1.38 0 2.5 1.12 2.5 2.5V15h-1.75v-2.75c0-.41-.34-.75-.75-.75H16.75V9.75Z";

export const HYDRANT_ICON_PATH =
  "M12 2.75c2 0 3.62 1.62 3.62 3.62S14 10 12 10 8.38 8.38 8.38 6.38 10 2.75 12 2.75ZM10.25 10.25h3.5V18.5h-3.5v-8.25ZM6.75 12h2.5v2H6.75v-2Zm8.25 0h2.5v2H15v-2ZM7.5 19.25h9v2.25h-9v-2.25Z";

export function equipmentIconMarkup(
  kind: "extintor" | "hidrante",
  size: number,
  color = "currentColor",
): string {
  const path = kind === "extintor" ? EXTINGUISHER_ICON_PATH : HYDRANT_ICON_PATH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" aria-hidden="true"><path d="${path}"/></svg>`;
}

/** Silhueta minimalista de extintor. */
export function ExtinguisherIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d={EXTINGUISHER_ICON_PATH} />
    </svg>
  );
}

/** Silhueta minimalista de hidrante. */
export function HydrantIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d={HYDRANT_ICON_PATH} />
    </svg>
  );
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
      <path d="M7 3.25h1.5v1.5H7V3.25ZM5.75 5.25h4v1h-4v-1ZM5 7h6c.83 0 1.5.67 1.5 1.5v8.75c0 1.24-1 2.25-2.25 2.25H5.75C4.51 19.5 3.5 18.5 3.5 17.25V8.5C3.5 7.67 4.17 7 5 7Zm6.75 1.75c1.03 0 1.87.84 1.87 1.87V13h-1.4v-2.38c0-.26-.21-.47-.47-.47H11.75V8.75Z" />
      <path d="M23.25 4c1.52 0 2.75 1.23 2.75 2.75S24.77 9.5 23.25 9.5 20.5 8.27 20.5 6.75 21.73 4 23.25 4ZM21.25 9.75h4V16.5h-4V9.75ZM19 11.5h2v1.5h-2V11.5Zm6.25 0H27.5v1.5h-2.25V11.5ZM19.75 16.75h7.5v1.75h-7.5V16.75Z" />
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
