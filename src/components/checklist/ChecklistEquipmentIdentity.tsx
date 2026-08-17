import type { ReactNode } from "react";
import { formatEquipmentIdentifier, mapKindLabel, type MapEquipmentKind } from "@/lib/map/marker-label";
import { ExtinguisherIcon, HydrantIcon } from "@/src/components/EquipmentIcons";
import { ChecklistChevronIcon, ChecklistLocationIcon } from "./ChecklistUiIcons";

type ChecklistEquipmentIdentityProps = {
  kind: MapEquipmentKind;
  codigo: string;
  meta: string;
  local: string;
  expanded: boolean;
  onToggle: () => void;
  extra?: ReactNode;
  children?: ReactNode;
};

export default function ChecklistEquipmentIdentity({
  kind,
  codigo,
  meta,
  local,
  expanded,
  onToggle,
  extra,
  children,
}: ChecklistEquipmentIdentityProps) {
  const identifier = formatEquipmentIdentifier(kind, codigo);

  return (
    <header className="checklist-equipment-header">
      <div className="checklist-equipment-header__top">
        <span className="checklist-equipment-header__icon">
          {kind === "extintor" ? <ExtinguisherIcon size={26} /> : <HydrantIcon size={26} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="checklist-equipment-header__kind">{mapKindLabel(kind)}</p>
          <h2 className="checklist-equipment-header__codigo">{identifier}</h2>
          {meta ? <p className="checklist-equipment-header__meta">{meta}</p> : null}
        </div>
      </div>

      <p className="checklist-equipment-header__local">
        <ChecklistLocationIcon size={15} />
        <span>{local || "Local não informado"}</span>
      </p>

      {extra}

      <button
        type="button"
        onClick={onToggle}
        className="checklist-equipment-header__toggle"
        aria-expanded={expanded}
      >
        {expanded ? "Ocultar dados do equipamento" : "Ver dados do equipamento"}
        <ChecklistChevronIcon size={14} className={expanded ? "rotate-90" : ""} />
      </button>

      {expanded ? children : null}
    </header>
  );
}
