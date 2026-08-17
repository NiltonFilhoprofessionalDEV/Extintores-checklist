type ChecklistDraftIndicatorProps = {
  visible: boolean;
};

export default function ChecklistDraftIndicator({ visible }: ChecklistDraftIndicatorProps) {
  if (!visible) return null;
  return (
    <p className="checklist-draft-indicator" aria-live="polite">
      Rascunho salvo
    </p>
  );
}
