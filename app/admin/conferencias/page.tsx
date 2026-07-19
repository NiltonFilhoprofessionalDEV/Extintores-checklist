"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  resolveExtintorConferenciaExport,
  resolveHidranteConferenciaExport,
  type ConferenciaExportStatus,
} from "@/lib/export/conferencia-historico";
import {
  COLUNAS_PADRAO,
  subtituloLocalExtintor,
  subtituloLocalHidrante,
  tituloEquipamento,
  type TipoEquipamento,
} from "@/lib/inventario/equipamento-padrao";
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

type ConferenciaItem = {
  id: string;
  tipo: TipoEquipamento;
  data_conferencia: string;
  conferente: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  tipoEquip?: string;
  tamanho?: string;
  pavimento?: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  hidrante: HidranteVencimentoRow | null;
  checklistRaw: Record<string, unknown>;
  exportStatus: ConferenciaExportStatus;
  observacaoExibicao: string;
};

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

function cardClassByStatus(status: ConferenciaExportStatus): string {
  if (status === "vencido") return "border-red-300 bg-red-100/90";
  if (status === "alerta") return "border-amber-200 bg-amber-50/90";
  return "border-slate-100 bg-slate-50/70";
}

function statusBadge(status: ConferenciaExportStatus): { label: string; className: string } {
  if (status === "vencido") {
    return { label: "Vencido", className: "bg-red-100 text-red-800" };
  }
  if (status === "alerta") {
    return { label: "Atenção", className: "bg-amber-100 text-amber-900" };
  }
  return { label: "Conforme", className: "bg-green-100 text-green-800" };
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

function IconeCalendario() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

function IconeStatus() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

type FiltroCampoProps = {
  label: string;
  htmlFor: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

function FiltroCampo({ label, htmlFor, icon, children, className = "" }: FiltroCampoProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">{icon}</span>
        )}
        {children}
      </div>
    </div>
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
  const extintorLookupRef = useRef<Map<string, ExtintorLookupRow>>(new Map());
  const hidranteLookupRef = useRef<Map<string, HidranteLookupRow>>(new Map());
  const datasEditadasPeloUsuarioRef = useRef(false);

  useEffect(() => {
    if (!showEquipeFilter) setFiltroEquipe("");
  }, [showEquipeFilter]);

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
      if (filtroEquipe && !codigoPertenceEquipe(item.codigo, filtroEquipe, item.tipo)) {
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
  }, [rows, busca, filtroEquipe, filtroStatus, dataInicio, dataFim]);

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

  function handleExport() {
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
        filtroEquipe,
        dataInicio,
        dataFim,
        busca,
        filtroStatus,
      );
      exportConferenciasHistorico(ext, hid, sufixo ? { sufixoArquivo: sufixo } : undefined);
    } finally {
      setExportando(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="page-hero p-6">
        <div className="page-hero-content flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-red-200">Histórico</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Conferências realizadas</h2>
            <p className="mt-2 text-sm font-medium text-slate-300">
              Consulte extintores e hidrantes separadamente. O Excel sempre traz as duas planilhas (Extintores
              e Hidrantes), respeitando os filtros quando aplicados.
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
            <button
              type="button"
              onClick={handleExport}
              disabled={exportando || totalExportacao === 0}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-slate-100 disabled:opacity-50"
              title={
                totalExportacao === 0
                  ? "Nenhum registro com os filtros atuais"
                  : `Exportar ${filteredExt.length} extintor(es) e ${filteredHid.length} hidrante(s)`
              }
            >
              {exportando
                ? "Exportando…"
                : `Exportar Excel (${filteredExt.length} ext. + ${filteredHid.length} hid.)`}
            </button>
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

      <div className="section-card overflow-hidden">
        <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50 via-white to-red-50/50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E02020]/10 ring-1 ring-[#E02020]/15">
                <svg className="h-5 w-5 text-[#E02020]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight text-slate-900">Refinar resultados</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {loading
                    ? "Carregando conferências…"
                    : temFiltrosAtivos
                      ? `${visiveis.length} de ${totalTipoAtual} conferências nesta aba`
                      : `${totalTipoAtual} conferências nesta aba`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={limparFiltros}
              disabled={!temFiltrosAtivos}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-slate-100/80 disabled:text-slate-400 disabled:shadow-none"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-12">
          <FiltroCampo label="Busca" htmlFor="filtro-busca" icon={<IconeBusca />} className="lg:col-span-4">
            <input
              id="filtro-busca"
              type="search"
              placeholder="Código, local, conferente, observação…"
              className="field-control !pl-10"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </FiltroCampo>

          {showEquipeFilter && (
            <FiltroCampo label="Equipe" htmlFor="filtro-equipe" icon={<IconeEquipe />} className="lg:col-span-2">
              <select
                id="filtro-equipe"
                className="field-control appearance-none !pl-10"
                value={filtroEquipe}
                onChange={(event) => setFiltroEquipe(event.target.value as EquipeConferenciaId | "")}
              >
                <option value="">Todas as equipes</option>
                {EQUIPES_CONFERENCIA.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.label}
                  </option>
                ))}
              </select>
            </FiltroCampo>
          )}

          <FiltroCampo
            label="Status"
            htmlFor="filtro-status"
            icon={<IconeStatus />}
            className={showEquipeFilter ? "lg:col-span-2" : "lg:col-span-4"}
          >
            <select
              id="filtro-status"
              className="field-control appearance-none !pl-10"
              value={filtroStatus}
              onChange={(event) => setFiltroStatus(event.target.value as FiltroStatusConferencia)}
            >
              {OPCOES_FILTRO_STATUS.map((op) => (
                <option key={op.value || "todos"} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </FiltroCampo>

          <FiltroCampo label="Data inicial" htmlFor="filtro-data-inicio" icon={<IconeCalendario />} className="lg:col-span-2">
            <input
              id="filtro-data-inicio"
              type="date"
              className="field-control !pl-10"
              value={dataInicio}
              onChange={(e) => {
                datasEditadasPeloUsuarioRef.current = true;
                setDataInicio(e.target.value);
              }}
            />
          </FiltroCampo>

          <FiltroCampo label="Data final" htmlFor="filtro-data-fim" icon={<IconeCalendario />} className="lg:col-span-2">
            <input
              id="filtro-data-fim"
              type="date"
              className="field-control !pl-10"
              value={dataFim}
              onChange={(e) => {
                datasEditadasPeloUsuarioRef.current = true;
                setDataFim(e.target.value);
              }}
              min={dataInicio || undefined}
            />
          </FiltroCampo>
        </div>

        {temFiltrosAtivos && !loading && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ativos</span>
            {busca.trim() && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                Busca: &quot;{busca.trim()}&quot;
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Remover busca"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filtroEquipe && (
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
            <span className="ml-auto text-xs font-medium text-slate-500">
              Excel: {filteredExt.length} extintor(es) + {filteredHid.length} hidrante(s)
            </span>
          </div>
        )}
      </div>

      <div className="section-card p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando conferências...</p>
        ) : visiveis.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma conferência de {tipoLista === "extintor" ? "extintores" : "hidrantes"} encontrada.
          </p>
        ) : (
          <div className="space-y-3">
            {visiveis.map((item) => {
              const badge = statusBadge(item.exportStatus);
              return (
                <article
                  key={`${item.tipo}-${item.id}`}
                  className={`rounded-2xl border px-4 py-4 transition hover:shadow-sm ${cardClassByStatus(item.exportStatus)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{tituloEquipamento(item.codigo, item.tipo)}</p>
                    <p className="text-xs text-slate-500">
                      {item.data_conferencia
                        ? new Date(item.data_conferencia).toLocaleString("pt-BR")
                        : "-"}
                    </p>
                  </div>

                  <p className="mt-1 text-sm text-slate-600">
                    {item.tipo === "extintor"
                      ? subtituloLocalExtintor(item.setor, item.local_detalhado)
                      : subtituloLocalHidrante(item.pavimento ?? null, item.local_detalhado)}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {equipeLabelForCodigo(item.codigo, item.tipo) || "Equipe não definida"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {COLUNAS_PADRAO.conferente}: {item.conferente || "Não informado"}
                    </span>
                    {item.tipo === "extintor" && (item.tipoEquip || item.tamanho) && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                        {[item.tipoEquip, item.tamanho].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-slate-700">
                    <span className="font-semibold">{COLUNAS_PADRAO.observacao}:</span>
                    <p className="mt-1 whitespace-pre-line leading-relaxed">{item.observacaoExibicao}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
