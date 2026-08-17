type IconProps = {
  size?: number;
  className?: string;
};

const outline = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ChecklistLocationIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...outline}>
      <path d="M12 21s7-5.4 7-11.25A7 7 0 005 9.75C5 15.6 12 21 12 21z" />
      <circle cx="12" cy="9.75" r="2.25" />
    </svg>
  );
}

export function ChecklistUserIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...outline}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.25c.9-3.1 3.4-4.75 6.5-4.75s5.6 1.65 6.5 4.75" />
    </svg>
  );
}

export function ChecklistChevronIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...outline}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ChecklistCheckIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...outline}>
      <path d="M5 12.5l4.2 4.2L19 7.5" />
    </svg>
  );
}
