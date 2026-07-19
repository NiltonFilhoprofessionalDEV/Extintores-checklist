"use client";

import { useState } from "react";

type ExportActionsProps = {
  onExcel: () => void;
  onPdf: () => void | Promise<unknown>;
  disabled?: boolean;
  excelLabel?: string;
  pdfLabel?: string;
  tone?: "light" | "dark";
  compact?: boolean;
};

function DownloadIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0-4-4m4 4 4-4M5 19h14" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h8l4 4v16H6zM14 2v5h5M9 13h6m-6 4h4" />
    </svg>
  );
}

export default function ExportActions({
  onExcel,
  onPdf,
  disabled = false,
  excelLabel = "Excel",
  pdfLabel = "PDF",
  tone = "light",
  compact = false,
}: ExportActionsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const base = `inline-flex items-center justify-center gap-2 font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
    compact ? "rounded-xl px-3 py-2 text-xs" : "rounded-2xl px-4 py-3 text-sm"
  }`;
  const excelTone =
    tone === "dark"
      ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
      : "border border-[var(--border)] bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50";
  const pdfTone =
    tone === "dark"
      ? "bg-white text-[var(--ink)] hover:bg-slate-100"
      : "border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100";

  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      await onPdf();
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label="Opções de exportação">
      <button type="button" onClick={onExcel} disabled={disabled} className={`${base} ${excelTone}`}>
        <DownloadIcon />
        {excelLabel}
      </button>
      <button
        type="button"
        onClick={() => void handlePdfExport()}
        disabled={disabled || pdfLoading}
        className={`${base} ${pdfTone}`}
        title="Baixar relatório em PDF"
      >
        <PdfIcon />
        {pdfLoading ? "Gerando…" : pdfLabel}
      </button>
    </div>
  );
}
