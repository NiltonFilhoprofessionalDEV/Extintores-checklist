"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  AuditoriaDetailModal,
  AuditoriaRow,
  type AuditLogRow,
} from "./AuditoriaUi";

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

export default function AdminAuditoriaPage() {
  const { activeBaseId, activeBase } = useActiveBase();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

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
          Registros compactos do que aconteceu nesta base
          {activeBase?.nome ? ` (${activeBase.nome})` : ""}. Use o olho para ver os detalhes.
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
              Quando alguém cadastrar, alterar ou remover itens, a ação aparece aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => (
              <AuditoriaRow key={log.id} log={log} onOpen={() => setSelectedLog(log)} />
            ))}
          </ul>
        )}
      </div>

      {selectedLog && (
        <AuditoriaDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
