"use client";

import { useEffect } from "react";

type EstoqueMobileActionsSheetProps = {
  label: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
};

export default function EstoqueMobileActionsSheet({
  label,
  onClose,
  onEdit,
  onDelete,
}: EstoqueMobileActionsSheetProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div className="estoque-actions-sheet-layer" onClick={onClose} role="presentation">
      <div
        className="estoque-actions-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Ações de ${label}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="estoque-actions-sheet__handle" aria-hidden />
        <p className="estoque-actions-sheet__title">{label}</p>
        <button type="button" className="estoque-actions-sheet__btn" onClick={onEdit}>
          <span aria-hidden>✎</span>
          Editar
        </button>
        {onDelete ? (
          <button type="button" className="estoque-actions-sheet__btn estoque-actions-sheet__btn--danger" onClick={onDelete}>
            <span aria-hidden>⌫</span>
            Remover do estoque
          </button>
        ) : null}
        <button type="button" className="estoque-actions-sheet__btn mt-1" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
