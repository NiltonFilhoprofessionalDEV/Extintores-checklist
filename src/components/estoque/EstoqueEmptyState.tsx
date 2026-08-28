type EstoqueEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EstoqueEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EstoqueEmptyStateProps) {
  return (
    <div className="estoque-empty">
      <p className="estoque-empty__title">{title}</p>
      <p className="estoque-empty__desc">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn-primary estoque-empty__action min-h-[44px]" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
