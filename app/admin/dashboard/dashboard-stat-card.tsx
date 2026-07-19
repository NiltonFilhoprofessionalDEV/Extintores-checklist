const STAT_ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function DashboardStatIcon({
  name,
}: {
  name: "total" | "vencido" | "alerta30" | "alerta60" | "alerta90" | "alerta120" | "semMapa";
}) {
  switch (name) {
    case "total":
      return (
        <svg {...STAT_ICON_PROPS}>
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );
    case "vencido":
      return (
        <svg {...STAT_ICON_PROPS}>
          <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h5" />
          <circle cx="17.5" cy="17.5" r="5.5" />
          <path d="m17.5 17.5-.5.5V14" />
        </svg>
      );
    case "alerta30":
      return (
        <svg {...STAT_ICON_PROPS}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "alerta60":
      return (
        <svg {...STAT_ICON_PROPS}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
        </svg>
      );
    case "alerta90":
      return (
        <svg {...STAT_ICON_PROPS}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
        </svg>
      );
    case "alerta120":
      return (
        <svg {...STAT_ICON_PROPS}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
        </svg>
      );
    case "semMapa":
      return (
        <svg {...STAT_ICON_PROPS}>
          <path d="M12.586 17.414 15 19.828" />
          <path d="M9.101 9.101 3.515 3.515" />
          <path d="m14.118 14.118 7.048 7.048" />
          <path d="M12.414 6.828 16 3.343" />
          <path d="M5.636 5.636 8.464 3" />
          <path d="M12 22s8-4.486 8-10A8 8 0 0 0 4 12c0 5.514 8 10 8 10" />
        </svg>
      );
  }
}

export function DashboardStatCard({
  label,
  value,
  color,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const className = `group relative flex w-full overflow-hidden rounded-[1.5rem] border border-white/80 bg-white p-5 text-left shadow-[var(--shadow-soft)] transition-all ${
    onClick
      ? "pressable cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] focus:outline-none focus:ring-2 focus:ring-[var(--neon)]/45"
      : ""
  }`;

  const content = (
    <>
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-15" style={{ background: color }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5" style={{ background: color }} />
      <div className="relative flex flex-col">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md ring-1 ring-inset ring-white/25"
          style={{ background: color }}
        >
          {icon}
        </div>
        <div className="mt-4 min-w-0">
          <p className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">{value}</p>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
          {onClick && (
            <p className="mt-2 inline-flex items-center rounded-full bg-[var(--forest)]/5 px-2 py-0.5 text-[10px] font-bold text-[var(--forest)] transition-colors group-hover:bg-[var(--neon)]/35">
              Ver detalhes
            </p>
          )}
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
