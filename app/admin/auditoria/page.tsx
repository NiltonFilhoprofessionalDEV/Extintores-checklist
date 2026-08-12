"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  roleLabelPt,
} from "@/lib/audit/write-audit-log";

type AuditLogRow = {
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

const FILTROS_ACAO: { value: string; label: string }[] = [
  { value: "", label: "Todas as ações" },
  { value: "create", label: "Cadastros" },
  { value: "update", label: "Alterações" },
  { value: "soft_delete", label: "Remoções da lista" },
  { value: "restore", label: "Recuperações" },
  { value: "map_place", label: "Posições no mapa" },
  { value: "map_remove", label: "Remoções do mapa" },
  { value: "checklist", label: "Inspeções" },
  { value: "import", label: "Importações" },
  { value: "user_create", label: "Criação de usuários" },
  { value: "user_update", label: "Alteração de usuários" },
  { value: "user_delete", label: "Exclusão de usuários" },
  { value: "config", label: "Configurações" },
];

function formatQuando(iso: string): { data: string; hora: string; relativo: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { data: iso, hora: "", relativo: "" };
  }
  const data = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const agora = Date.now();
  const diffMs = agora - d.getTime();
  const min = Math.floor(diffMs / 60000);
  let relativo = "";
  if (min < 1) relativo = "agora mesmo";
  else if (min < 60) relativo = `há ${min} min`;
  else if (min < 60 * 24) relativo = `há ${Math.floor(min / 60)} h`;
  else if (min < 60 * 48) relativo = "ontem";
  else relativo = `há ${Math.floor(min / (60 * 24))} dias`;

  return { data, hora, relativo };
}

function acaoTom(action: string): { bg: string; text: string; border: string } {
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

function detalhesLegiveis(details: Record<string, unknown> | null): string[] {
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
  return linhas.slice(0, 4);
}

export default function AdminAuditoriaPage() {
  const { activeBaseId, activeBase } = useActiveBase();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");
      if (!activeBaseId) throw new Error("Selecione uma base ativa.");

      const params = new URLSearchParams({ limit: "200" });
      if (busca.trim()) params.set("q", busca.trim());
      if (filtroAcao) params.set("action", filtroAcao);

      const response = await fetch(`/api/admin/auditoria?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "X-Active-Base-Id": activeBaseId,
        },
      });
      const payload = (await response.json()) as { logs?: AuditLogRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar a auditoria.");
      setLogs(payload.logs ?? []);
    } catch (err) {
      setLogs([]);
      setError(err instanceof Error ? err.message : "Erro ao carregar auditoria.");
    } finally {
      setLoading(false);
    }
  }, [activeBaseId, busca, filtroAcao, supabase]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function aplicarBusca() {
    setBusca(buscaInput.trim());
  }

  return (
    <div className="space-y-5">
      <div className="professional-card reveal-up p-5 sm:p-6">
        <p className="page-eyebrow">Controle</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink)]">Auditoria</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-[var(--muted-foreground)]">
          Aqui você vê, em português claro, o que cada pessoa fez nesta base
          {activeBase?.nome ? ` (${activeBase.nome})` : ""}. Quem fez, o que fez e quando.
        </p>
      </div>

      <div className="professional-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="field-control w-full pl-9"
            placeholder="Buscar por nome, item ou frase (ex.: EXT-001)"
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") aplicarBusca();
            }}
          />
        </div>
        <select
          className="field-control sm:w-56"
          value={filtroAcao}
          onChange={(e) => setFiltroAcao(e.target.value)}
        >
          {FILTROS_ACAO.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={() => {
            aplicarBusca();
            if (buscaInput.trim() === busca) void carregar();
          }}
        >
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="professional-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-4 py-16 text-sm text-slate-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--forest)]" />
            Carregando histórico…
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-base font-semibold text-slate-800">Nenhum registro encontrado</p>
            <p className="mt-1 text-sm text-slate-500">
              Quando alguém cadastrar, alterar ou remover itens, a ação aparece aqui em linguagem simples.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => {
              const quando = formatQuando(log.created_at);
              const tom = acaoTom(log.action);
              const acaoLabel = AUDIT_ACTION_LABELS[log.action] ?? log.action;
              const tipoLabel = AUDIT_ENTITY_LABELS[log.entity_type] ?? log.entity_type;
              const quem = log.actor_nome?.trim() || "Usuário do sistema";
              const cargo = roleLabelPt(log.actor_role);
              const extras = detalhesLegiveis(log.details);

              return (
                <li key={log.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
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
                        <span className="text-xs font-medium text-slate-500">{tipoLabel}</span>
                      </div>

                      <p className="text-base font-semibold leading-snug text-slate-900">
                        {log.summary}
                      </p>

                      <p className="text-sm text-slate-600">
                        Feito por <span className="font-semibold text-slate-800">{quem}</span>
                        <span className="text-slate-400"> · </span>
                        {cargo}
                        {log.entity_label ? (
                          <>
                            <span className="text-slate-400"> · </span>
                            Item: <span className="font-medium text-slate-800">{log.entity_label}</span>
                          </>
                        ) : null}
                      </p>

                      {extras.length > 0 && (
                        <ul className="space-y-0.5 text-xs text-slate-500">
                          {extras.map((linha) => (
                            <li key={linha}>{linha}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-sm font-semibold capitalize text-slate-800">{quando.data}</p>
                      <p className="text-sm text-slate-600">às {quando.hora}</p>
                      {quando.relativo && (
                        <p className="mt-0.5 text-xs font-medium text-slate-400">{quando.relativo}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
