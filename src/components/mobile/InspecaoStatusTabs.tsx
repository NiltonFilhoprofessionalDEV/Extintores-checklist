import type { InspecaoStatusTab } from "@/lib/inspecao/filter-types";

type InspecaoStatusTabsProps = {
  value: InspecaoStatusTab;
  todasCount: number;
  pendentesCount: number;
  concluidasCount: number;
  onChange: (tab: InspecaoStatusTab) => void;
};

const TABS: { id: InspecaoStatusTab; label: string }[] = [
  { id: "todas", label: "Todos" },
  { id: "pendentes", label: "Pendentes" },
  { id: "concluidas", label: "Concluídos" },
];

export default function InspecaoStatusTabs({
  value,
  todasCount,
  pendentesCount,
  concluidasCount,
  onChange,
}: InspecaoStatusTabsProps) {
  const counts: Record<InspecaoStatusTab, number> = {
    todas: todasCount,
    pendentes: pendentesCount,
    concluidas: concluidasCount,
  };

  return (
    <div className="inspecao-status-tabs" role="tablist" aria-label="Filtro rápido de status">
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inspecao-status-tab${active ? " is-active" : ""}`}
          >
            <span>{tab.label}</span>
            <span className="inspecao-status-tab__count">{counts[tab.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
