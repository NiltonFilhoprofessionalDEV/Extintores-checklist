"use client";

import { useEffect, type ReactNode } from "react";
import ExportActions from "@/src/components/ExportActions";

type DashboardDetailDrawerProps = {
  title: string;
  subtitle: string;
  periodLabel?: string;
  countLabel: string;
  onClose: () => void;
  onExcel?: () => void;
  onPdf?: () => void | Promise<unknown>;
  footer?: ReactNode;
  children: ReactNode;
};

export function RemainingDaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="dash-days dash-days--mute">—</span>;
  const tone = days < 0 ? "bad" : days <= 30 ? "warn" : "ok";
  return (
    <span className={`dash-days dash-days--${tone}`}>
      {days < 0 ? `${Math.abs(days)}d vencido` : `${days}d`}
    </span>
  );
}

export default function DashboardDetailDrawer({
  title,
  subtitle,
  periodLabel,
  countLabel,
  onClose,
  onExcel,
  onPdf,
  footer,
  children,
}: DashboardDetailDrawerProps) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="dash-drawer-layer" onClick={onClose} role="presentation">
      <aside
        className="dash-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dash-drawer__handle" aria-hidden />
        <header className="dash-drawer__header">
          <div className="dash-drawer__heading">
            <p className="dash-drawer__eyebrow">Detalhamento</p>
            <h2 id="dash-drawer-title">{title}</h2>
            <p className="dash-drawer__sub">{subtitle}</p>
            {periodLabel ? <p className="dash-drawer__period">Período: {periodLabel}</p> : null}
            <p className="dash-drawer__count">{countLabel}</p>
          </div>
          <div className="dash-drawer__actions">
            {onExcel && onPdf ? (
              <ExportActions compact onExcel={onExcel} onPdf={onPdf} />
            ) : null}
            <button type="button" className="dash-drawer__close" onClick={onClose} aria-label="Fechar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden>
                <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>
        <div className="dash-drawer__body">{children}</div>
        {footer ? <footer className="dash-drawer__footer">{footer}</footer> : null}
      </aside>
    </div>
  );
}
