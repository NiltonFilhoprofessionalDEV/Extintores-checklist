"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MapLegendControlProps = {
  variant: "popover" | "sheet";
};

function LegendSwatch({ label, bg }: { label: string; bg: string }) {
  return (
    <span
      className="inline-flex h-5 min-w-[2.4rem] items-center justify-center rounded-md px-1 text-[10px] font-extrabold text-white"
      style={{ background: bg }}
    >
      {label}
    </span>
  );
}

function LegendBody() {
  return (
    <div className="space-y-3 text-xs leading-snug text-slate-600">
      <div>
        <p className="mb-1.5 font-semibold uppercase tracking-wide text-slate-800">Tipo de equipamento</p>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2">
            <LegendSwatch label="E-25" bg="#334155" />
            <span>
              <span className="font-semibold text-slate-800">E</span> = Extintor
            </span>
          </li>
          <li className="flex items-center gap-2">
            <LegendSwatch label="H-07" bg="#334155" />
            <span>
              <span className="font-semibold text-slate-800">H</span> = Hidrante
            </span>
          </li>
        </ul>
      </div>
      <div>
        <p className="mb-1.5 font-semibold uppercase tracking-wide text-slate-800">Status</p>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2">
            <LegendSwatch label="E-25" bg="#16a34a" />
            <span>
              <span className="font-semibold text-green-700">Verde:</span> conferido e conforme no mês.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <LegendSwatch label="E-25" bg="#ea580c" />
            <span>
              <span className="font-semibold text-orange-700">Laranja:</span> pendente de conferência.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <LegendSwatch label="E-25" bg="#dc2626" />
            <span>
              <span className="font-semibold text-red-700">Vermelho:</span> não conforme, vencido ou item em falta.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <LegendSwatch label="E-25" bg="#64748b" />
            <span>
              <span className="font-semibold text-slate-600">Cinza:</span> sem status, quando aplicável.
            </span>
          </li>
        </ul>
      </div>
      <p className="text-[11px] text-slate-500">
        A letra indica o tipo, o número identifica o equipamento e a cor mostra só o status.
      </p>
    </div>
  );
}

export default function MapLegendControl({ variant }: MapLegendControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    if (variant !== "popover") {
      return () => document.removeEventListener("keydown", onKey);
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, variant]);

  return (
    <div ref={rootRef} className="pointer-events-auto absolute left-2 top-2 z-[1100]">
      <button
        type="button"
        className="map-legend-btn"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        Legenda
      </button>

      {open && variant === "popover" ? (
        <div
          id={titleId}
          role="dialog"
          aria-label="Legenda do mapa"
          className="absolute left-0 top-full z-[1101] mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <LegendBody />
        </div>
      ) : null}

      {open && variant === "sheet"
        ? createPortal(
            <div
              className="modal-layer fixed inset-0 z-[1800] flex items-end"
              style={{ background: "rgba(15, 23, 42, 0.35)" }}
              onClick={() => setOpen(false)}
            >
              <div
                id={titleId}
                role="dialog"
                aria-label="Legenda do mapa"
                className="w-full rounded-t-[1.5rem] bg-white px-5 pb-6 pt-3 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex justify-center">
                  <div className="h-1 w-10 rounded-full bg-zinc-300" />
                </div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-zinc-900">Legenda</h2>
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <LegendBody />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
