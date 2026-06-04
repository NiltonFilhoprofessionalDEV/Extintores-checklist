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
import { exportAlertasVencimento, type AlertaVencimentoRowHighlight, type ExtintorRow } from "@/lib/export/excel";
import { extintorTemManutencaoVencida } from "@/lib/export/conferencia-historico";
import { checklistTemNaoConformidade, isDataVencida } from "@/lib/checklist/types";
import { hidranteChecklistTemNaoConformidade } from "@/lib/checklist/hidrante-types";
import { getLocalCalendarMonthUtcIsoRange } from "@/lib/date/local-month-range";
import { formatDateOnlyPt, parseCalendarDateAsLocal } from "@/lib/date/date-only";
import { hidranteTemMangueiraVencida, type HidranteVencimentoRow } from "@/lib/hidrantes/vencimento-mangueiras";
import { DashboardStatCard, DashboardStatIcon } from "./dashboard-stat-card";
import { HidranteVencimentoSection } from "./HidranteVencimentoSection";

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
  const target = parseCalendarDateAsLocal(dateStr);
  if (!target) return 0;
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

function isManutencaoNivel2Vencida(e: ExtintorRow): boolean {
  return isDataVencida(e.manutencao_2_nivel);
}

function diasRestantes(e: ExtintorRow, referencia: "earliest" | "nivel2"): number | null {
  if (referencia === "nivel2") {
    return e.manutencao_2_nivel ? diffDays(e.manutencao_2_nivel) : null;
  }
  const d = earliestDate(e);
  return d ? diffDays(d) : null;
}

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

type ManutencaoModalKey = "vencidos" | "alerta30" | "alerta60" | "semPosicao";

const ALERTA_EXPORT_HIGHLIGHT: Record<ManutencaoModalKey, AlertaVencimentoRowHighlight> = {
  vencidos: "vencido",
  alerta30: "alerta",
  alerta60: "alerta",
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
    subtitle: "Próximo teste nível 2 com data já ultrapassada",
    color: "#dc2626",
    exportLabel: "Nivel_2_vencidos",
  },
  alerta30: {
    title: "Extintores vencendo em 30 dias",
    subtitle: "Agendar manutenção urgente",
    color: "#f59e0b",
    exportLabel: "Vencendo_30_dias",
  },
  alerta60: {
    title: "Extintores vencendo em 60 dias",
    subtitle: "Planejar manutenção preventiva",
    color: "#eab308",
    exportLabel: "Vencendo_60_dias",
  },
  semPosicao: {
    title: "Extintores sem posição no mapa",
    subtitle: "Posicionar no módulo de mapeamento",
    color: "#6b7280",
    exportLabel: "Sem_posicao_mapa",
  },
};

function ExtintorManutencaoModal({
  modalKey,
  items,
  onClose,
}: {
  modalKey: ManutencaoModalKey;
  items: ExtintorRow[];
  onClose: () => void;
}) {
  const meta = MANUTENCAO_MODAL_META[modalKey];
  const showManutencaoCols = modalKey !== "semPosicao";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90dvh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-950/30"
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
              {items.length} extintor{items.length !== 1 ? "es" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => exportAlertasVencimento(items, meta.exportLabel, ALERTA_EXPORT_HIGHLIGHT[modalKey])}
                className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/20 transition hover:bg-white/25"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar
              </button>
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
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Código
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Setor / local
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Pavimento
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Tipo
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Nº INMETRO
                  </th>
                  {showManutencaoCols ? (
                    <>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Vencto. N2
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Vencto. N3
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Dias
                      </th>
                    </>
                  ) : (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Capacidade
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((e) => {
                  const days = diasRestantes(e, modalKey === "vencidos" ? "nivel2" : "earliest");
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
                          <td className="px-4 py-3 text-slate-600">{formatDatePt(e.manutencao_3_nivel)}</td>
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
  diasReferencia = "earliest",
}: {
  title: string;
  subtitle: string;
  color: string;
  items: ExtintorRow[];
  exportLabel: string;
  exportHighlight: AlertaVencimentoRowHighlight;
  diasReferencia?: "earliest" | "nivel2";
}) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-sm shadow-slate-200/70">
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: `4px solid ${color}` }}>
        <div>
          <h3 className="text-base font-black text-slate-950">{title}</h3>
          <p className="text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => exportAlertasVencimento(items, exportLabel, exportHighlight)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
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
            <tr className="border-y border-slate-100 bg-slate-50/80">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Código</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Pavimento / local</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vencto. Nível 2</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vencto. Nível 3</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Dias restantes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((e) => {
              const days = diasRestantes(e, diasReferencia);
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{e.codigo}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{e.setor}</p>
                    <p className="text-xs text-slate-400">{e.local_detalhado}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.tipo} {e.tamanho}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDatePt(e.manutencao_2_nivel)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDatePt(e.manutencao_3_nivel)}</td>
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
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [checklistsExtMes, setChecklistsExtMes] = useState<ChecklistExtintorMesRow[]>([]);
  const [hidrantes, setHidrantes] = useState<HidranteVencimentoRow[]>([]);
  const [checklistsHidMes, setChecklistsHidMes] = useState<ChecklistHidranteMesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [manutencaoModal, setManutencaoModal] = useState<ManutencaoModalKey | null>(null);
  const supabase = useMemo(() => getSupabaseClient(), []);

  const mesAtualRange = useMemo(() => getLocalCalendarMonthUtcIsoRange(), []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const { startIso, endInclusiveIso } = mesAtualRange;
    await getCurrentSession();
    const [extRes, hidRes, chExt, chHid] = await Promise.all([
      supabase
        .from("extintores")
        .select(
          "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,pavimento,created_at",
        )
        .order("codigo", { ascending: true }),
      supabase
        .from("hidrantes")
        .select(
          "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,coord_x,coord_y",
        )
        .order("codigo", { ascending: true }),
      fetchChecklistsExtintoresDoMes(supabase, startIso, endInclusiveIso),
      fetchChecklistsHidrantesDoMes(supabase, startIso, endInclusiveIso),
    ]);

    setExtintores((extRes.data ?? []) as ExtintorRow[]);
    setChecklistsExtMes(chExt.ok ? chExt.rows : []);
    setHidrantes((hidRes.data ?? []) as HidranteVencimentoRow[]);
    setChecklistsHidMes(chHid.ok ? chHid.rows : []);
    setLoading(false);
  }, [supabase, mesAtualRange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const stats = useMemo<Stats>(() => {
    const in30 = addDays(today, 30);
    const in60 = addDays(today, 60);
    let vencidos = 0, alerta30 = 0, alerta60 = 0, semPosicao = 0;

    for (const e of extintores) {
      if (e.coord_x == null) semPosicao++;
      if (isManutencaoNivel2Vencida(e)) {
        vencidos++;
        continue;
      }
      const d = earliestDate(e);
      if (!d) continue;
      const dt = parseCalendarDateAsLocal(d);
      if (!dt) continue;
      dt.setHours(0, 0, 0, 0);
      if (dt <= in30) alerta30++;
      else if (dt <= in60) alerta60++;
    }
    return { total: extintores.length, vencidos, alerta30, alerta60, semPosicao };
  }, [extintores, today]);

  const vencidosList = useMemo(
    () => extintores.filter((e) => isManutencaoNivel2Vencida(e)),
    [extintores],
  );

  const alerta30List = useMemo(() => {
    const in30 = addDays(today, 30);
    return extintores.filter((e) => {
      if (isManutencaoNivel2Vencida(e)) return false;
      const d = earliestDate(e);
      if (!d) return false;
      const dt = parseCalendarDateAsLocal(d);
      if (!dt) return false;
      dt.setHours(0, 0, 0, 0);
      return dt >= today && dt <= in30;
    });
  }, [extintores, today]);

  const alerta60List = useMemo(() => {
    const in30 = addDays(today, 30);
    const in60 = addDays(today, 60);
    return extintores.filter((e) => {
      if (isManutencaoNivel2Vencida(e)) return false;
      const d = earliestDate(e);
      if (!d) return false;
      const dt = parseCalendarDateAsLocal(d);
      if (!dt) return false;
      dt.setHours(0, 0, 0, 0);
      return dt > in30 && dt <= in60;
    });
  }, [extintores, today]);

  const semPosicaoList = useMemo(
    () =>
      extintores
        .filter((e) => e.coord_x == null)
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })),
    [extintores],
  );

  const manutencaoModalItems = useMemo(() => {
    if (!manutencaoModal) return [];
    const sortByCodigo = (list: ExtintorRow[]) =>
      [...list].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
    if (manutencaoModal === "vencidos") return sortByCodigo(vencidosList);
    if (manutencaoModal === "alerta30") return sortByCodigo(alerta30List);
    if (manutencaoModal === "alerta60") return sortByCodigo(alerta60List);
    return semPosicaoList;
  }, [manutencaoModal, vencidosList, alerta30List, alerta60List, semPosicaoList]);

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
    for (const e of extintores) {
      const u = ultimoChecklistExtintor.get(e.id);
      if (!u) pendente += 1;
      else if (extintorNaoConformeNoMes(e, u)) naoConforme += 1;
      else conforme += 1;
    }
    return { conforme, naoConforme, pendente, total: extintores.length };
  }, [extintores, ultimoChecklistExtintor]);

  const hidranteConferenciaMes = useMemo(() => {
    let conforme = 0;
    let naoConforme = 0;
    let pendente = 0;
    for (const h of hidrantes) {
      const u = ultimoChecklistHidrante.get(h.id);
      if (!u) pendente += 1;
      else if (hidranteNaoConformeNoMes(h, u)) naoConforme += 1;
      else conforme += 1;
    }
    return { conforme, naoConforme, pendente, total: hidrantes.length };
  }, [hidrantes, ultimoChecklistHidrante]);

  const extintoresNcMes = useMemo(() => {
    return extintores
      .map((e) => ({ e, u: ultimoChecklistExtintor.get(e.id) }))
      .filter((x): x is { e: ExtintorRow; u: ChecklistExtintorMesRow } =>
        Boolean(x.u && extintorNaoConformeNoMes(x.e, x.u)),
      );
  }, [extintores, ultimoChecklistExtintor]);

  const hidrantesNcMes = useMemo(() => {
    return hidrantes
      .map((h) => ({ h, u: ultimoChecklistHidrante.get(h.id) }))
      .filter((x): x is { h: HidranteVencimentoRow; u: ChecklistHidranteMesRow } =>
        Boolean(x.u && hidranteNaoConformeNoMes(x.h, x.u)),
      );
  }, [hidrantes, ultimoChecklistHidrante]);

  const mesLegenda = useMemo(
    () => new Date(mesAtualRange.startIso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [mesAtualRange.startIso],
  );

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
      <div className="page-hero p-6">
        <div className="page-hero-content flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-red-200">Painel operacional</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-300">
              Visão consolidada de extintores, hidrantes, conferências mensais e manutenção programada.
            </p>
            <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold capitalize text-white ring-1 ring-white/15">
              Mês de referência: {mesLegenda}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="pl-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#b42318]">Extintores</p>
          <h2 className="text-xl font-black text-slate-950">Vencimento de manutenção</h2>
        </div>
        <p className="text-xs font-medium text-slate-500">
          Manutenção de 2º e 3º nível conforme datas cadastradas no extintor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <DashboardStatCard
          label="Total de extintores"
          value={stats.total}
          color="#3b82f6"
          icon={<DashboardStatIcon name="total" />}
        />
        <DashboardStatCard
          label="Manutenção de 2º nível vencida"
          value={stats.vencidos}
          color="#dc2626"
          onClick={() => setManutencaoModal("vencidos")}
          icon={<DashboardStatIcon name="vencido" />}
        />
        <DashboardStatCard
          label="Vencendo em 30 dias"
          value={stats.alerta30}
          color="#f59e0b"
          onClick={() => setManutencaoModal("alerta30")}
          icon={<DashboardStatIcon name="alerta30" />}
        />
        <DashboardStatCard
          label="Vencendo em 60 dias"
          value={stats.alerta60}
          color="#eab308"
          onClick={() => setManutencaoModal("alerta60")}
          icon={<DashboardStatIcon name="alerta60" />}
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
          onClose={() => setManutencaoModal(null)}
        />
      )}

      <HidranteVencimentoSection hidrantes={hidrantes} />

      {/* Conferência no mês */}
      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-sm shadow-slate-200/70">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#b42318]">Auditoria mensal</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Conferência no mês</h2>
          </div>
          <p className="max-w-xl text-xs font-medium text-slate-500">
            Última conferência registrada no mês. Vencidos (manutenção ou mangueira) entram em não conforme.
          </p>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-950">Extintores</h3>
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

          <div className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-950">Hidrantes</h3>
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

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="pl-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#b42318]">Planejamento</p>
          <h2 className="text-xl font-black text-slate-950">Manutenção programada</h2>
        </div>
        <p className="text-xs font-medium text-slate-500">Extintores por vencimento de manutenção (2º e 3º nível).</p>
      </div>

      {/* Summary bar */}
      {stats.total > 0 && (
        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-950">Distribuição de manutenção</p>
              <p className="text-xs font-medium text-slate-500">Percentual dos extintores por faixa de vencimento.</p>
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
            <div className="h-full flex-1 bg-green-400" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Manutenção de 2º nível vencida</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Alerta 30d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-300" />Alerta 60d</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />Em dia</span>
          </div>
        </div>
      )}

      {/* Alert tables */}
      <AlertTable
        title="Manutenção de 2º nível vencida"
        subtitle="Próximo teste nível 2 com data já ultrapassada"
        color="#dc2626"
        items={vencidosList}
        exportLabel="Nivel_2_vencidos"
        exportHighlight="vencido"
        diasReferencia="nivel2"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 30 dias"
        subtitle="Agendar manutenção urgente"
        color="#f59e0b"
        items={alerta30List}
        exportLabel="Vencendo_30_dias"
        exportHighlight="alerta"
      />
      <AlertTable
        title="Extintores vencendo nos próximos 60 dias"
        subtitle="Planejar manutenção preventiva"
        color="#eab308"
        items={alerta60List}
        exportLabel="Vencendo_60_dias"
        exportHighlight="alerta"
      />

      {/* All good banner */}
      {stats.vencidos === 0 && stats.alerta30 === 0 && stats.alerta60 === 0 && stats.total > 0 && (
        <div className="flex items-center gap-4 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-4 shadow-sm shadow-emerald-100">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-black text-emerald-900">Tudo em dia!</p>
            <p className="text-xs font-medium text-emerald-700">
              Nenhum extintor com manutenção nível 2 vencida ou próxima do vencimento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
