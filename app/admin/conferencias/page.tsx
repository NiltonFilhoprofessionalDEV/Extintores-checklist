"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type ConferenciaItem = {
  id: string;
  data_conferencia: string;
  conferente: string;
  observacoes: string | null;
  extintor?: {
    codigo?: string;
    setor?: string;
    local_detalhado?: string;
    tipo?: string;
    tamanho?: string;
  } | null;
};

export default function AdminConferenciasPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [rows, setRows] = useState<ConferenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroConferente, setFiltroConferente] = useState("");
  const [busca, setBusca] = useState("");

  const loadConferencias = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("checklists")
      .select(
        "id,data_conferencia,conferente,observacoes,extintores(codigo,setor,local_detalhado,tipo,tamanho)",
      )
      .order("data_conferencia", { ascending: false });

    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped = ((data ?? []) as Record<string, unknown>[]).map((item) => {
      const ext = item.extintores as Record<string, unknown> | null;
      return {
        id: String(item.id ?? ""),
        data_conferencia: String(item.data_conferencia ?? ""),
        conferente: String(item.conferente ?? ""),
        observacoes: (item.observacoes as string | null) ?? null,
        extintor: ext
          ? {
              codigo: (ext.codigo as string | undefined) ?? "",
              setor: (ext.setor as string | undefined) ?? "",
              local_detalhado: (ext.local_detalhado as string | undefined) ?? "",
              tipo: (ext.tipo as string | undefined) ?? "",
              tamanho: (ext.tamanho as string | undefined) ?? "",
            }
          : null,
      } satisfies ConferenciaItem;
    });

    setRows(mapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConferencias();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConferencias]);

  const conferentes = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.conferente).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((item) => {
      if (filtroConferente && item.conferente !== filtroConferente) return false;
      if (!q) return true;

      const text = [
        item.conferente,
        item.extintor?.codigo ?? "",
        item.extintor?.setor ?? "",
        item.extintor?.local_detalhado ?? "",
        item.extintor?.tipo ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [rows, busca, filtroConferente]);

  return (
    <section className="space-y-5">
      <div className="page-hero p-6">
        <div className="page-hero-content flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-red-200">Histórico</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Conferências realizadas</h2>
            <p className="mt-2 text-sm font-medium text-slate-300">
              Acompanhe quem realizou cada conferência e em qual extintor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadConferencias()}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-slate-100"
          >
            Atualizar
          </button>
        </div>
      </div>

      <div className="section-card grid gap-3 p-4 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Buscar por conferente, código ou setor..."
          className="field-control"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
        />
        <select
          className="field-control"
          value={filtroConferente}
          onChange={(event) => setFiltroConferente(event.target.value)}
        >
          <option value="">Todos os conferentes</option>
          {conferentes.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      <div className="section-card p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando conferências...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma conferência encontrada.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 transition hover:bg-white hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {item.extintor?.codigo || "Sem código"} - {item.extintor?.setor || "Sem setor"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.data_conferencia
                      ? new Date(item.data_conferencia).toLocaleString("pt-BR")
                      : "-"}
                  </p>
                </div>

                <p className="mt-1 text-sm text-slate-600">
                  {item.extintor?.local_detalhado || "Local não informado"}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                    Conferente: {item.conferente || "Não informado"}
                  </span>
                  {(item.extintor?.tipo || item.extintor?.tamanho) && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                      {[item.extintor?.tipo, item.extintor?.tamanho].filter(Boolean).join(" ")}
                    </span>
                  )}
                </div>

                {item.observacoes && (
                  <p className="mt-2 text-xs text-slate-600">
                    <span className="font-semibold">Observações:</span> {item.observacoes}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

