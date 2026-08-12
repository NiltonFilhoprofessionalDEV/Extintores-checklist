"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type RowActionsMenuProps = {
  label: string;
  onEdit: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
};

type MenuPosition = { top: number; left: number };

export default function RowActionsMenu({
  label,
  onEdit,
  onDelete,
  onSelect,
}: RowActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [position]);

  function toggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (position) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const itemCount = 1 + (onSelect ? 1 : 0) + (onDelete ? 1 : 0);
    const menuWidth = 168;
    const menuHeight = 8 + itemCount * 40;
    const top = rect.bottom + menuHeight > window.innerHeight
      ? Math.max(8, rect.top - menuHeight - 6)
      : rect.bottom + 6;
    const left = Math.min(
      window.innerWidth - menuWidth - 8,
      Math.max(8, rect.right - menuWidth),
    );
    setPosition({ top, left });
  }

  const menu = position ? (
    <div
      className="fixed z-[4500] w-[168px] overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-2xl"
      style={position}
      role="menu"
      aria-label={`Ações de ${label}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setPosition(null);
          onEdit();
        }}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-[var(--muted)]"
      >
        <span aria-hidden>✎</span>
        Editar
      </button>
      {onSelect ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setPosition(null);
            onSelect();
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-[var(--muted)]"
        >
          <span aria-hidden>☐</span>
          Selecionar
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setPosition(null);
            onDelete();
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-700 hover:bg-rose-50"
        >
          <span aria-hidden>⌫</span>
          Apagar
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        className={`grid h-9 w-9 place-items-center rounded-full border text-xl font-bold leading-none transition ${
          position
            ? "border-[var(--orange)] bg-[var(--orange-soft)] text-[var(--orange-deep)]"
            : "border-[var(--border)] bg-white text-slate-500 hover:bg-[var(--muted)] hover:text-[var(--ink)]"
        }`}
        aria-label={`Abrir ações de ${label}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
      >
        ⋮
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
