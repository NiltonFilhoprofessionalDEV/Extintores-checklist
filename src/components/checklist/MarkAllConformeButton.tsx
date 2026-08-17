"use client";

import { useState } from "react";
import { ChecklistCheckIcon } from "./ChecklistUiIcons";

type MarkAllConformeButtonProps = {
  onConfirm: () => void;
  disabled?: boolean;
};

export default function MarkAllConformeButton({ onConfirm, disabled = false }: MarkAllConformeButtonProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="checklist-mark-all"
      >
        <ChecklistCheckIcon size={16} />
        Marcar todos como conforme
      </button>
    );
  }

  return (
    <div className="checklist-mark-all-confirm">
      <p className="checklist-mark-all-confirm__title">Marcar todos os itens como Conforme?</p>
      <p className="checklist-mark-all-confirm__hint">
        Você poderá alterar individualmente qualquer resposta antes de finalizar.
      </p>
      <div className="checklist-mark-all-confirm__actions">
        <button type="button" onClick={() => setOpen(false)} className="checklist-mark-all-confirm__cancel">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            setOpen(false);
          }}
          className="checklist-mark-all-confirm__ok"
        >
          Marcar todos
        </button>
      </div>
    </div>
  );
}
