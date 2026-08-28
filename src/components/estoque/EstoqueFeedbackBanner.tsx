"use client";

import { useEffect } from "react";

type EstoqueFeedbackBannerProps = {
  type: "ok" | "err";
  message: string;
  onDismiss: () => void;
};

export default function EstoqueFeedbackBanner({ type, message, onDismiss }: EstoqueFeedbackBannerProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      className={`estoque-feedback estoque-feedback--${type}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden>{type === "ok" ? "✓" : "!"}</span>
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold opacity-70 hover:opacity-100"
        onClick={onDismiss}
        aria-label="Fechar mensagem"
      >
        ✕
      </button>
    </div>
  );
}
