"use client";

import { formatDateOnlyPt } from "@/lib/date/date-only";
import { diasRestantesNivel2 } from "@/lib/dashboard/manutencao-nivel2";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";

export function PositionBadge({ positioned }: { positioned: boolean }) {
  return (
    <span className={`inv-badge ${positioned ? "inv-badge--ok" : "inv-badge--mute"}`}>
      {positioned ? "Posicionado" : "Sem posição"}
    </span>
  );
}

export function EquipmentCode({
  kind,
  codigo,
}: {
  kind: "extintor" | "hidrante";
  codigo: string;
}) {
  const visual = formatEquipmentIdentifier(kind, codigo);
  return (
    <div className="inv-code">
      <span className="inv-code__id">{visual}</span>
      {visual !== codigo.trim() ? <span className="inv-code__raw">{codigo}</span> : null}
    </div>
  );
}

export function MaintenanceCell({ date, today }: { date: string | null; today: Date }) {
  const label = formatDateOnlyPt(date);
  const days = diasRestantesNivel2(date, today);
  const tone = days == null ? "" : days < 0 ? "inv-maint--bad" : days <= 30 ? "inv-maint--warn" : "";

  return (
    <div className={`inv-maint ${tone}`}>
      <span className="inv-maint__date">{label}</span>
      {days != null ? (
        <span className="inv-maint__days">
          {days < 0 ? `${Math.abs(days)}d vencido` : `${days} dias`}
        </span>
      ) : null}
    </div>
  );
}

export function InventoryEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="inv-empty">
      <p className="inv-empty__title">{title}</p>
      <p className="inv-empty__desc">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn-secondary inv-empty__action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
