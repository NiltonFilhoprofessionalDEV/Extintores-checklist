"use client";

import { useOptionalActiveBase } from "@/lib/auth/active-base-context";

function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V4h12v17M8 8h4m-4 4h4m-4 4h4m4-8h4v13M2 21h20" />
    </svg>
  );
}

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

  const activeName = ctx.accessibleBases.find((base) => base.id === ctx.activeBaseId)?.nome ?? "Base";
  const isDark = tone === "dark";

  const select = (
    <select
      value={ctx.activeBaseId ?? ""}
      onChange={(event) => {
        const next = event.target.value;
        if (next) ctx.setActiveBaseId(next);
      }}
      aria-label="Selecionar base"
      title={activeName}
      className={compact ? "base-switcher__native" : `base-switcher__select${isDark ? " is-dark" : ""}`}
    >
      {ctx.accessibleBases.map((base) => (
        <option key={base.id} value={base.id} className="bg-white text-[var(--ink)]">
          {base.nome}
        </option>
      ))}
    </select>
  );

  if (compact) {
    return (
      <label className={`base-switcher base-switcher--compact${isDark ? " is-dark" : ""}`} title={activeName}>
        <span className="base-switcher__icon">
          <BuildingIcon />
        </span>
        {select}
      </label>
    );
  }

  return (
    <label className={`base-switcher${isDark ? " is-dark" : ""}`}>
      <span className="base-switcher__label">Base ativa</span>
      <span className="base-switcher__row">
        <span className="base-switcher__icon">
          <BuildingIcon />
        </span>
        {select}
      </span>
    </label>
  );
}
