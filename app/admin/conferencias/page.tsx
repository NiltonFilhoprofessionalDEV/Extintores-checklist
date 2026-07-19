"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  EQUIPES_CONFERENCIA,
  codigoPertenceEquipe,
  type EquipeConferenciaId,
} from "@/lib/equipes/conferencia-filtro";
import {
  exportConferenciasHistorico,
  type ConferenciaHistoricoExtintorRow,
  type ConferenciaHistoricoHidranteRow,
} from "@/lib/export/excel";
import { exportConferenciasPdf } from "@/lib/export/pdf";
import {
  resolveExtintorConferenciaExport,
  resolveHidranteConferenciaExport,
  type ConferenciaExportStatus,
} from "@/lib/export/conferencia-historico";
import type { TipoEquipamento } from "@/lib/inventario/equipamento-padrao";
import type { HidranteVencimentoRow } from "@/lib/hidrantes/vencimento-mangueiras";
import {
  fetchConferenciasHistorico,
  resolveExtintorFromRow,
  resolveHidranteFromRow,
  type ExtintorLookupRow,
  type HidranteLookupRow,
} from "@/lib/supabase/conferencias-historico-fetch";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { baseHasEquipesConferencia } from "@/lib/auth/bases";
import InventarioTipoTabs from "@/src/components/InventarioTipoTabs";
import ExportActions from "@/src/components/ExportActions";
import ConferenciaFilterModal from "./ConferenciaFilterModal";
import {
  ConferenciaCard,
  ConferenciaDetailModal,
  type ConferenciaItem,
} from "./ConferenciaResults";

function equipeLabelForCodigo(codigo: string, tipo: TipoEquipamento): string {
  for (const eq of EQUIPES_CONFERENCIA) {
    if (codigoPertenceEquipe(codigo, eq.id, tipo)) return eq.label;
  }
  return "";
}

function startOfDayIso(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function endOfDayIso(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T23:59:59.999`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDateInputLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDatasPadraoMesVigente(): { inicio: string; fim: string } {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return {
    inicio: formatDateInputLocal(inicioMes),
    fim: formatDateInputLocal(hoje),
  };
}

type FiltroStatusConferencia = ConferenciaExportStatus | "";

const OPCOES_FILTRO_STATUS: { value: FiltroStatusConferencia; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "conforme", label: "Conforme" },
  { value: "alerta", label: "Não conforme" },
  { value: "vencido", label: "Vencido" },
];

function montarSufixoExportacaoArquivo(
  filtroEquipe: EquipeConferenciaId | "",
  dataInicio: string,
  dataFim: string,
  busca: string,
  filtroStatus: FiltroStatusConferencia,
): string {
  const partes: string[] = [];
  if (filtroEquipe) partes.push(filtroEquipe);
  if (filtroStatus) partes.push(filtroStatus);
  if (dataInicio) partes.push(`de_${dataInicio}`);
  if (dataFim) partes.push(`ate_${dataFim}`);
  if (busca.trim()) partes.push("busca");
  return partes.join("_");
}

function formatarDataFiltro(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("pt-BR");
}

function IconeBusca() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconeEquipe() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default function AdminConferenciasPage() {
  const { ready, activeBaseId, activeBase } = useActiveBase();
  const showEquipeFilter = baseHasEquipesConferencia(activeBase);
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [rows, setRows] = useState<ConferenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoLista, setTipoLista] = useState<TipoEquipamento>("extintor");
  const [filtroEquipe, setFiltroEquipe] = useState<EquipeConferenciaId | "">("");
  const [dataInicio, setDataInicio] = useState(() => getDatasPadraoMesVigente().inicio);
  const [dataFim, setDataFim] = useState(() => getDatasPadraoMesVigente().fim);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusConferencia>("");
  const [exportando, setExportando] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ConferenciaItem | null>(null);
  const extintorLookupRef = useRef<Map<string, ExtintorLookupRow>>(new Map());
  const hidranteLookupRef = useRef<Map<string, HidranteLookupRow>>(new Map());
  const datasEditadasPeloUsuarioRef = useRef(false);

  const loadConferencias = useCallback(async () => {
    if (!ready || !activeBaseId) return;
    setLoading(true);
    setLoadError(null);

    const { extintorRows, hidranteRows, extintorLookup, hidranteLookup, errors } =
      await fetchConferenciasHistorico(supabase, activeBaseId);

    extintorLookupRef.current = extintorLookup;
    hidranteLookupRef.current = hidranteLookup;

    const mapped: ConferenciaItem[] = [];

    for (const item of extintorRows) {
      const ext = resolveExtintorFromRow(item, extintorLookup);
      const checklistRaw = { ...item };
      const manutencao_2_nivel = ext?.manutencao_2_nivel ?? null;
      const manutencao_3_nivel = ext?.manutencao_3_nivel ?? null;
      const { status, observacao } = resolveExtintorConferenciaExport(
        checklistRaw,
        manutencao_2_nivel,
        manutencao_3_nivel,
      );
      mapped.push({
        id: String(item.id ?? ""),
        tipo: "extintor",
        data_conferencia: String(item.data_conferencia ?? ""),
        conferente: String(item.conferente ?? ""),
        codigo: ext?.codigo ?? `ID ${String(item.extintor_id ?? "").slice(0, 8)}`,
        setor: ext?.setor ?? "",
        local_detalhado: ext?.local_detalhado ?? "",
        tipoEquip: ext?.tipo ?? "",
        tamanho: ext?.tamanho ?? "",
        manutencao_2_nivel,
        manutencao_3_nivel: ext?.manutencao_3_nivel ?? null,
        hidrante: null,
        checklistRaw,
        exportStatus: status,
        observacaoExibicao: observacao,
      });
    }

    for (const item of hidranteRows) {
      const hid = resolveHidranteFromRow(item, hidranteLookup);
      const hidrante: HidranteVencimentoRow | null = hid
        ? {
            id: hid.id,
            codigo: hid.codigo,
            pavimento: hid.pavimento,
            local_detalhado: hid.local_detalhado,
            quantidade_mangueiras: hid.quantidade_mangueiras,
            teste_hidrostatico_m1: hid.teste_hidrostatico_m1,
            teste_hidrostatico_m2: hid.teste_hidrostatico_m2,
            teste_hidrostatico_m3: hid.teste_hidrostatico_m3,
            teste_hidrostatico_m4: hid.teste_hidrostatico_m4,
            quantidade_chaves_storz: hid.quantidade_chaves_storz ?? null,
            quantidade_esguichos: hid.quantidade_esguichos ?? null,
            coord_x: null,
            coord_y: null,
          }
        : null;
      const checklistRaw = { ...item };
      const { status, observacao } = resolveHidranteConferenciaExport(checklistRaw, hidrante);
      mapped.push({
        id: String(item.id ?? ""),
        tipo: "hidrante",
        data_conferencia: String(item.data_conferencia ?? ""),
        conferente: String(item.conferente ?? ""),
        codigo: hid?.codigo ?? `ID ${String(item.hidrante_id ?? "").slice(0, 8)}`,
        setor: "",
        local_detalhado: hid?.local_detalhado ?? "",
        pavimento: hid?.pavimento ?? "",
        manutencao_2_nivel: null,
        manutencao_3_nivel: null,
        hidrante,
        checklistRaw,
        exportStatus: status,
        observacaoExibicao: observacao,
      });
    }

    mapped.sort(
      (a, b) => new Date(b.data_conferencia).getTime() - new Date(a.data_conferencia).getTime(),
    );
    setRows(mapped);
    if (errors.length > 0) {
      setLoadError(errors.join(" "));
    }
    setLoading(false);
  }, [supabase, ready, activeBaseId]);

  useEffect(() => {
    if (!ready || !activeBaseId) return;
    const timer = window.setTimeout(() => {
      void loadConferencias();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConferencias, ready, activeBaseId]);

  useEffect(() => {
    function sincronizarDatasMesVigente() {
      const { inicio, fim } = getDatasPadraoMesVigente();
      setDataInicio(inicio);
      setDataFim(fim);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && !datasEditadasPeloUsuarioRef.current) {
        sincronizarDatasMesVigente();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const filteredBase = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const startIso = startOfDayIso(dataInicio);
    const endIso = endOfDayIso(dataFim);

    return rows.filter((item) => {
      if (
        showEquipeFilter &&
        filtroEquipe &&
        !codigoPertenceEquipe(item.codigo, filtroEquipe, item.tipo)
      ) {
        return false;
      }

      if (filtroStatus && item.exportStatus !== filtroStatus) {
        return false;
      }

      if (startIso || endIso) {
        const t = new Date(item.data_conferencia).getTime();
        if (startIso && t < new Date(startIso).getTime()) return false;
        if (endIso && t > new Date(endIso).getTime()) return false;
      }

      if (!q) return true;

      const text = [
        item.conferente,
        item.codigo,
        item.setor,
        item.local_detalhado,
        item.tipoEquip ?? "",
        item.pavimento ?? "",
        item.observacaoExibicao,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [rows, busca, showEquipeFilter, filtroEquipe, filtroStatus, dataInicio, dataFim]);

  const filteredExt = useMemo(
    () => filteredBase.filter((r) => r.tipo === "extintor"),
    [filteredBase],
  );
  const filteredHid = useMemo(
    () => filteredBase.filter((r) => r.tipo === "hidrante"),
    [filteredBase],
  );
  const visiveis = tipoLista === "extintor" ? filteredExt : filteredHid;
  const totalExportacao = filteredExt.length + filteredHid.length;

  const extCount = filteredExt.length;
  const hidCount = filteredHid.length;
  const datasPadraoMes = getDatasPadraoMesVigente();
  const datasPersonalizadas =
    dataInicio !== datasPadraoMes.inicio || dataFim !== datasPadraoMes.fim;
  const filtrosAvancadosAtivos = [
    Boolean(showEquipeFilter && filtroEquipe),
    Boolean(filtroStatus),
    datasPersonalizadas,
  ].filter(Boolean).length;
  const temFiltrosAtivos = Boolean(
    (showEquipeFilter && filtroEquipe) || filtroStatus || datasPersonalizadas || busca.trim(),
  );
  const totalTipoAtual =
    tipoLista === "extintor"
      ? rows.filter((r) => r.tipo === "extintor").length
      : rows.filter((r) => r.tipo === "hidrante").length;

  const equipeLabelAtiva = filtroEquipe
    ? (EQUIPES_CONFERENCIA.find((eq) => eq.id === filtroEquipe)?.label ?? filtroEquipe)
    : "";

  const statusLabelAtivo =
    OPCOES_FILTRO_STATUS.find((op) => op.value === filtroStatus)?.label ?? "";

  function limparFiltros() {
    const { inicio, fim } = getDatasPadraoMesVigente();
    datasEditadasPeloUsuarioRef.current = false;
    setBusca("");
    setFiltroEquipe("");
    setFiltroStatus("");
    setDataInicio(inicio);
    setDataFim(fim);
  }

  function handleExport(format: "excel" | "pdf") {
    setExportando(true);
    try {
      const ext: ConferenciaHistoricoExtintorRow[] = filteredExt.map((item) => {
        const cadastro = resolveExtintorFromRow(item.checklistRaw, extintorLookupRef.current);
        return {
          id: item.id,
          data_conferencia: item.data_conferencia,
          conferente: item.conferente,
          codigo: item.codigo,
          setor: item.setor,
          local_detalhado: item.local_detalhado,
          tipo: item.tipoEquip ?? "",
          tamanho: item.tamanho ?? "",
          equipe: equipeLabelForCodigo(item.codigo, "extintor"),
          manutencao_2_nivel: cadastro?.manutencao_2_nivel ?? item.manutencao_2_nivel,
          manutencao_3_nivel: cadastro?.manutencao_3_nivel ?? item.manutencao_3_nivel,
          checklistRaw: item.checklistRaw,
          observacao: item.observacaoExibicao,
          exportStatus: item.exportStatus,
        };
      });

      const hid: ConferenciaHistoricoHidranteRow[] = filteredHid.map((item) => {
        const cadastro = resolveHidranteFromRow(item.checklistRaw, hidranteLookupRef.current);
        const hidranteExport: HidranteVencimentoRow | null = cadastro
          ? {
              id: cadastro.id,
              codigo: cadastro.codigo,
              pavimento: cadastro.pavimento,
              local_detalhado: cadastro.local_detalhado,
              quantidade_mangueiras: cadastro.quantidade_mangueiras,
              teste_hidrostatico_m1: cadastro.teste_hidrostatico_m1,
              teste_hidrostatico_m2: cadastro.teste_hidrostatico_m2,
              teste_hidrostatico_m3: cadastro.teste_hidrostatico_m3,
              teste_hidrostatico_m4: cadastro.teste_hidrostatico_m4,
              quantidade_chaves_storz: cadastro.quantidade_chaves_storz,
              quantidade_esguichos: cadastro.quantidade_esguichos,
              coord_x: null,
              coord_y: null,
            }
          : item.hidrante;

        return {
          id: item.id,
          data_conferencia: item.data_conferencia,
          conferente: item.conferente,
          codigo: item.codigo,
          pavimento: item.pavimento ?? "",
          local_detalhado: item.local_detalhado,
          equipe: equipeLabelForCodigo(item.codigo, "hidrante"),
          hidrante: hidranteExport,
          checklistRaw: item.checklistRaw,
          observacao: item.observacaoExibicao,
          exportStatus: item.exportStatus,
        };
      });

      const sufixo = montarSufixoExportacaoArquivo(
        showEquipeFilter ? filtroEquipe : "",
        dataInicio,
        dataFim,
        busca,
        filtroStatus,
      );
      if (format === "pdf") {
        exportConferenciasPdf(ext, hid, "Histórico de conferências");
      } else {
        exportConferenciasHistorico(ext, hid, sufixo ? { sufixoArquivo: sufixo } : undefined);
      }
    } finally {
      setExportando(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="page-hero p-6">
        <div className="page-hero-content flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--neon)]">Histórico</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Conferências realizadas</h2>
            <p className="mt-2 text-sm font-medium text-slate-300">
              Consulte extintores e hidrantes separadamente. Os relatórios respeitam todos os filtros aplicados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadConferencias()}
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
            >
              Atualizar
            </button>
            <ExportActions
              tone="dark"
              disabled={exportando || totalExportacao === 0}
              excelLabel={exportando ? "Exportando…" : "Excel"}
              onExcel={() => handleExport("excel")}
              onPdf={() => handleExport("pdf")}
            />
          </div>
        </div>
      </div>

      <InventarioTipoTabs
        value={tipoLista}
        onChange={setTipoLista}
        extintoresCount={extCount}
        hidrantesCount={hidCount}
      />

      {loadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Aviso ao carregar:</span> {loadError}
        </div>
      )}

      <div className="professional-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1" htmlFor="filtro-busca">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
              <IconeBusca />
            </span>
            <input
              id="filtro-busca"
              type="search"
              placeholder="Buscar por código, local, conferente ou observação…"
              className="field-control !rounded-xl !py-2.5 !pl-11"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => setFilterModalOpen(true)}
            className="relative inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--orange)] hover:text-[var(--orange-deep)]"
          >
            <IconeEquipe />
            Filtros
            {filtrosAvancadosAtivos > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--orange)] px-1 text-[10px] text-white">
                {filtrosAvancadosAtivos}
              </span>
            )}
          </button>
          <span className="hidden whitespace-nowrap px-1 text-xs font-semibold text-slate-500 md:inline">
            {loading ? "Carregando…" : `${visiveis.length} de ${totalTipoAtual}`}
          </span>
          {temFiltrosAtivos && (
            <button
              type="button"
              onClick={limparFiltros}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-[var(--muted)] hover:text-slate-700"
              aria-label="Limpar filtros"
              title="Limpar filtros"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {filtrosAvancadosAtivos > 0 && !loading && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2">
            {showEquipeFilter && filtroEquipe && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                {equipeLabelAtiva}
                <button
                  type="button"
                  onClick={() => setFiltroEquipe("")}
                  className="rounded-full p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-800"
                  aria-label="Remover filtro de equipe"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filtroStatus && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  filtroStatus === "vencido"
                    ? "border-red-200 bg-red-50 text-red-900"
                    : filtroStatus === "alerta"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-green-200 bg-green-50 text-green-900"
                }`}
              >
                {statusLabelAtivo}
                <button
                  type="button"
                  onClick={() => setFiltroStatus("")}
                  className="rounded-full p-0.5 opacity-60 hover:opacity-100"
                  aria-label="Remover filtro de status"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {dataInicio !== datasPadraoMes.inicio && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                De {formatarDataFiltro(dataInicio)}
                <button
                  type="button"
                  onClick={() => {
                    setDataInicio(datasPadraoMes.inicio);
                    datasEditadasPeloUsuarioRef.current =
                      dataFim !== getDatasPadraoMesVigente().fim;
                  }}
                  className="rounded-full p-0.5 text-amber-500 hover:bg-amber-100 hover:text-amber-800"
                  aria-label="Restaurar data inicial do mês vigente"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {dataFim !== datasPadraoMes.fim && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                Até {formatarDataFiltro(dataFim)}
                <button
                  type="button"
                  onClick={() => {
                    setDataFim(datasPadraoMes.fim);
                    datasEditadasPeloUsuarioRef.current =
                      dataInicio !== getDatasPadraoMesVigente().inicio;
                  }}
                  className="rounded-full p-0.5 text-amber-500 hover:bg-amber-100 hover:text-amber-800"
                  aria-label="Restaurar data final de hoje"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="professional-card p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="page-eyebrow">Relatórios de inspeção</p>
            <h2 className="mt-1 text-xl font-extrabold text-[var(--ink)]">
              {tipoLista === "extintor" ? "Extintores inspecionados" : "Hidrantes inspecionados"}
            </h2>
          </div>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-bold text-slate-600">
            {visiveis.length} {visiveis.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm font-semibold text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--orange)] border-t-transparent" />
            Carregando conferências…
          </div>
        ) : visiveis.length === 0 ? (
          <div className="rounded-2xl bg-[var(--muted)] px-5 py-10 text-center">
            <p className="font-bold text-[var(--ink)]">Nenhuma inspeção encontrada</p>
            <p className="mt-1 text-sm text-slate-500">Ajuste a busca ou os filtros para ver outros resultados.</p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {visiveis.map((item) => (
              <ConferenciaCard
                key={`${item.tipo}-${item.id}`}
                item={item}
                teamLabel={equipeLabelForCodigo(item.codigo, item.tipo)}
                onOpen={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      <ConferenciaFilterModal
        open={filterModalOpen}
        showEquipeFilter={showEquipeFilter}
        filtroEquipe={filtroEquipe}
        filtroStatus={filtroStatus}
        dataInicio={dataInicio}
        dataFim={dataFim}
        resultCount={visiveis.length}
        onEquipeChange={setFiltroEquipe}
        onStatusChange={setFiltroStatus}
        onDataInicioChange={(value) => {
          datasEditadasPeloUsuarioRef.current = true;
          setDataInicio(value);
        }}
        onDataFimChange={(value) => {
          datasEditadasPeloUsuarioRef.current = true;
          setDataFim(value);
        }}
        onClear={limparFiltros}
        onClose={() => setFilterModalOpen(false)}
      />

      {selectedItem && (
        <ConferenciaDetailModal
          item={selectedItem}
          teamLabel={equipeLabelForCodigo(selectedItem.codigo, selectedItem.tipo)}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </section>
  );
}
