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
    <div className="flex gap-1 rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--muted)] p-1">
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[var(--fc-radius-md)] px-2 py-2 text-xs font-bold transition ${
              active
                ? "bg-white text-[var(--fc-text-primary)] shadow-sm"
                : "text-[var(--fc-text-secondary)]"
            }`}
          >
            <span>{tab.label}</span>
            <span className={active ? "text-[var(--fc-primary)]" : "text-slate-400"}>
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
