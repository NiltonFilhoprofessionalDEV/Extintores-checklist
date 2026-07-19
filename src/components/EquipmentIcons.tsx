type EquipmentIconProps = {
  size?: number;
  className?: string;
};

export function ExtinguisherIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 8.5h6v10.25A2.25 2.25 0 0 1 12.75 21h-1.5A2.25 2.25 0 0 1 9 18.75V8.5Z" />
      <path d="M8 8.5h8M9.5 5.5h5M12 3v2.5M10 3h4" />
      <path d="M15 10h2.6c1.35 0 2.4 1.08 2.4 2.4V15" />
      <path d="M20 15h-1.5" />
      <path d="M12 12.25c-.9 1.1-1.35 1.85-1.35 2.55a1.35 1.35 0 0 0 2.7 0c0-.7-.45-1.45-1.35-2.55Z" />
    </svg>
  );
}

export function HydrantIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 9.5h8V20H8z" />
      <path d="M7 9.5h10M9 6.5h6l1 3H8l1-3ZM10.5 4h3M12 4v2.5" />
      <path d="M8 12H5.5v4H8M16 12h2.5v4H16M4 20h16" />
      <path d="M10.25 13.5h3.5M10.25 16.5h3.5" />
    </svg>
  );
}

export function EquipmentPairIcon({ size = 24, className = "" }: EquipmentIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4.5 8h7v11.5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V8ZM3.5 8h9M6 5.5h4M8 3.5v2M11.5 10h2.5c1.2 0 2 1 2 2.2V14" />
      <path d="M21 9h7v11h-7zM20 9h9M22 6h5l1 3h-7l1-3ZM24.5 4v2M22 4h5M21 12h-2v3h2M28 12h2v3h-2M19 20h11" />
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
      {kind === "extintor" ? <ExtinguisherIcon size={26} /> : <HydrantIcon size={27} />}
    </span>
  );
}
