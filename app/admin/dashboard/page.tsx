"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  exportExtintoresBasico,
  exportAlertasVencimento,
  type ExtintorRow,
} from "@/lib/export/excel";

type Stats = {
  total: number;
  vencidos: number;
  alerta30: number;
  alerta60: number;
  semPosicao: number;
};

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Returns the earlier of the two maintenance dates (non-null) */
function earliestDate(e: ExtintorRow): string | null {
  const dates = [e.manutencao_2_nivel, e.manutencao_3_nivel].filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900">{value}</p>
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function AlertTable({
  title,
  subtitle,
  color,
  items,
  exportLabel,
}: {
  title: string;
  subtitle: string;
  color: string;
  items: ExtintorRow[];
  exportLabel: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderLeft: `4px solid ${color}` }}>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => exportAlertasVencimento(items, exportLabel)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Código</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Setor / Local</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Vencto. Nível 2</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Vencto. Nível 3</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Dias restantes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((e) => {
              const earliest = earliestDate(e);
              const days = earliest ? diffDays(earliest) : null;
              return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{e.codigo}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <p>{e.setor}</p>
                    <p className="text-xs text-gray-400">{e.local_detalhado}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.tipo} {e.tamanho}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {e.manutencao_2_nivel
                      ? new Date(e.manutencao_2_nivel).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {e.manutencao_3_nivel
                      ? new Date(e.manutencao_3_nivel).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {days !== null ? (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={{
                          background: days < 0 ? "#fee2e2" : days <= 30 ? "#fef3c7" : "#fef9c3",
                          color: days < 0 ? "#b91c1c" : days <= 30 ? "#92400e" : "#713f12",
                        }}
                      >
                        {days < 0 ? `${Math.abs(days)}d vencido` : `${days}d`}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-100 px-5 py-2.5">
        <p className="text-xs text-gray-400">{items.length} extintor{items.length !== 1 ? "es" : ""}</p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => getSupabaseClient(), []);

  const loadExtintores = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("extintores")
      .select("id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,pavimento,created_at")
      .order("codigo", { ascending: true });
    setExtintores((data ?? []) as ExtintorRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadExtintores();
  }, [loadExtintores]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = useMemo<Stats>(() => {
    const in30 = addDays(today, 30);
    const in60 = addDays(today, 60);
    let vencidos = 0, alerta30 = 0, alerta60 = 0, semPosicao = 0;

    for (const e of extintores) {
      if (e.coord_x == null) semPosicao++;
      const d = earliestDate(e);
      if (!d) continue;
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      if (dt < today) vencidos++;
      else if (dt <= in30) alerta30++;
      else if (dt <= in60) alerta60++;
    }
    return { total: extintores.length, vencidos, alerta30, alerta60, semPosicao };
  }, [extintores, today]);

  const vencidosList = useMemo(
    () => extintores.filter((e) => { const d = earliestDate(e); return d ? new Date(d) < today : false; }),
    [extintores, today],
  );

  const alerta30List = useMemo(() => {
    const in30 = addDays(today, 30);
    return extintores.filter((e) => {
      const d = earliestDate(e);
      if (!d) return false;
      const dt = new Date(d);
      return dt >= today && dt <= in30;
    });
  }, [extintores, today]);

  const alerta60List = useMemo(() => {
    const in30 = addDays(today, 30);
    const in60 = addDays(today, 60);
    return extintores.filter((e) => {
      const d = earliestDate(e);
      if (!d) return false;
      const dt = new Date(d);
      return dt > in30 && dt <= in60;
    });
  }, [extintores, today]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E02020] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Visão geral do sistema de extintores</p>
        </div>
        <button
          type="button"
          onClick={() => exportExtintoresBasico(extintores)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm"
          style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar todos os extintores
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard
          label="Total de extintores"
          value={stats.total}
          color="#3b82f6"
          icon={
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <StatCard
          label="Já vencidos"
          value={stats.vencidos}
          color="#dc2626"
          icon={
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          label="Vencendo em 30 dias"
          value={stats.alerta30}
          color="#f59e0b"
          icon={
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Vencendo em 60 dias"
          value={stats.alerta60}
          color="#eab308"
          icon={
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Sem posição no mapa"
          value={stats.semPosicao}
          color="#6b7280"
          icon={
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>

      {/* Summary bar */}
      {stats.total > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Distribuição de status
          </p>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
            {stats.vencidos > 0 && (
              <div
                title={`Vencidos: ${stats.vencidos}`}
                className="h-full bg-red-500"
                style={{ width: `${(stats.vencidos / stats.total) * 100}%` }}
              />
            )}
            {stats.alerta30 > 0 && (
              <div
                title={`Alerta 30d: ${stats.alerta30}`}
                className="h-full bg-amber-400"
                style={{ width: `${(stats.alerta30 / stats.total) * 100}%` }}
              />
            )}
            {stats.alerta60 > 0 && (
              <div
                title={`Alerta 60d: ${stats.alerta60}`}
                className="h-full bg-yellow-300"
                style={{ width: `${(stats.alerta60 / stats.total) * 100}%` }}
              />
            )}
            <div className="h-full flex-1 bg-green-400" />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Vencidos</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Alerta 30d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-300" />Alerta 60d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />Em dia</span>
          </div>
        </div>
      )}

      {/* Alert tables */}
      <AlertTable
        title="Extintores com manutenção VENCIDA"
        subtitle="Ação imediata necessária"
        color="#dc2626"
        items={vencidosList}
        exportLabel="Vencidos"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 30 dias"
        subtitle="Agendar manutenção urgente"
        color="#f59e0b"
        items={alerta30List}
        exportLabel="Vencendo_30_dias"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 60 dias"
        subtitle="Planejar manutenção preventiva"
        color="#eab308"
        items={alerta60List}
        exportLabel="Vencendo_60_dias"
      />

      {/* All good banner */}
      {stats.vencidos === 0 && stats.alerta30 === 0 && stats.alerta60 === 0 && stats.total > 0 && (
        <div className="flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-green-800">Tudo em dia!</p>
            <p className="text-xs text-green-600">Nenhum extintor com manutenção vencida ou próxima do vencimento.</p>
          </div>
        </div>
      )}
    </div>
  );
}
