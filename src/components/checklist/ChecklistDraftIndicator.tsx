type ChecklistDraftIndicatorProps = {
  visible: boolean;
};

export default function ChecklistDraftIndicator({ visible }: ChecklistDraftIndicatorProps) {
  if (!visible) return null;
  return (
    <p className="text-[11px] font-semibold text-[var(--fc-success)]" aria-live="polite">
      Rascunho salvo ✓
    </p>
  );
}
