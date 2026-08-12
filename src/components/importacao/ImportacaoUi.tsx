"use client";

export function SegmentedOption<T extends string>({
  value,
  current,
  label,
  onSelect,
}: {
  value: T;
  current: T;
  label: string;
  onSelect: (value: T) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-[var(--ink)] text-white shadow-sm"
          : "bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-900"
      }`}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  );
}

export function PreviewPagination({
  page,
  totalPages,
  totalRows,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalRows === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRows);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-medium text-slate-500">
        Exibindo {from}–{to} de {totalRows}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          aria-label="Primeira página"
        >
          «
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          Página
          <input
            type="number"
            min={1}
            max={totalPages}
            value={page}
            className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-bold text-slate-800 outline-none focus:border-[var(--neon)]"
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              onPageChange(Math.min(totalPages, Math.max(1, Math.trunc(next))));
            }}
          />
          de {totalPages}
        </label>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Última página"
        >
          Última »
        </button>
      </div>
    </div>
  );
}
