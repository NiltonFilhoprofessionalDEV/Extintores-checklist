"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  fetchChecklistsExtintoresDoMes,
  fetchChecklistsHidrantesDoMes,
  type ChecklistExtintorMesRow,
  type ChecklistHidranteMesRow,
} from "@/lib/supabase/checklists-do-mes";
import { getCurrentSession } from "@/lib/auth/profile";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { baseHasEmpresaTabs } from "@/lib/auth/bases";
import { exportAlertasVencimento, type AlertaVencimentoRowHighlight, type ExtintorRow } from "@/lib/export/excel";
import { exportAlertasExtintoresPdf } from "@/lib/export/pdf";
import { extintorTemManutencaoVencida } from "@/lib/export/conferencia-historico";
import { checklistTemNaoConformidade } from "@/lib/checklist/types";
import { hidranteChecklistTemNaoConformidade } from "@/lib/checklist/hidrante-types";
import { getLocalCalendarMonthUtcIsoRange } from "@/lib/date/local-month-range";
import { formatDateOnlyPt } from "@/lib/date/date-only";
import { hidranteTemMangueiraVencida, type HidranteVencimentoRow } from "@/lib/hidrantes/vencimento-mangueiras";
import { EMPRESA_TABS, filtrarPorEmpresa, type EmpresaTab } from "@/lib/dashboard/empresa-filter";
import {
  dataNivel2NaFaixa,
  diasRestantesNivel2,
  faixaDateRangeLabel,
  nivel3VenceNoMesmoAnoQueNivel2,
  startOfTodayLocal,
  type ManutencaoAlertaKey,
} from "@/lib/dashboard/manutencao-nivel2";
import { DashboardStatCard, DashboardStatIcon } from "./dashboard-stat-card";
import { HidranteVencimentoSection } from "./HidranteVencimentoSection";
import ExportActions from "@/src/components/ExportActions";
import { COLUNAS_EXTINTOR, COLUNA_TITULO_CLASS } from "@/lib/inventario/equipamento-padrao";

type Stats = {
  total: number;
  vencidos: number;
  alerta30: number;
  alerta60: number;
  alerta90: number;
  alerta120: number;
  alerta180: number;
  alerta360: number;
  semPosicao: number;
};

function buildUltimoPorExtintor(rows: ChecklistExtintorMesRow[]): Map<string, ChecklistExtintorMesRow> {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.data_conferencia).getTime() - new Date(a.data_conferencia).getTime(),
  );
  const map = new Map<string, ChecklistExtintorMesRow>();
  for (const row of sorted) {
    if (!map.has(row.extintor_id)) map.set(row.extintor_id, row);
  }
  return map;
}

function buildUltimoPorHidrante(rows: ChecklistHidranteMesRow[]): Map<string, ChecklistHidranteMesRow> {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.data_conferencia).getTime() - new Date(a.data_conferencia).getTime(),
  );
  const map = new Map<string, ChecklistHidranteMesRow>();
  for (const row of sorted) {
    if (!map.has(row.hidrante_id)) map.set(row.hidrante_id, row);
  }
  return map;
}

function formatLocalLinha(setor: string, detalhe: string): string {
  const s = setor?.trim() ?? "";
  const d = detalhe?.trim() ?? "";
  if (s && d) return `${s} — ${d}`;
  return d || s || "—";
}

function formatDatePt(d: string | null): string {
  return formatDateOnlyPt(d);
}

type ManutencaoModalKey = ManutencaoAlertaKey | "semPosicao";

const ALERTA_EXPORT_HIGHLIGHT: Record<ManutencaoModalKey, AlertaVencimentoRowHighlight> = {
  vencidos: "vencido",
  alerta30: "alerta",
  alerta60: "alerta",
  alerta90: "alerta",
  alerta120: "alerta",
  alerta180: "alerta",
  alerta360: "alerta",
  semPosicao: "none",
};

function extintorNaoConformeNoMes(e: ExtintorRow, u: ChecklistExtintorMesRow | undefined): boolean {
  if (!u) return false;
  return (
    extintorTemManutencaoVencida(e.manutencao_2_nivel, e.manutencao_3_nivel) ||
    checklistTemNaoConformidade(u)
  );
}

function hidranteNaoConformeNoMes(
  h: HidranteVencimentoRow,
  u: ChecklistHidranteMesRow | undefined,
): boolean {
  if (!u) return false;
  return (
    hidranteTemMangueiraVencida(h) ||
    hidranteChecklistTemNaoConformidade(u as Record<string, string | null>)
  );
}

const MANUTENCAO_MODAL_META: Record<
  ManutencaoModalKey,
  { title: string; subtitle: string; color: string; exportLabel: string }
> = {
  vencidos: {
    title: "Manutenção de 2º nível vencida",
    subtitle: "Vencimento anual (2º nível) com data já ultrapassada",
    color: "#dc2626",
    exportLabel: "Nivel_2_vencidos",
  },
  alerta30: {
    title: "Extintores vencendo em 30 dias",
    subtitle: "Agendar manutenção urgente (2º nível)",
    color: "#f59e0b",
    exportLabel: "Vencendo_30_dias",
  },
  alerta60: {
    title: "Extintores vencendo em 60 dias",
    subtitle: "Planejar manutenção preventiva (2º nível)",
    color: "#eab308",
    exportLabel: "Vencendo_60_dias",
  },
  alerta90: {
    title: "Extintores vencendo em 90 dias",
    subtitle: "Antecipar agendamento de manutenção (2º nível)",
    color: "#84cc16",
    exportLabel: "Vencendo_90_dias",
  },
  alerta120: {
    title: "Extintores vencendo em 120 dias",
    subtitle: "Incluir no planejamento trimestral (2º nível)",
    color: "#22c55e",
    exportLabel: "Vencendo_120_dias",
  },
  alerta180: {
    title: "Extintores vencendo em 180 dias",
    subtitle: "Planejamento semestral (2º nível)",
    color: "#14b8a6",
    exportLabel: "Vencendo_180_dias",
  },
  alerta360: {
    title: "Extintores vencendo em 360 dias",
    subtitle: "Planejamento anual (2º nível)",
    color: "#0ea5e9",
    exportLabel: "Vencendo_360_dias",
  },
  semPosicao: {
    title: "Extintores sem posição no mapa",
    subtitle: "Posicionar em Posicionar equipamentos",
    color: "#6b7280",
    exportLabel: "Sem_posicao_mapa",
  },
};

function Nivel3AvisoBadge({ extintor }: { extintor: ExtintorRow }) {
  if (!nivel3VenceNoMesmoAnoQueNivel2(extintor.manutencao_2_nivel, extintor.manutencao_3_nivel)) {
    return null;
  }
  return (
    <span className="mt-1 inline-flex max-w-[11rem] rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold leading-snug text-violet-800">
      3º nível também vence neste ano
    </span>
  );
}

function ExtintorManutencaoModal({
  modalKey,
  items,
  dateRangeLabel,
  onClose,
}: {
  modalKey: ManutencaoModalKey;
  items: ExtintorRow[];
  dateRangeLabel?: string;
  onClose: () => void;
}) {
  const meta = MANUTENCAO_MODAL_META[modalKey];
  const showManutencaoCols = modalKey !== "semPosicao";
  const today = startOfTodayLocal();

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
            {dateRangeLabel ? (
              <p className="mt-1 text-xs font-semibold text-white/90">
                Período contabilizado: {dateRangeLabel}
              </p>
            ) : null}
            <p className="mt-2 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white">
              {items.length} extintor{items.length !== 1 ? "es" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {items.length > 0 && (
              <ExportActions
                compact
                tone="dark"
                onExcel={() => exportAlertasVencimento(items, meta.exportLabel, ALERTA_EXPORT_HIGHLIGHT[modalKey])}
                onPdf={() => exportAlertasExtintoresPdf(items, meta.title)}
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
            <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhum extintor nesta categoria.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 shadow-sm shadow-slate-200/60">
                <tr>
                  <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.codigo}</th>
                  <th className={COLUNA_TITULO_CLASS}>
                    {COLUNAS_EXTINTOR.pavimento} / {COLUNAS_EXTINTOR.localDetalhado}
                  </th>
                  <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.pavimento}</th>
                  <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.tipo}</th>
                  <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.numInmetro}</th>
                  {showManutencaoCols ? (
                    <>
                      <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.manutencao2}</th>
                      <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.manutencao3}</th>
                      <th className={COLUNA_TITULO_CLASS}>Dias</th>
                    </>
                  ) : (
                    <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.capacidadeExtintora}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((e) => {
                  const days = showManutencaoCols
                    ? diasRestantesNivel2(e.manutencao_2_nivel, today)
                    : null;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{e.codigo}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{e.setor}</p>
                        <p className="text-xs text-slate-400">{e.local_detalhado}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.pavimento?.trim() || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {e.tipo} {e.tamanho}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.num_inmetro}</td>
                      {showManutencaoCols ? (
                        <>
                          <td className="px-4 py-3 text-slate-600">{formatDatePt(e.manutencao_2_nivel)}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <p>{formatDatePt(e.manutencao_3_nivel)}</p>
                            <Nivel3AvisoBadge extintor={e} />
                          </td>
                          <td className="px-4 py-3">
                            {days !== null ? (
                              <span
                                className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold"
                                style={{
                                  background: days < 0 ? "#fee2e2" : days <= 30 ? "#fef3c7" : "#fef9c3",
                                  color: days < 0 ? "#b91c1c" : days <= 30 ? "#92400e" : "#713f12",
                                }}
                              >
                                {days < 0 ? `${Math.abs(days)}d vencido` : `${days}d`}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-slate-600">{e.capacidade_extintora || "—"}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "amber" | "slate" }) {
  const toneClass =
    tone === "green"
      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
      : tone === "red"
        ? "border-red-100 bg-red-50 text-red-800"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50 text-amber-800"
          : "border-slate-100 bg-slate-50 text-slate-800";
  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
    </div>
  );
}

function AlertTable({
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
  items: ExtintorRow[];
  exportLabel: string;
  exportHighlight: AlertaVencimentoRowHighlight;
}) {
  if (items.length === 0) return null;
  const today = startOfTodayLocal();

  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-sm shadow-slate-200/70">
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: `4px solid ${color}` }}>
        <div>
          <h3 className="text-base font-black text-[var(--ink)]">{title}</h3>
          <p className="text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
        <ExportActions
          compact
          onExcel={() => exportAlertasVencimento(items, exportLabel, exportHighlight)}
          onPdf={() => exportAlertasExtintoresPdf(items, title)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/80">
              <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.codigo}</th>
              <th className={COLUNA_TITULO_CLASS}>
                {COLUNAS_EXTINTOR.pavimento} / {COLUNAS_EXTINTOR.localDetalhado}
              </th>
              <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.tipo}</th>
              <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.manutencao2}</th>
              <th className={COLUNA_TITULO_CLASS}>{COLUNAS_EXTINTOR.manutencao3}</th>
              <th className={COLUNA_TITULO_CLASS}>Dias restantes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((e) => {
              const days = diasRestantesNivel2(e.manutencao_2_nivel, today);
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{e.codigo}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{e.setor}</p>
                    <p className="text-xs text-slate-400">{e.local_detalhado}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.tipo} {e.tamanho}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDatePt(e.manutencao_2_nivel)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{formatDatePt(e.manutencao_3_nivel)}</p>
                    <Nivel3AvisoBadge extintor={e} />
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
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-5 py-2.5">
        <p className="text-xs text-slate-400">{items.length} extintor{items.length !== 1 ? "es" : ""}</p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { ready, activeBaseId, activeBase } = useActiveBase();
  const showEmpresaTabs = baseHasEmpresaTabs(activeBase);
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [checklistsExtMes, setChecklistsExtMes] = useState<ChecklistExtintorMesRow[]>([]);
  const [hidrantes, setHidrantes] = useState<HidranteVencimentoRow[]>([]);
  const [checklistsHidMes, setChecklistsHidMes] = useState<ChecklistHidranteMesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [manutencaoModal, setManutencaoModal] = useState<ManutencaoModalKey | null>(null);
  const [empresaTab, setEmpresaTab] = useState<EmpresaTab>("santa_genoveva");
  const supabase = useMemo(() => getSupabaseClient(), []);

  const mesAtualRange = useMemo(() => getLocalCalendarMonthUtcIsoRange(), []);

  useEffect(() => {
    if (!showEmpresaTabs) setEmpresaTab("todos");
  }, [showEmpresaTabs]);

  const loadDashboard = useCallback(async () => {
    if (!ready || !activeBaseId) return;
    setLoading(true);
    const { startIso, endInclusiveIso } = mesAtualRange;
    await getCurrentSession();
    const [extRes, hidRes, chExt, chHid] = await Promise.all([
      supabase
        .from("extintores")
        .select(
          "id,codigo,setor,local_detalhado,num_inmetro,num_cilindro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,pavimento,created_at",
        )
        .eq("base_id", activeBaseId)
        .eq("active", true)
        .order("codigo", { ascending: true }),
      supabase
        .from("hidrantes")
        .select(
          "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,coord_x,coord_y",
        )
        .eq("base_id", activeBaseId)
        .eq("active", true)
        .order("codigo", { ascending: true }),
      fetchChecklistsExtintoresDoMes(supabase, startIso, endInclusiveIso, activeBaseId),
      fetchChecklistsHidrantesDoMes(supabase, startIso, endInclusiveIso, activeBaseId),
    ]);

    setExtintores((extRes.data ?? []) as ExtintorRow[]);
    setChecklistsExtMes(chExt.ok ? chExt.rows : []);
    setHidrantes((hidRes.data ?? []) as HidranteVencimentoRow[]);
    setChecklistsHidMes(chHid.ok ? chHid.rows : []);
    setLoading(false);
  }, [supabase, mesAtualRange, ready, activeBaseId]);

  useEffect(() => {
    if (!ready || !activeBaseId) return;
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard, ready, activeBaseId]);

  const today = useMemo(() => startOfTodayLocal(), []);

  const faixaLabels = useMemo(
    () => ({
      vencidos: faixaDateRangeLabel("vencidos", today),
      alerta30: faixaDateRangeLabel("alerta30", today),
      alerta60: faixaDateRangeLabel("alerta60", today),
      alerta90: faixaDateRangeLabel("alerta90", today),
      alerta120: faixaDateRangeLabel("alerta120", today),
      alerta180: faixaDateRangeLabel("alerta180", today),
      alerta360: faixaDateRangeLabel("alerta360", today),
    }),
    [today],
  );

  const effectiveEmpresaTab: EmpresaTab = showEmpresaTabs ? empresaTab : "todos";

  const extintoresVisiveis = useMemo(
    () => filtrarPorEmpresa(extintores, effectiveEmpresaTab, (e) => e.setor),
    [extintores, effectiveEmpresaTab],
  );

  const hidrantesVisiveis = useMemo(
    () => filtrarPorEmpresa(hidrantes, effectiveEmpresaTab, (h) => h.pavimento),
    [hidrantes, effectiveEmpresaTab],
  );

  const stats = useMemo<Stats>(() => {
    let vencidos = 0;
    let alerta30 = 0;
    let alerta60 = 0;
    let alerta90 = 0;
    let alerta120 = 0;
    let alerta180 = 0;
    let alerta360 = 0;
    let semPosicao = 0;

    for (const e of extintoresVisiveis) {
      if (e.coord_x == null) semPosicao++;
      if (dataNivel2NaFaixa(e.manutencao_2_nivel, "vencidos", today)) {
        vencidos++;
        continue;
      }
      if (dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta30", today)) alerta30++;
      else if (dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta60", today)) alerta60++;
      else if (dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta90", today)) alerta90++;
      else if (dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta120", today)) alerta120++;
      else if (dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta180", today)) alerta180++;
      else if (dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta360", today)) alerta360++;
    }
    return {
      total: extintoresVisiveis.length,
      vencidos,
      alerta30,
      alerta60,
      alerta90,
      alerta120,
      alerta180,
      alerta360,
      semPosicao,
    };
  }, [extintoresVisiveis, today]);

  const vencidosList = useMemo(
    () => extintoresVisiveis.filter((e) => dataNivel2NaFaixa(e.manutencao_2_nivel, "vencidos", today)),
    [extintoresVisiveis, today],
  );

  const alerta30List = useMemo(
    () => extintoresVisiveis.filter((e) => dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta30", today)),
    [extintoresVisiveis, today],
  );

  const alerta60List = useMemo(
    () => extintoresVisiveis.filter((e) => dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta60", today)),
    [extintoresVisiveis, today],
  );

  const alerta90List = useMemo(
    () => extintoresVisiveis.filter((e) => dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta90", today)),
    [extintoresVisiveis, today],
  );

  const alerta120List = useMemo(
    () => extintoresVisiveis.filter((e) => dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta120", today)),
    [extintoresVisiveis, today],
  );

  const alerta180List = useMemo(
    () => extintoresVisiveis.filter((e) => dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta180", today)),
    [extintoresVisiveis, today],
  );

  const alerta360List = useMemo(
    () => extintoresVisiveis.filter((e) => dataNivel2NaFaixa(e.manutencao_2_nivel, "alerta360", today)),
    [extintoresVisiveis, today],
  );

  const semPosicaoList = useMemo(
    () =>
      extintoresVisiveis
        .filter((e) => e.coord_x == null)
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })),
    [extintoresVisiveis],
  );

  const manutencaoModalItems = useMemo(() => {
    if (!manutencaoModal) return [];
    const sortByCodigo = (list: ExtintorRow[]) =>
      [...list].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
    if (manutencaoModal === "vencidos") return sortByCodigo(vencidosList);
    if (manutencaoModal === "alerta30") return sortByCodigo(alerta30List);
    if (manutencaoModal === "alerta60") return sortByCodigo(alerta60List);
    if (manutencaoModal === "alerta90") return sortByCodigo(alerta90List);
    if (manutencaoModal === "alerta120") return sortByCodigo(alerta120List);
    if (manutencaoModal === "alerta180") return sortByCodigo(alerta180List);
    if (manutencaoModal === "alerta360") return sortByCodigo(alerta360List);
    return semPosicaoList;
  }, [
    manutencaoModal,
    vencidosList,
    alerta30List,
    alerta60List,
    alerta90List,
    alerta120List,
    alerta180List,
    alerta360List,
    semPosicaoList,
  ]);

  const manutencaoModalRange =
    manutencaoModal && manutencaoModal !== "semPosicao"
      ? faixaLabels[manutencaoModal]
      : undefined;

  const ultimoChecklistExtintor = useMemo(
    () => buildUltimoPorExtintor(checklistsExtMes),
    [checklistsExtMes],
  );

  const ultimoChecklistHidrante = useMemo(
    () => buildUltimoPorHidrante(checklistsHidMes),
    [checklistsHidMes],
  );

  const extintorConferenciaMes = useMemo(() => {
    let conforme = 0;
    let naoConforme = 0;
    let pendente = 0;
    for (const e of extintoresVisiveis) {
      const u = ultimoChecklistExtintor.get(e.id);
      if (!u) pendente += 1;
      else if (extintorNaoConformeNoMes(e, u)) naoConforme += 1;
      else conforme += 1;
    }
    return { conforme, naoConforme, pendente, total: extintoresVisiveis.length };
  }, [extintoresVisiveis, ultimoChecklistExtintor]);

  const hidranteConferenciaMes = useMemo(() => {
    let conforme = 0;
    let naoConforme = 0;
    let pendente = 0;
    for (const h of hidrantesVisiveis) {
      const u = ultimoChecklistHidrante.get(h.id);
      if (!u) pendente += 1;
      else if (hidranteNaoConformeNoMes(h, u)) naoConforme += 1;
      else conforme += 1;
    }
    return { conforme, naoConforme, pendente, total: hidrantesVisiveis.length };
  }, [hidrantesVisiveis, ultimoChecklistHidrante]);

  const extintoresNcMes = useMemo(() => {
    return extintoresVisiveis
      .map((e) => ({ e, u: ultimoChecklistExtintor.get(e.id) }))
      .filter((x): x is { e: ExtintorRow; u: ChecklistExtintorMesRow } =>
        Boolean(x.u && extintorNaoConformeNoMes(x.e, x.u)),
      );
  }, [extintoresVisiveis, ultimoChecklistExtintor]);

  const hidrantesNcMes = useMemo(() => {
    return hidrantesVisiveis
      .map((h) => ({ h, u: ultimoChecklistHidrante.get(h.id) }))
      .filter((x): x is { h: HidranteVencimentoRow; u: ChecklistHidranteMesRow } =>
        Boolean(x.u && hidranteNaoConformeNoMes(x.h, x.u)),
      );
  }, [hidrantesVisiveis, ultimoChecklistHidrante]);

  const mesLegenda = useMemo(
    () => new Date(mesAtualRange.startIso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [mesAtualRange.startIso],
  );

  if (!ready || !activeBaseId || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--neon)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="page-hero reveal-up p-6 sm:p-7">
        <div className="page-hero-content flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--neon)]">Painel operacional</p>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-300">
              Visão consolidada de extintores, hidrantes, conferências mensais e manutenção programada.
            </p>
          </div>
          <p className="inline-flex rounded-full bg-[var(--neon)] px-3.5 py-1.5 text-xs font-extrabold capitalize text-[var(--neon-ink)] shadow-md shadow-black/20">
            {mesLegenda}
          </p>
        </div>
      </div>

      {showEmpresaTabs && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="pl-5 pr-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Empresa
          </span>
          {EMPRESA_TABS.map((tab) => {
            const active = empresaTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setEmpresaTab(tab.id);
                  setManutencaoModal(null);
                }}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
                  active
                    ? "border-[var(--neon)] bg-[var(--neon)] text-[var(--neon-ink)] shadow-sm shadow-[var(--neon)]/30"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="page-heading">
        <div>
          <p className="page-eyebrow">Extintores</p>
          <h2 className="mt-1 text-2xl font-extrabold text-[var(--ink)]">Vencimento de manutenção</h2>
        </div>
        <p className="text-xs font-medium text-slate-500">
          Cards baseados no vencimento anual de 2º nível. Se o 3º nível vence no mesmo ano, aparece aviso na lista.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DashboardStatCard
          label="Total de extintores"
          value={stats.total}
          color="#3b82f6"
          icon={<DashboardStatIcon name="total" />}
        />
        <DashboardStatCard
          label="Manutenção de 2º nível vencida"
          subtitle={faixaLabels.vencidos}
          value={stats.vencidos}
          color="#dc2626"
          onClick={() => setManutencaoModal("vencidos")}
          icon={<DashboardStatIcon name="vencido" />}
        />
        <DashboardStatCard
          label="Vencendo em 30 dias"
          subtitle={faixaLabels.alerta30}
          value={stats.alerta30}
          color="#f59e0b"
          onClick={() => setManutencaoModal("alerta30")}
          icon={<DashboardStatIcon name="alerta30" />}
        />
        <DashboardStatCard
          label="Vencendo em 60 dias"
          subtitle={faixaLabels.alerta60}
          value={stats.alerta60}
          color="#eab308"
          onClick={() => setManutencaoModal("alerta60")}
          icon={<DashboardStatIcon name="alerta60" />}
        />
        <DashboardStatCard
          label="Vencendo em 90 dias"
          subtitle={faixaLabels.alerta90}
          value={stats.alerta90}
          color="#84cc16"
          onClick={() => setManutencaoModal("alerta90")}
          icon={<DashboardStatIcon name="alerta90" />}
        />
        <DashboardStatCard
          label="Vencendo em 120 dias"
          subtitle={faixaLabels.alerta120}
          value={stats.alerta120}
          color="#22c55e"
          onClick={() => setManutencaoModal("alerta120")}
          icon={<DashboardStatIcon name="alerta120" />}
        />
        <DashboardStatCard
          label="Vencendo em 180 dias"
          subtitle={faixaLabels.alerta180}
          value={stats.alerta180}
          color="#14b8a6"
          onClick={() => setManutencaoModal("alerta180")}
          icon={<DashboardStatIcon name="alerta180" />}
        />
        <DashboardStatCard
          label="Vencendo em 360 dias"
          subtitle={faixaLabels.alerta360}
          value={stats.alerta360}
          color="#0ea5e9"
          onClick={() => setManutencaoModal("alerta360")}
          icon={<DashboardStatIcon name="alerta360" />}
        />
        <DashboardStatCard
          label="Sem posição no mapa"
          value={stats.semPosicao}
          color="#6b7280"
          onClick={() => setManutencaoModal("semPosicao")}
          icon={<DashboardStatIcon name="semMapa" />}
        />
      </div>

      {manutencaoModal && (
        <ExtintorManutencaoModal
          modalKey={manutencaoModal}
          items={manutencaoModalItems}
          dateRangeLabel={manutencaoModalRange}
          onClose={() => setManutencaoModal(null)}
        />
      )}

      <HidranteVencimentoSection hidrantes={hidrantesVisiveis} />

      {/* Conferência no mês */}
      <section className="professional-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
          <div>
            <p className="page-eyebrow">Auditoria mensal</p>
            <h2 className="mt-1 text-xl font-extrabold text-[var(--ink)]">Conferência no mês</h2>
          </div>
          <p className="max-w-xl text-xs font-medium text-slate-500">
            Última conferência registrada no mês. Vencidos (manutenção ou mangueira) entram em não conforme.
          </p>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[#fafafa] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--ink)]">Extintores</h3>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700">
                {extintorConferenciaMes.total} itens
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Conforme" value={extintorConferenciaMes.conforme} tone="green" />
              <MiniStat label="Não conforme" value={extintorConferenciaMes.naoConforme} tone="red" />
              <MiniStat label="Pendente" value={extintorConferenciaMes.pendente} tone="amber" />
              <MiniStat label="Total" value={extintorConferenciaMes.total} tone="slate" />
            </div>
            {extintoresNcMes.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Código</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Local</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Última conferência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {extintoresNcMes.map(({ e, u }) => (
                      <tr key={e.id}>
                        <td className="px-3 py-2 font-semibold text-slate-900">{e.codigo}</td>
                        <td className="px-3 py-2 text-slate-600">{formatLocalLinha(e.setor, e.local_detalhado)}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {new Date(u.data_conferencia).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-2xl bg-white px-4 py-3 text-xs font-medium text-slate-500">
                Nenhum extintor com não conformidade ou vencimento na última conferência do mês.
              </p>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[#fafafa] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--ink)]">Hidrantes</h3>
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-orange-700">
                {hidranteConferenciaMes.total} itens
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Conforme" value={hidranteConferenciaMes.conforme} tone="green" />
              <MiniStat label="Não conforme" value={hidranteConferenciaMes.naoConforme} tone="red" />
              <MiniStat label="Pendente" value={hidranteConferenciaMes.pendente} tone="amber" />
              <MiniStat label="Total" value={hidranteConferenciaMes.total} tone="slate" />
            </div>
            {hidrantesNcMes.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Código</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Local</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Última conferência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hidrantesNcMes.map(({ h, u }) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 font-semibold text-slate-900">{h.codigo}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {formatLocalLinha(h.pavimento ?? "", h.local_detalhado)}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {new Date(u.data_conferencia).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-2xl bg-white px-4 py-3 text-xs font-medium text-slate-500">
                Nenhum hidrante com não conformidade ou mangueira vencida na última conferência do mês.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="page-heading">
        <div>
          <p className="page-eyebrow">Planejamento</p>
          <h2 className="mt-1 text-2xl font-extrabold text-[var(--ink)]">Manutenção programada</h2>
        </div>
        <p className="text-xs font-medium text-slate-500">
          Extintores por vencimento da manutenção de 2º nível (anual).
        </p>
      </div>

      {/* Summary bar */}
      {stats.total > 0 && (
        <div className="professional-card overflow-hidden p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-[var(--ink)]">Distribuição de manutenção</p>
              <p className="text-xs font-medium text-slate-500">Percentual dos extintores por faixa de vencimento (2º nível).</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              {stats.total} extintor{stats.total !== 1 ? "es" : ""}
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
            {stats.alerta180 > 0 && (
              <div
                title={`Alerta 180d: ${stats.alerta180}`}
                className="h-full bg-teal-400"
                style={{ width: `${(stats.alerta180 / stats.total) * 100}%` }}
              />
            )}
            {stats.alerta360 > 0 && (
              <div
                title={`Alerta 360d: ${stats.alerta360}`}
                className="h-full bg-sky-400"
                style={{ width: `${(stats.alerta360 / stats.total) * 100}%` }}
              />
            )}
            <div className="h-full flex-1 bg-green-400" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Manutenção de 2º nível vencida</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Alerta 30d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-300" />Alerta 60d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-lime-400" />Alerta 90d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-300" />Alerta 120d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-400" />Alerta 180d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />Alerta 360d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />Em dia</span>
          </div>
        </div>
      )}

      {/* Alert tables */}
      <AlertTable
        title="Manutenção de 2º nível vencida"
        subtitle={faixaLabels.vencidos}
        color="#dc2626"
        items={vencidosList}
        exportLabel="Nivel_2_vencidos"
        exportHighlight="vencido"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 30 dias"
        subtitle={faixaLabels.alerta30}
        color="#f59e0b"
        items={alerta30List}
        exportLabel="Vencendo_30_dias"
        exportHighlight="alerta"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 60 dias"
        subtitle={faixaLabels.alerta60}
        color="#eab308"
        items={alerta60List}
        exportLabel="Vencendo_60_dias"
        exportHighlight="alerta"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 90 dias"
        subtitle={faixaLabels.alerta90}
        color="#84cc16"
        items={alerta90List}
        exportLabel="Vencendo_90_dias"
        exportHighlight="alerta"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 120 dias"
        subtitle={faixaLabels.alerta120}
        color="#22c55e"
        items={alerta120List}
        exportLabel="Vencendo_120_dias"
        exportHighlight="alerta"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 180 dias"
        subtitle={faixaLabels.alerta180}
        color="#14b8a6"
        items={alerta180List}
        exportLabel="Vencendo_180_dias"
        exportHighlight="alerta"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 360 dias"
        subtitle={faixaLabels.alerta360}
        color="#0ea5e9"
        items={alerta360List}
        exportLabel="Vencendo_360_dias"
        exportHighlight="alerta"
      />

      {/* All good banner */}
      {stats.vencidos === 0 &&
        stats.alerta30 === 0 &&
        stats.alerta60 === 0 &&
        stats.alerta90 === 0 &&
        stats.alerta120 === 0 &&
        stats.alerta180 === 0 &&
        stats.alerta360 === 0 &&
        stats.total > 0 && (
        <div className="flex items-center gap-4 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-4 shadow-sm shadow-emerald-100">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-black text-emerald-900">Tudo em dia!</p>
            <p className="text-xs font-medium text-emerald-700">
              Nenhum extintor com manutenção de 2º nível vencida ou próxima do vencimento (até 360 dias).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
