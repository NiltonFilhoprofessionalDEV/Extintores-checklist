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
  name:
    | "total"
    | "vencido"
    | "alerta30"
    | "alerta60"
    | "alerta90"
    | "alerta120"
    | "alerta180"
    | "alerta360"
    | "semMapa";
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
    case "alerta180":
      return (
        <svg {...STAT_ICON_PROPS}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
        </svg>
      );
    case "alerta360":
      return (
        <svg {...STAT_ICON_PROPS}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
          <path d="M12 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
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
  subtitle,
  value,
  color,
  icon,
  onClick,
}: {
  label: string;
  subtitle?: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const className = `group relative flex min-h-36 w-full overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-white p-5 text-left shadow-[var(--shadow-soft)] transition-all ${
    onClick
      ? "pressable cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[var(--shadow-lift)] focus:outline-none focus:ring-2 focus:ring-[var(--orange)]/30"
      : ""
  }`;

  const content = (
    <>
      <div className="pointer-events-none absolute inset-x-5 top-0 h-[3px] rounded-b-full" style={{ background: color }} />
      <div className="relative flex w-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="max-w-[13rem] text-xs font-bold leading-relaxed text-[var(--muted-foreground)]">
              {label}
            </p>
            {subtitle ? (
              <p className="mt-1 max-w-[14rem] text-[10px] font-semibold leading-snug text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${color}14`, color }}
          >
            {icon}
          </div>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="font-display text-4xl font-extrabold tracking-tight text-[var(--ink)]">{value}</p>
          {onClick && (
            <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--orange-deep)]">
              Detalhes <span aria-hidden>→</span>
            </span>
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
