"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type FormDrawerProps = {
  title: string;
  eyebrow: string;
  description: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
};

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export default function FormDrawer({
  title,
  eyebrow,
  description,
  onClose,
  footer,
  children,
}: FormDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const panel = panelRef.current;
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    const firstField = focusables.find((el) => el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA");
    (firstField ?? focusables[0])?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled"),
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="inv-drawer-layer" onClick={onClose} role="presentation">
      <aside
        ref={panelRef}
        className="inv-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="inv-drawer__header">
          <div className="inv-drawer__heading">
            <p className="inv-drawer__eyebrow">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId} className="inv-drawer__sub">
              {description}
            </p>
          </div>
          <button type="button" className="inv-drawer__close" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="inv-drawer__body">{children}</div>
        <footer className="inv-drawer__footer">{footer}</footer>
      </aside>
    </div>
  );
}
