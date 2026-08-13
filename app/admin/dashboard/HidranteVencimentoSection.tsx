"use client";

import { useMemo, useState } from "react";
import { exportAlertasVencimentoHidrantes, type AlertaVencimentoRowHighlight } from "@/lib/export/excel";
import { exportAlertasHidrantesPdf } from "@/lib/export/pdf";
import {
  computeHidranteVencimentoBuckets,
  diasRestantesMangueiraCritica,
  formatVencimentoMangueira,
  listarMangueirasAtivas,
  type HidranteVencimentoRow,
} from "@/lib/hidrantes/vencimento-mangueiras";
import { DashboardStatCard, DashboardStatIcon } from "./dashboard-stat-card";
import ExportActions from "@/src/components/ExportActions";

type ManutencaoModalKey = "vencidos" | "alerta30" | "alerta60" | "alerta90" | "alerta120" | "semPosicao";

const ALERTA_EXPORT_HIGHLIGHT: Record<ManutencaoModalKey, AlertaVencimentoRowHighlight> = {
  vencidos: "vencido",
  alerta30: "alerta",
  alerta60: "alerta",
  alerta90: "alerta",
  alerta120: "alerta",
  semPosicao: "none",
};

const MODAL_META: Record<
  ManutencaoModalKey,
  { title: string; subtitle: string; color: string; exportLabel: string }
> = {
  vencidos: {
    title: "Mangueira com teste hidrostático vencido",
    subtitle: "Última realização + 1 ano já ultrapassada em ao menos uma mangueira",
    color: "#dc2626",
    exportLabel: "Mangueiras_vencidas",
  },
  alerta30: {
    title: "Hidrantes vencendo em 30 dias",
    subtitle: "Agendar teste hidrostático urgente",
    color: "#f59e0b",
    exportLabel: "Mangueiras_30_dias",
  },
  alerta60: {
    title: "Hidrantes vencendo em 60 dias",
    subtitle: "Planejar teste hidrostático preventivo",
    color: "#eab308",
    exportLabel: "Mangueiras_60_dias",
  },
  alerta90: {
    title: "Hidrantes vencendo em 90 dias",
    subtitle: "Antecipar agendamento de teste hidrostático",
    color: "#84cc16",
    exportLabel: "Mangueiras_90_dias",
  },
  alerta120: {
    title: "Hidrantes vencendo em 120 dias",
    subtitle: "Incluir no planejamento trimestral",
    color: "#22c55e",
    exportLabel: "Mangueiras_120_dias",
  },
  semPosicao: {
    title: "Hidrantes sem posição no mapa",
    subtitle: "Posicionar em Posicionar equipamentos",
    color: "#6b7280",
    exportLabel: "Hidrantes_sem_posicao",
  },
};

function formatLocalLinha(setor: string, detalhe: string): string {
  const s = setor?.trim() ?? "";
  const d = detalhe?.trim() ?? "";
  if (s && d) return `${s} — ${d}`;
  return d || s || "—";
}

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-400">—</span>;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{
        background: days < 0 ? "#fee2e2" : days <= 30 ? "#fef3c7" : "#fef9c3",
        color: days < 0 ? "#b91c1c" : days <= 30 ? "#92400e" : "#713f12",
      }}
    >
      {days < 0 ? `${Math.abs(days)}d vencido` : `${days}d`}
    </span>
  );
}

function HidranteManutencaoModal({
  modalKey,
  items,
  onClose,
}: {
  modalKey: ManutencaoModalKey;
  items: HidranteVencimentoRow[];
  onClose: () => void;
}) {
  const meta = MODAL_META[modalKey];
  const showVencimentoCols = modalKey !== "semPosicao";

  return (
    <div
      className="modal-layer fixed inset-0 flex items-center justify-center bg-[var(--forest)]/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90dvh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-[var(--forest)]/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-3 px-5 py-5 text-white"
          style={{ background: `linear-gradient(135deg, ${meta.color}, #0f172a)` }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">Detalhamento</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">{meta.title}</h2>
            <p className="text-sm text-white/75">{meta.subtitle}</p>
            <p className="mt-2 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white">
              {items.length} hidrante{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {items.length > 0 && (
              <ExportActions
                compact
                tone="dark"
                onExcel={() =>
                  exportAlertasVencimentoHidrantes(items, meta.exportLabel, ALERTA_EXPORT_HIGHLIGHT[modalKey])
                }
                onPdf={() => exportAlertasHidrantesPdf(items, meta.title)}
              />
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50/70">
          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhum hidrante nesta categoria.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 shadow-sm shadow-slate-200/60">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Código
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Pavimento / local
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Mangueiras
                  </th>
                  {showVencimentoCols ? (
                    <>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Venc. mais próximo
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Dias
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{h.codigo}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatLocalLinha(h.pavimento ?? "", h.local_detalhado)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{h.quantidade_mangueiras ?? "—"}</td>
                    {showVencimentoCols ? (
                      <>
                        <td className="px-4 py-3 text-slate-600">
                          {listarMangueirasAtivas(h)
                            .map((m) => `M-${m.numero}: ${formatVencimentoMangueira(m.ultimaRealizacao)}`)
                            .join(" · ")}
                        </td>
                        <td className="px-4 py-3">
                          <DaysBadge days={diasRestantesMangueiraCritica(h)} />
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function HidranteAlertTable({
  title,
  subtitle,
  color,
  items,
  exportLabel,
  exportHighlight,
}: {
  title: string;
  subtitle: string;
  color: string;
  items: HidranteVencimentoRow[];
  exportLabel: string;
  exportHighlight: AlertaVencimentoRowHighlight;
}) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-sm shadow-slate-200/70">
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: `4px solid ${color}` }}>
        <div>
          <h3 className="text-base font-black text-[var(--ink)]">{title}</h3>
          <p className="text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
        <ExportActions
          compact
          onExcel={() => exportAlertasVencimentoHidrantes(items, exportLabel, exportHighlight)}
          onPdf={() => exportAlertasHidrantesPdf(items, title)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/80">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Código
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pavimento / local
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Mangueiras
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Vencimentos (M-1 … M-n)
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Dias restantes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((h) => (
              <tr key={h.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{h.codigo}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatLocalLinha(h.pavimento ?? "", h.local_detalhado)}
                </td>
                <td className="px-4 py-3 text-slate-600">{h.quantidade_mangueiras ?? "—"}</td>
                <td className="max-w-md px-4 py-3 text-xs text-slate-600">
                  {listarMangueirasAtivas(h)
                    .map((m) => `M-${m.numero}: ${formatVencimentoMangueira(m.ultimaRealizacao)}`)
                    .join(" · ")}
                </td>
                <td className="px-4 py-3">
                  <DaysBadge days={diasRestantesMangueiraCritica(h)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-5 py-2.5">
        <p className="text-xs text-slate-400">
          {items.length} hidrante{items.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

export function HidranteVencimentoSection({ hidrantes }: { hidrantes: HidranteVencimentoRow[] }) {
  const [modalKey, setModalKey] = useState<ManutencaoModalKey | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { stats, vencidosList, alerta30List, alerta60List, alerta90List, alerta120List, semPosicaoList } = useMemo(
    () => computeHidranteVencimentoBuckets(hidrantes, today),
    [hidrantes, today],
  );

  const modalItems = useMemo(() => {
    if (!modalKey) return [];
    if (modalKey === "vencidos") return vencidosList;
    if (modalKey === "alerta30") return alerta30List;
    if (modalKey === "alerta60") return alerta60List;
    if (modalKey === "alerta90") return alerta90List;
    if (modalKey === "alerta120") return alerta120List;
    return semPosicaoList;
  }, [modalKey, vencidosList, alerta30List, alerta60List, alerta90List, alerta120List, semPosicaoList]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">Hidrantes</p>
          <h2 className="mt-1 text-2xl font-extrabold text-[var(--ink)]">Vencimento das mangueiras</h2>
        </div>
        <p className="text-xs font-medium text-slate-500">
          Teste hidrostático: validade de 1 ano a partir da última realização (M-1 a M-4).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DashboardStatCard
          label="Total de hidrantes"
          value={stats.total}
          color="#ea580c"
          icon={<DashboardStatIcon name="total" />}
        />
        <DashboardStatCard
          label="Teste hidrostático vencido"
          value={stats.vencidos}
          color="#dc2626"
          onClick={() => setModalKey("vencidos")}
          icon={<DashboardStatIcon name="vencido" />}
        />
        <DashboardStatCard
          label="Vencendo em 30 dias"
          value={stats.alerta30}
          color="#f59e0b"
          onClick={() => setModalKey("alerta30")}
          icon={<DashboardStatIcon name="alerta30" />}
        />
        <DashboardStatCard
          label="Vencendo em 60 dias"
          value={stats.alerta60}
          color="#eab308"
          onClick={() => setModalKey("alerta60")}
          icon={<DashboardStatIcon name="alerta60" />}
        />
        <DashboardStatCard
          label="Vencendo em 90 dias"
          value={stats.alerta90}
          color="#84cc16"
          onClick={() => setModalKey("alerta90")}
          icon={<DashboardStatIcon name="alerta90" />}
        />
        <DashboardStatCard
          label="Vencendo em 120 dias"
          value={stats.alerta120}
          color="#22c55e"
          onClick={() => setModalKey("alerta120")}
          icon={<DashboardStatIcon name="alerta120" />}
        />
        <DashboardStatCard
          label="Sem posição no mapa"
          value={stats.semPosicao}
          color="#6b7280"
          onClick={() => setModalKey("semPosicao")}
          icon={<DashboardStatIcon name="semMapa" />}
        />
      </div>

      {modalKey && (
        <HidranteManutencaoModal modalKey={modalKey} items={modalItems} onClose={() => setModalKey(null)} />
      )}

      <div className="page-heading">
        <div>
          <p className="page-eyebrow">Planejamento</p>
          <h2 className="mt-1 text-2xl font-extrabold text-[var(--ink)]">Testes hidrostáticos programados</h2>
        </div>
        <p className="text-xs font-medium text-slate-500">Hidrantes organizados por vencimento das mangueiras.</p>
      </div>

      {stats.total > 0 && (
        <div className="professional-card overflow-hidden p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-[var(--ink)]">Distribuição de vencimento</p>
              <p className="text-xs font-medium text-slate-500">Percentual dos hidrantes por faixa de vencimento.</p>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-800">
              {stats.total} hidrante{stats.total !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
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
            {stats.alerta90 > 0 && (
              <div
                title={`Alerta 90d: ${stats.alerta90}`}
                className="h-full bg-lime-400"
                style={{ width: `${(stats.alerta90 / stats.total) * 100}%` }}
              />
            )}
            {stats.alerta120 > 0 && (
              <div
                title={`Alerta 120d: ${stats.alerta120}`}
                className="h-full bg-green-300"
                style={{ width: `${(stats.alerta120 / stats.total) * 100}%` }}
              />
            )}
            <div className="h-full flex-1 bg-green-400" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              Teste hidrostático vencido
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
              Alerta 30d
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-300" />
              Alerta 60d
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-lime-400" />
              Alerta 90d
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-300" />
              Alerta 120d
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />
              Em dia
            </span>
          </div>
        </div>
      )}

      <HidranteAlertTable
        title="Mangueira com teste hidrostático vencido"
        subtitle="Última realização + 1 ano já ultrapassada"
        color="#dc2626"
        items={vencidosList}
        exportLabel="Mangueiras_vencidas"
        exportHighlight="vencido"
      />
      <HidranteAlertTable
        title="Hidrantes vencendo nos próximos 30 dias"
        subtitle="Agendar teste hidrostático urgente"
        color="#f59e0b"
        items={alerta30List}
        exportLabel="Mangueiras_30_dias"
        exportHighlight="alerta"
      />
      <HidranteAlertTable
        title="Hidrantes vencendo nos próximos 60 dias"
        subtitle="Planejar teste hidrostático preventivo"
        color="#eab308"
        items={alerta60List}
        exportLabel="Mangueiras_60_dias"
        exportHighlight="alerta"
      />
      <HidranteAlertTable
        title="Hidrantes vencendo nos próximos 90 dias"
        subtitle="Antecipar agendamento de teste hidrostático"
        color="#84cc16"
        items={alerta90List}
        exportLabel="Mangueiras_90_dias"
        exportHighlight="alerta"
      />
      <HidranteAlertTable
        title="Hidrantes vencendo nos próximos 120 dias"
        subtitle="Incluir no planejamento trimestral"
        color="#22c55e"
        items={alerta120List}
        exportLabel="Mangueiras_120_dias"
        exportHighlight="alerta"
      />

      {stats.vencidos === 0 &&
        stats.alerta30 === 0 &&
        stats.alerta60 === 0 &&
        stats.alerta90 === 0 &&
        stats.alerta120 === 0 &&
        stats.total > 0 && (
        <div className="flex items-center gap-4 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-4 shadow-sm shadow-emerald-100">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-black text-emerald-900">Mangueiras em dia!</p>
            <p className="text-xs font-medium text-emerald-700">
              Nenhum hidrante com teste hidrostático vencido ou próximo do vencimento.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
