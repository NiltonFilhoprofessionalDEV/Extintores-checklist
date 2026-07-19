"use client";

import { useOptionalActiveBase } from "@/lib/auth/active-base-context";

export default function BaseSwitcher({ compact = false }: { compact?: boolean }) {
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
        className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white outline-none transition hover:border-white/25 focus:border-[#e02020]/60"
        aria-label="Selecionar base"
      >
        {ctx.accessibleBases.map((base) => (
          <option key={base.id} value={base.id} className="bg-slate-900 text-white">
            {base.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
