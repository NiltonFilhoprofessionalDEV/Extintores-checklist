type ViewMode = "estoque" | "manutencao";

type EstoqueViewTabsProps = {
  view: ViewMode;
  manutencaoPendentes: number;
  onChange: (view: ViewMode) => void;
};

export default function EstoqueViewTabs({ view, manutencaoPendentes, onChange }: EstoqueViewTabsProps) {
  return (
    <div className="estoque-tabs" role="tablist" aria-label="Seções de estoque e manutenção">
      <button
        type="button"
        role="tab"
        aria-selected={view === "estoque"}
        className={`estoque-tabs__btn ${view === "estoque" ? "estoque-tabs__btn--active" : ""}`}
        onClick={() => onChange("estoque")}
      >
        Estoque disponível
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "manutencao"}
        className={`estoque-tabs__btn ${view === "manutencao" ? "estoque-tabs__btn--active" : ""}`}
        onClick={() => onChange("manutencao")}
      >
        Manutenção ({manutencaoPendentes})
      </button>
    </div>
  );
}
