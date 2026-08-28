"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ManutencaoLoteActionItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

type MenuPosition = { top: number; left: number };

type ManutencaoLoteItemActionsMenuProps = {
  label: string;
  items: ManutencaoLoteActionItem[];
};

export default function ManutencaoLoteItemActionsMenu({
  label,
  items,
}: ManutencaoLoteItemActionsMenuProps) {
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

  if (items.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  function toggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (position) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 196;
    const menuHeight = 8 + items.length * 40;
    const top =
      rect.bottom + menuHeight > window.innerHeight
        ? Math.max(8, rect.top - menuHeight - 6)
        : rect.bottom + 6;
    const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth));
    setPosition({ top, left });
  }

  const menu = position ? (
    <div
      className="fixed z-[4500] w-[196px] overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-2xl"
      style={position}
      role="menu"
      aria-label={`Ações de ${label}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            setPosition(null);
            item.onClick();
          }}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
            item.tone === "danger"
              ? "text-rose-700 hover:bg-rose-50"
              : "text-slate-700 hover:bg-[var(--muted)]"
          }`}
        >
          {item.icon ? <span className="grid h-4 w-4 shrink-0 place-items-center">{item.icon}</span> : null}
          {item.label}
        </button>
      ))}
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
