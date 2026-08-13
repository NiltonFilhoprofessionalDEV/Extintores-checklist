"use client";

import { useState } from "react";

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
        className="text-xs font-bold text-[var(--fc-primary-deep)] underline-offset-2 hover:underline"
      >
        Marcar todos como Conforme
      </button>
    );
  }

  return (
    <div className="rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--muted)] p-3">
      <p className="text-sm font-bold text-[var(--fc-text-primary)]">Marcar todos os itens como Conforme?</p>
      <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
        Você poderá alterar individualmente qualquer resposta antes de finalizar.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !py-2 !text-xs">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            setOpen(false);
          }}
          className="btn-primary !py-2 !text-xs"
        >
          Marcar todos
        </button>
      </div>
    </div>
  );
}
