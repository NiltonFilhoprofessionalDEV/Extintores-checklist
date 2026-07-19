"use client";

import { useOptionalActiveBase } from "@/lib/auth/active-base-context";

export default function BaseSwitcher({
  compact = false,
  tone = "dark",
}: {
  compact?: boolean;
  tone?: "dark" | "light";
}) {
  const ctx = useOptionalActiveBase();
  if (!ctx || !ctx.ready) return null;
  if (ctx.accessibleBases.length <= 1) return null;

  return (
    <label className={compact ? "block" : "block w-full"}>
      {!compact && (
        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Base ativa
        </span>
      )}
      <select
        value={ctx.activeBaseId ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          if (next) ctx.setActiveBaseId(next);
        }}
        className={`w-full rounded-xl px-3 py-2 text-sm font-semibold outline-none transition ${
          tone === "light"
            ? "border border-[var(--border)] bg-[var(--muted)] text-[var(--ink)] hover:border-slate-300 focus:border-[var(--orange)]"
            : "border border-white/15 bg-white/10 text-white hover:border-white/25 focus:border-[var(--orange)]"
        }`}
        aria-label="Selecionar base"
      >
        {ctx.accessibleBases.map((base) => (
          <option key={base.id} value={base.id} className="bg-white text-[var(--ink)]">
            {base.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
