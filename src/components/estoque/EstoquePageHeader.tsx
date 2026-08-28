type EstoquePageHeaderProps = {
  showAddButton: boolean;
  onAdd: () => void;
};

export default function EstoquePageHeader({ showAddButton, onAdd }: EstoquePageHeaderProps) {
  return (
    <header className="professional-card estoque-header">
      <div className="min-w-0 flex-1">
        <h1 className="estoque-header__title">Estoque e Manutenção</h1>
        <p className="estoque-header__subtitle">
          Equipamentos disponíveis para substituição e ordens de serviço de manutenção
        </p>
      </div>
      {showAddButton && (
        <div className="estoque-header__actions">
          <button type="button" onClick={onAdd} className="btn-primary w-full min-h-[44px] sm:w-auto">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar ao estoque
          </button>
        </div>
      )}
    </header>
  );
}
