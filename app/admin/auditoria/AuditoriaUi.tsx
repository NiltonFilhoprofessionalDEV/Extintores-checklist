"use client";

import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  roleLabelPt,
} from "@/lib/audit/write-audit-log";

export type AuditLogRow = {
  id: string;
  actor_nome: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_label: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export function formatQuando(iso: string): {
  data: string;
  hora: string;
  relativo: string;
  curto: string;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { data: iso, hora: "", relativo: "", curto: iso };
  }
  const data = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const curto = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const agora = Date.now();
  const diffMs = agora - d.getTime();
  const min = Math.floor(diffMs / 60000);
  let relativo = "";
  if (min < 1) relativo = "agora";
  else if (min < 60) relativo = `${min} min`;
  else if (min < 60 * 24) relativo = `${Math.floor(min / 60)} h`;
  else if (min < 60 * 48) relativo = "ontem";
  else relativo = `${Math.floor(min / (60 * 24))} d`;

  return { data, hora, relativo, curto };
}

export function acaoTom(action: string): { bg: string; text: string; border: string } {
  if (action === "soft_delete" || action === "user_delete" || action === "map_remove") {
    return { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };
  }
  if (action === "restore" || action === "create" || action === "user_create") {
    return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" };
  }
  if (action === "update" || action === "user_update" || action === "config") {
    return { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" };
  }
  return { bg: "#f1f5f9", text: "#334155", border: "#e2e8f0" };
}

export function detalhesLegiveis(details: Record<string, unknown> | null): string[] {
  if (!details || typeof details !== "object") return [];
  const linhas: string[] = [];
  const codigos = details.codigos;
  if (Array.isArray(codigos) && codigos.length > 0) {
    linhas.push(`Itens: ${codigos.map(String).join(", ")}`);
  }
  if (typeof details.count === "number") {
    linhas.push(`Quantidade: ${details.count}`);
  }
  if (typeof details.mode === "string") {
    const modeLabel =
      details.mode === "soft_delete"
        ? "Remoção da lista"
        : details.mode === "restore"
          ? "Recuperação"
          : String(details.mode);
    linhas.push(`Tipo de operação: ${modeLabel}`);
  }
  for (const [key, value] of Object.entries(details)) {
    if (key === "codigos" || key === "count" || key === "mode") continue;
    if (value == null) continue;
    if (typeof value === "object") {
      try {
        linhas.push(`${key}: ${JSON.stringify(value)}`);
      } catch {
        // ignore non-serializable
      }
      continue;
    }
    linhas.push(`${key}: ${String(value)}`);
  }
  return linhas;
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#fafafa] px-3 py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value || "Não informado"}</p>
    </div>
  );
}

export function AuditoriaRow({
  log,
  onOpen,
}: {
  log: AuditLogRow;
  onOpen: () => void;
}) {
  const quando = formatQuando(log.created_at);
  const tom = acaoTom(log.action);
  const acaoLabel = AUDIT_ACTION_LABELS[log.action] ?? log.action;
  const quem = log.actor_nome?.trim() || "Sistema";
  const titulo =
    log.entity_label?.trim() ||
    (log.summary.length > 72 ? `${log.summary.slice(0, 69).trimEnd()}…` : log.summary);

  return (
    <li className="px-3 py-2.5 sm:px-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: tom.bg,
                color: tom.text,
                borderColor: tom.border,
              }}
            >
              {acaoLabel}
            </span>
            <p className="truncate text-sm font-semibold text-slate-900">{titulo}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {quem}
            <span className="text-slate-300"> · </span>
            {quando.curto}
            {quando.hora ? ` ${quando.hora}` : ""}
            {quando.relativo ? (
              <>
                <span className="text-slate-300"> · </span>
                {quando.relativo}
              </>
            ) : null}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-white text-slate-500 transition hover:border-[var(--orange)] hover:bg-[var(--orange-soft)] hover:text-[var(--orange-deep)]"
          aria-label={`Ver detalhes: ${titulo}`}
          title="Ver detalhes"
        >
          <EyeIcon />
        </button>
      </div>
    </li>
  );
}

export function AuditoriaDetailModal({
  log,
  onClose,
}: {
  log: AuditLogRow;
  onClose: () => void;
}) {
  const quando = formatQuando(log.created_at);
  const tom = acaoTom(log.action);
  const acaoLabel = AUDIT_ACTION_LABELS[log.action] ?? log.action;
  const tipoLabel = AUDIT_ENTITY_LABELS[log.entity_type] ?? log.entity_type;
  const quem = log.actor_nome?.trim() || "Usuário do sistema";
  const cargo = roleLabelPt(log.actor_role);
  const extras = detalhesLegiveis(log.details);

  return (
    <div
      className="modal-layer fixed inset-0 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auditoria-detail-title"
      onClick={onClose}
    >
      <article
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6">
          <div>
            <span
              className="inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{
                background: tom.bg,
                color: tom.text,
                borderColor: tom.border,
              }}
            >
              {acaoLabel}
            </span>
            <h2 id="auditoria-detail-title" className="mt-2 text-xl font-extrabold text-[var(--ink)]">
              Detalhes do registro
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{tipoLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--muted)] text-xl text-slate-600"
            aria-label="Fechar detalhes"
          >
            ×
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-base font-semibold leading-snug text-slate-900">{log.summary}</p>

          <section className="mt-5">
            <p className="page-eyebrow">Quem e quando</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DetailField label="Responsável" value={quem} />
              <DetailField label="Cargo" value={cargo} />
              <DetailField label="Data" value={quando.data} />
              <DetailField label="Horário" value={quando.hora ? `às ${quando.hora}` : "—"} />
            </div>
          </section>

          <section className="mt-5">
            <p className="page-eyebrow">Item</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DetailField label="Tipo" value={tipoLabel} />
              <DetailField label="Identificação" value={log.entity_label ?? "—"} />
            </div>
          </section>

          {extras.length > 0 && (
            <section className="mt-5">
              <p className="page-eyebrow">Informações extras</p>
              <ul className="mt-3 space-y-1.5 rounded-2xl border border-[var(--border)] bg-[#fafafa] px-4 py-3 text-sm text-slate-700">
                {extras.map((linha) => (
                  <li key={linha}>{linha}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="border-t border-[var(--border)] p-4">
          <button type="button" className="btn-primary w-full" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </article>
    </div>
  );
}
