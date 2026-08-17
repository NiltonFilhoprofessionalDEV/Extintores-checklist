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
import {
  computeHidranteVencimentoBuckets,
  diasRestantesMangueiraCritica,
  earliestVencimentoMangueira,
  hidranteTemMangueiraVencida,
  type HidranteVencimentoRow,
} from "@/lib/hidrantes/vencimento-mangueiras";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";
import { ALL_NAV_ITEMS, getVisibleNavItems } from "@/src/components/admin/admin-nav";
import DashboardHome, { type DashAlert, type DashFaixa, type DashRecent, type DashUpcoming } from "./DashboardHome";
import DashboardDetailDrawer, { RemainingDaysBadge } from "./DashboardDetailDrawer";
import { HidranteManutencaoModal, type HidranteManutencaoModalKey } from "./HidranteVencimentoSection";
import { filtrarPorEmpresa, type EmpresaTab } from "@/lib/dashboard/empresa-filter";
import {
  dataNivel2NaFaixa,
  diasRestantesNivel2,
  faixaDateRangeLabel,
  nivel3VenceNoMesmoAnoQueNivel2,
  startOfTodayLocal,
  type ManutencaoAlertaKey,
} from "@/lib/dashboard/manutencao-nivel2";

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
  return <span className="dash-nivel3">3º nível vence este ano</span>;
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
  const showManutencao = modalKey !== "semPosicao";
  const today = startOfTodayLocal();

  return (
    <DashboardDetailDrawer
      title={meta.title}
      subtitle={meta.subtitle}
      periodLabel={dateRangeLabel}
      countLabel={`${items.length} extintor${items.length !== 1 ? "es" : ""}`}
      onClose={onClose}
      onExcel={items.length > 0 ? () => exportAlertasVencimento(items, meta.exportLabel, ALERTA_EXPORT_HIGHLIGHT[modalKey]) : undefined}
      onPdf={items.length > 0 ? () => exportAlertasExtintoresPdf(items, meta.title) : undefined}
    >
      {items.length === 0 ? (
        <p className="dash-drawer__empty">Nenhum extintor nesta categoria.</p>
      ) : (
        <ul className="dash-equip-list">
          {items.map((extintor) => {
            const days = showManutencao ? diasRestantesNivel2(extintor.manutencao_2_nivel, today) : null;
            return (
              <li key={extintor.id} className="dash-equip">
                <div className="dash-equip__top">
                  <p className="dash-equip__id">{formatEquipmentIdentifier("extintor", extintor.codigo)}</p>
                  {showManutencao ? <RemainingDaysBadge days={days} /> : null}
                </div>
                <p className="dash-equip__type">
                  {extintor.tipo}
                  {extintor.tamanho ? ` · ${extintor.tamanho}` : ""}
                </p>
                <p className="dash-equip__place">{extintor.pavimento?.trim() || extintor.setor || "—"}</p>
                {extintor.local_detalhado ? <p className="dash-equip__detail">{extintor.local_detalhado}</p> : null}
                {showManutencao ? (
                  <dl className="dash-equip__meta">
                    <div>
                      <dt>Manutenção 2º nível</dt>
                      <dd>{formatDatePt(extintor.manutencao_2_nivel)}</dd>
                    </div>
                    <div>
                      <dt>Manutenção 3º nível</dt>
                      <dd>
                        {formatDatePt(extintor.manutencao_3_nivel)}
                        <Nivel3AvisoBadge extintor={extintor} />
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="dash-equip__detail">{extintor.capacidade_extintora || "Sem posição no mapa"}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardDetailDrawer>
  );
}

function NcDetailModal({
  extintores,
  hidrantes,
  onClose,
}: {
  extintores: { e: ExtintorRow; u: ChecklistExtintorMesRow }[];
  hidrantes: { h: HidranteVencimentoRow; u: ChecklistHidranteMesRow }[];
  onClose: () => void;
}) {
  const total = extintores.length + hidrantes.length;
  return (
    <DashboardDetailDrawer
      title="Itens não conformes"
      subtitle="Última conferência do mês, incluindo vencidos no recorte atual."
      countLabel={`${total} item${total !== 1 ? "ns" : ""}`}
      onClose={onClose}
    >
      <section className="dash-drawer__group">
        <h3>Extintores ({extintores.length})</h3>
        {extintores.length === 0 ? (
          <p className="dash-drawer__empty">Nenhum extintor não conforme neste mês.</p>
        ) : (
          <ul className="dash-equip-list">
            {extintores.map(({ e, u }) => (
              <li key={e.id} className="dash-equip">
                <p className="dash-equip__id">{formatEquipmentIdentifier("extintor", e.codigo)}</p>
                <p className="dash-equip__type">{`${e.tipo}${e.tamanho ? ` · ${e.tamanho}` : ""}`}</p>
                <p className="dash-equip__place">{e.setor || "—"}</p>
                {e.local_detalhado ? <p className="dash-equip__detail">{e.local_detalhado}</p> : null}
                <p className="dash-equip__detail">{new Date(u.data_conferencia).toLocaleString("pt-BR")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="dash-drawer__group">
        <h3>Hidrantes ({hidrantes.length})</h3>
        {hidrantes.length === 0 ? (
          <p className="dash-drawer__empty">Nenhum hidrante não conforme neste mês.</p>
        ) : (
          <ul className="dash-equip-list">
            {hidrantes.map(({ h, u }) => (
              <li key={h.id} className="dash-equip">
                <p className="dash-equip__id">{formatEquipmentIdentifier("hidrante", h.codigo)}</p>
                <p className="dash-equip__type">Hidrante</p>
                <p className="dash-equip__place">{h.pavimento || "—"}</p>
                {h.local_detalhado ? <p className="dash-equip__detail">{h.local_detalhado}</p> : null}
                <p className="dash-equip__detail">{new Date(u.data_conferencia).toLocaleString("pt-BR")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardDetailDrawer>
  );
}

export default function AdminDashboardPage() {
  const { ready, activeBaseId, activeBase, profile } = useActiveBase();
  const showEmpresaTabs = baseHasEmpresaTabs(activeBase);
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [checklistsExtMes, setChecklistsExtMes] = useState<ChecklistExtintorMesRow[]>([]);
  const [hidrantes, setHidrantes] = useState<HidranteVencimentoRow[]>([]);
  const [checklistsHidMes, setChecklistsHidMes] = useState<ChecklistHidranteMesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [manutencaoModal, setManutencaoModal] = useState<ManutencaoModalKey | null>(null);
  const [hidModal, setHidModal] = useState<HidranteManutencaoModalKey | null>(null);
  const [ncOpen, setNcOpen] = useState(false);
  const [empresaTab, setEmpresaTab] = useState<EmpresaTab>("santa_genoveva");
  const supabase = useMemo(() => getSupabaseClient(), []);

  const mesAtualRange = useMemo(() => getLocalCalendarMonthUtcIsoRange(), []);

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

  const hidBuckets = useMemo(
    () => computeHidranteVencimentoBuckets(hidrantesVisiveis, today),
    [hidrantesVisiveis, today],
  );

  const hidModalItems = useMemo(() => {
    if (!hidModal) return [];
    if (hidModal === "vencidos") return hidBuckets.vencidosList;
    if (hidModal === "alerta30") return hidBuckets.alerta30List;
    if (hidModal === "alerta60") return hidBuckets.alerta60List;
    if (hidModal === "alerta90") return hidBuckets.alerta90List;
    if (hidModal === "alerta120") return hidBuckets.alerta120List;
    return hidBuckets.semPosicaoList;
  }, [hidModal, hidBuckets]);

  const inspecoesMes = useMemo(() => {
    const extIds = new Set(extintoresVisiveis.map((item) => item.id));
    const hidIds = new Set(hidrantesVisiveis.map((item) => item.id));
    return (
      checklistsExtMes.filter((row) => extIds.has(row.extintor_id)).length +
      checklistsHidMes.filter((row) => hidIds.has(row.hidrante_id)).length
    );
  }, [checklistsExtMes, checklistsHidMes, extintoresVisiveis, hidrantesVisiveis]);

  const faixas = useMemo<DashFaixa[]>(
    () => [
      { key: "alerta30", label: "30 dias", value: stats.alerta30, onClick: () => setManutencaoModal("alerta30") },
      { key: "alerta60", label: "60 dias", value: stats.alerta60, onClick: () => setManutencaoModal("alerta60") },
      { key: "alerta90", label: "90 dias", value: stats.alerta90, onClick: () => setManutencaoModal("alerta90") },
      { key: "alerta120", label: "120 dias", value: stats.alerta120, onClick: () => setManutencaoModal("alerta120") },
      { key: "alerta180", label: "180 dias", value: stats.alerta180, onClick: () => setManutencaoModal("alerta180") },
      { key: "alerta360", label: "360 dias", value: stats.alerta360, onClick: () => setManutencaoModal("alerta360") },
      { key: "semPosicao", label: "Sem posição", value: stats.semPosicao, onClick: () => setManutencaoModal("semPosicao") },
    ],
    [stats],
  );

  const alerts = useMemo<DashAlert[]>(() => {
    const items: DashAlert[] = [];
    const naoConformidades = extintorConferenciaMes.naoConforme + hidranteConferenciaMes.naoConforme;
    if (naoConformidades > 0) {
      items.push({
        key: "nc",
        label: "Itens não conformes",
        count: naoConformidades,
        tone: "bad",
        onClick: () => setNcOpen(true),
      });
    }
    if (stats.vencidos > 0) {
      items.push({
        key: "ext-vencidos",
        label: "Extintores vencidos",
        count: stats.vencidos,
        tone: "bad",
        onClick: () => setManutencaoModal("vencidos"),
      });
    }
    if (hidBuckets.stats.vencidos > 0) {
      items.push({
        key: "hid-vencidos",
        label: "Hidrantes vencidos",
        count: hidBuckets.stats.vencidos,
        tone: "bad",
        onClick: () => setHidModal("vencidos"),
      });
    }
    const ate30 = stats.alerta30 + hidBuckets.stats.alerta30;
    if (ate30 > 0) {
      items.push({
        key: "d30",
        label: "Vencem em até 30 dias",
        count: ate30,
        tone: "warn",
        onClick: () => {
          if (stats.alerta30 > 0) setManutencaoModal("alerta30");
          else setHidModal("alerta30");
        },
      });
    }
    const semPosicao = stats.semPosicao + hidBuckets.stats.semPosicao;
    if (semPosicao > 0) {
      items.push({
        key: "sem-posicao",
        label: "Equipamentos sem posição",
        count: semPosicao,
        tone: "slate",
        onClick: () => {
          if (stats.semPosicao > 0) setManutencaoModal("semPosicao");
          else setHidModal("semPosicao");
        },
      });
    }
    const proximas = stats.alerta60 + stats.alerta90;
    if (proximas > 0) {
      items.push({
        key: "proximas",
        label: "Manutenções próximas",
        count: proximas,
        tone: "warn",
        onClick: () => setManutencaoModal(stats.alerta60 > 0 ? "alerta60" : "alerta90"),
      });
    }
    return items;
  }, [extintorConferenciaMes.naoConforme, hidranteConferenciaMes.naoConforme, hidBuckets.stats, stats]);

  const upcoming = useMemo<DashUpcoming[]>(() => {
    const ranked: { row: DashUpcoming; sort: number }[] = [];
    for (const extintor of extintoresVisiveis) {
      const dias = diasRestantesNivel2(extintor.manutencao_2_nivel, today);
      if (dias === null) continue;
      ranked.push({
        sort: dias,
        row: {
          id: `e-${extintor.id}`,
          codigo: formatEquipmentIdentifier("extintor", extintor.codigo),
          tipo: `${extintor.tipo}${extintor.tamanho ? ` ${extintor.tamanho}` : ""}`.trim(),
          local: extintor.setor || extintor.local_detalhado || "—",
          vencimento: formatDateOnlyPt(extintor.manutencao_2_nivel),
          dias: dias < 0 ? `${Math.abs(dias)}d` : `${dias}d`,
          status: dias < 0 ? "Vencido" : "Próximo",
        },
      });
    }
    for (const hidrante of hidrantesVisiveis) {
      const dias = diasRestantesMangueiraCritica(hidrante);
      if (dias === null) continue;
      const vencimento = earliestVencimentoMangueira(hidrante);
      ranked.push({
        sort: dias,
        row: {
          id: `h-${hidrante.id}`,
          codigo: formatEquipmentIdentifier("hidrante", hidrante.codigo),
          tipo: "Hidrante",
          local: hidrante.pavimento || hidrante.local_detalhado || "—",
          vencimento: formatDateOnlyPt(vencimento),
          dias: dias < 0 ? `${Math.abs(dias)}d` : `${dias}d`,
          status: dias < 0 ? "Vencido" : "Próximo",
        },
      });
    }
    return ranked.sort((a, b) => a.sort - b.sort).slice(0, 5).map((item) => item.row);
  }, [extintoresVisiveis, hidrantesVisiveis, today]);

  const recent = useMemo<DashRecent[]>(() => {
    const extById = new Map(extintoresVisiveis.map((item) => [item.id, item]));
    const hidById = new Map(hidrantesVisiveis.map((item) => [item.id, item]));
    const ranked: { rec: DashRecent; at: string }[] = [];
    for (const row of checklistsExtMes) {
      const extintor = extById.get(row.extintor_id);
      if (!extintor) continue;
      ranked.push({
        at: row.data_conferencia,
        rec: {
          id: `e-${row.extintor_id}-${row.data_conferencia}`,
          codigo: formatEquipmentIdentifier("extintor", extintor.codigo),
          meta: `${extintor.tipo}${extintor.tamanho ? ` ${extintor.tamanho}` : ""}`.trim(),
          local: formatLocalLinha(extintor.setor, extintor.local_detalhado),
          when: new Date(row.data_conferencia).toLocaleString("pt-BR"),
          ok: !checklistTemNaoConformidade(row),
        },
      });
    }
    for (const row of checklistsHidMes) {
      const hidrante = hidById.get(row.hidrante_id);
      if (!hidrante) continue;
      ranked.push({
        at: row.data_conferencia,
        rec: {
          id: `h-${row.hidrante_id}-${row.data_conferencia}`,
          codigo: formatEquipmentIdentifier("hidrante", hidrante.codigo),
          meta: "Hidrante",
          local: formatLocalLinha(hidrante.pavimento ?? "", hidrante.local_detalhado),
          when: new Date(row.data_conferencia).toLocaleString("pt-BR"),
          ok: !hidranteChecklistTemNaoConformidade(row as Record<string, string | null>),
        },
      });
    }
    return ranked.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8).map((item) => item.rec);
  }, [checklistsExtMes, checklistsHidMes, extintoresVisiveis, hidrantesVisiveis]);

  const quickLinks = useMemo(() => {
    if (!profile?.role) return [];
    const visible = getVisibleNavItems(ALL_NAV_ITEMS, profile.role);
    const wanted = [
      "/admin/inspecoes-lista",
      "/admin/importacao",
      "/admin/usuarios",
      "/admin/bases",
      "/admin/configuracoes",
    ];
    return wanted
      .map((href) => visible.find((item) => item.href === href))
      .filter((item): item is (typeof visible)[number] => Boolean(item));
  }, [profile]);

  const hidroEmDia = Math.max(
    0,
    hidBuckets.stats.total
      - hidBuckets.stats.vencidos
      - hidBuckets.stats.alerta30
      - hidBuckets.stats.alerta60
      - hidBuckets.stats.alerta90
      - hidBuckets.stats.alerta120,
  );

  function openUpcomingDetails() {
    if (stats.vencidos > 0) setManutencaoModal("vencidos");
    else if (hidBuckets.stats.vencidos > 0) setHidModal("vencidos");
    else if (stats.alerta30 > 0) setManutencaoModal("alerta30");
    else if (hidBuckets.stats.alerta30 > 0) setHidModal("alerta30");
    else setManutencaoModal("alerta60");
  }

  if (!ready || !activeBaseId || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--neon)] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <DashboardHome
        mesLegenda={mesLegenda}
        showEmpresaTabs={showEmpresaTabs}
        empresaTab={empresaTab}
        onEmpresaTab={(tab) => {
          setEmpresaTab(tab);
          setManutencaoModal(null);
          setHidModal(null);
          setNcOpen(false);
        }}
        onRefresh={() => void loadDashboard()}
        kpis={{
          extintores: stats.total,
          hidrantes: hidBuckets.stats.total,
          inspecoesMes,
          naoConformidades: extintorConferenciaMes.naoConforme + hidranteConferenciaMes.naoConforme,
          vencidos: stats.vencidos + hidBuckets.stats.vencidos,
        }}
        onNcClick={() => setNcOpen(true)}
        onVencidosClick={() => {
          if (stats.vencidos > 0) setManutencaoModal("vencidos");
          else setHidModal("vencidos");
        }}
        faixas={faixas}
        extStatus={extintorConferenciaMes}
        hidStatus={hidranteConferenciaMes}
        hidro={{
          vencido: hidBuckets.stats.vencidos,
          d30: hidBuckets.stats.alerta30,
          d60: hidBuckets.stats.alerta60,
          d90: hidBuckets.stats.alerta90,
          d120: hidBuckets.stats.alerta120,
          emDia: hidroEmDia,
          total: hidBuckets.stats.total,
        }}
        onHydroSelect={(bucket) => {
          const map = {
            vencido: "vencidos",
            d30: "alerta30",
            d60: "alerta60",
            d90: "alerta90",
            d120: "alerta120",
          } as const;
          setHidModal(map[bucket]);
        }}
        alerts={alerts}
        upcoming={upcoming}
        onSeeUpcoming={openUpcomingDetails}
        recent={recent}
        quickLinks={quickLinks}
        extSemPosicao={stats.semPosicao}
        hidSemPosicao={hidBuckets.stats.semPosicao}
      />

      {manutencaoModal ? (
        <ExtintorManutencaoModal
          modalKey={manutencaoModal}
          items={manutencaoModalItems}
          dateRangeLabel={manutencaoModalRange}
          onClose={() => setManutencaoModal(null)}
        />
      ) : null}

      {hidModal ? (
        <HidranteManutencaoModal
          modalKey={hidModal}
          items={hidModalItems}
          onClose={() => setHidModal(null)}
        />
      ) : null}

      {ncOpen ? (
        <NcDetailModal
          extintores={extintoresNcMes}
          hidrantes={hidrantesNcMes}
          onClose={() => setNcOpen(false)}
        />
      ) : null}
    </>
  );
}
