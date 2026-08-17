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
import { fetchChecklistQuestionsForBase } from "@/lib/checklist/questions-client";
import type { ChecklistQuestion } from "@/lib/checklist/default-questions";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";
import InventarioTipoTabs from "@/src/components/InventarioTipoTabs";
import ExportActions from "@/src/components/ExportActions";
import ConferenciaCard from "./ConferenciaCard";
import ConferenciaDetailDrawer from "./ConferenciaDetailDrawer";
import ConferenciaFilterDrawer from "./ConferenciaFilterDrawer";
import {
  OPCOES_FILTRO_STATUS,
  detectarPeriodoPreset,
  filtrosPadraoMesVigente,
  getDatasPadraoMesVigente,
  labelPeriodo,
  type ConferenciaFiltrosDraft,
  type FiltroStatusConferencia,
} from "./conferencia-filtros";
import type { ConferenciaItem } from "./conferencia-view";

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

function montarSufixoExportacaoArquivo(
  filtroEquipe: EquipeConferenciaId | "",
  dataInicio: string,
  dataFim: string,
  busca: string,
  filtroStatus: FiltroStatusConferencia,
  filtroLocal: string,
  filtroConferente: string,
): string {
  const partes: string[] = [];
  if (filtroEquipe) partes.push(filtroEquipe);
  if (filtroStatus) partes.push(filtroStatus);
  if (dataInicio) partes.push(`de_${dataInicio}`);
  if (dataFim) partes.push(`ate_${dataFim}`);
  if (filtroLocal) partes.push("local");
  if (filtroConferente) partes.push("conferente");
  if (busca.trim()) partes.push("busca");
  return partes.join("_");
}

function IconeBusca() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconeFiltro() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M4 8h10M18 8h2M4 16h2M10 16h10" />
      <circle cx="16" cy="8" r="2.25" />
      <circle cx="8" cy="16" r="2.25" />
    </svg>
  );
}

function Chip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="conf-chip">
      <span className="conf-chip__label">{label}</span>
      <button type="button" onClick={onRemove} aria-label={`Remover filtro ${label}`}>
        ×
      </button>
    </span>
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
  const [filtroLocal, setFiltroLocal] = useState("");
  const [filtroConferente, setFiltroConferente] = useState("");
  const [exportando, setExportando] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ConferenciaItem | null>(null);
  const [extintorQuestions, setExtintorQuestions] = useState<ChecklistQuestion[]>([]);
  const [hidranteQuestions, setHidranteQuestions] = useState<ChecklistQuestion[]>([]);
  const extintorLookupRef = useRef<Map<string, ExtintorLookupRow>>(new Map());
  const hidranteLookupRef = useRef<Map<string, HidranteLookupRow>>(new Map());
  const datasEditadasPeloUsuarioRef = useRef(false);

  const loadConferencias = useCallback(async () => {
    if (!ready || !activeBaseId) return;
    setLoading(true);
    setLoadError(null);

    const [history, extQuestions, hidQuestions] = await Promise.all([
      fetchConferenciasHistorico(supabase, activeBaseId),
      fetchChecklistQuestionsForBase(activeBaseId, "extintor"),
      fetchChecklistQuestionsForBase(activeBaseId, "hidrante"),
    ]);
    const { extintorRows, hidranteRows, extintorLookup, hidranteLookup, errors } = history;
    setExtintorQuestions(extQuestions);
    setHidranteQuestions(hidQuestions);

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
        numInmetro: ext?.num_inmetro ?? "",
        capacidadeExtintora: ext?.capacidade_extintora ?? "",
        pavimento: ext?.pavimento ?? "",
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

      if (filtroLocal && (item.pavimento || item.setor || "").trim() !== filtroLocal) {
        return false;
      }

      if (filtroConferente && item.conferente.trim() !== filtroConferente) {
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
        formatEquipmentIdentifier(item.tipo, item.codigo),
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
  }, [
    rows,
    busca,
    showEquipeFilter,
    filtroEquipe,
    filtroStatus,
    filtroLocal,
    filtroConferente,
    dataInicio,
    dataFim,
  ]);

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

  const periodoAtivo = detectarPeriodoPreset(dataInicio, dataFim);
  const periodoPersonalizado = periodoAtivo !== "mes";
  const filtrosAvancadosAtivos = [
    Boolean(showEquipeFilter && filtroEquipe),
    Boolean(filtroStatus),
    Boolean(filtroLocal),
    Boolean(filtroConferente),
    periodoPersonalizado,
  ].filter(Boolean).length;
  const temFiltrosAtivos = filtrosAvancadosAtivos > 0 || Boolean(busca.trim());

  const locaisDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const local = (row.pavimento || row.setor || "").trim();
      if (local) set.add(local);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const conferentesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const nome = row.conferente.trim();
      if (nome) set.add(nome);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const resumo = useMemo(() => {
    let conforme = 0;
    let alerta = 0;
    let vencido = 0;
    for (const item of visiveis) {
      if (item.exportStatus === "conforme") conforme += 1;
      else if (item.exportStatus === "alerta") alerta += 1;
      else vencido += 1;
    }
    return { realizadas: visiveis.length, conforme, alerta, vencido };
  }, [visiveis]);

  const filtrosDraft: ConferenciaFiltrosDraft = {
    equipe: filtroEquipe,
    status: filtroStatus,
    dataInicio,
    dataFim,
    local: filtroLocal,
    conferente: filtroConferente,
  };

  const equipeLabelAtiva = filtroEquipe
    ? (EQUIPES_CONFERENCIA.find((eq) => eq.id === filtroEquipe)?.label ?? filtroEquipe)
    : "";
  const statusLabelAtivo =
    OPCOES_FILTRO_STATUS.find((op) => op.value === filtroStatus)?.label ?? "";

  function aplicarFiltros(next: ConferenciaFiltrosDraft) {
    datasEditadasPeloUsuarioRef.current = detectarPeriodoPreset(next.dataInicio, next.dataFim) !== "mes";
    setFiltroEquipe(next.equipe);
    setFiltroStatus(next.status);
    setDataInicio(next.dataInicio);
    setDataFim(next.dataFim);
    setFiltroLocal(next.local);
    setFiltroConferente(next.conferente);
  }

  function limparFiltrosAvancados() {
    const padrao = filtrosPadraoMesVigente();
    datasEditadasPeloUsuarioRef.current = false;
    setFiltroEquipe("");
    setFiltroStatus("");
    setFiltroLocal("");
    setFiltroConferente("");
    setDataInicio(padrao.dataInicio);
    setDataFim(padrao.dataFim);
  }

  function limparFiltros() {
    limparFiltrosAvancados();
    setBusca("");
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
        filtroLocal,
        filtroConferente,
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
    <section className="conf-page">
      <header className="conf-header">
        <div>
          <h1>Conferências</h1>
          <p>Histórico de inspeções realizadas nos equipamentos.</p>
        </div>
        <div className="conf-header__actions">
          <button
            type="button"
            onClick={() => void loadConferencias()}
            className="dash-refresh"
          >
            Atualizar
          </button>
          <ExportActions
            compact
            disabled={exportando || totalExportacao === 0}
            excelLabel={exportando ? "Exportando…" : "Excel"}
            onExcel={() => handleExport("excel")}
            onPdf={() => handleExport("pdf")}
          />
        </div>
      </header>

      <InventarioTipoTabs
        value={tipoLista}
        onChange={setTipoLista}
        extintoresCount={extCount}
        hidrantesCount={hidCount}
      />

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Aviso ao carregar:</span> {loadError}
        </div>
      ) : null}

      <div className="professional-card conf-toolbar">
        <label className="conf-search" htmlFor="filtro-busca">
          <IconeBusca />
          <input
            id="filtro-busca"
            type="search"
            placeholder="Buscar por código, local, conferente ou observação..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          className="conf-filters-btn"
        >
          <IconeFiltro />
          Filtros
          {filtrosAvancadosAtivos > 0 ? (
            <span className="conf-filters-btn__count">{filtrosAvancadosAtivos}</span>
          ) : null}
        </button>
      </div>

      {temFiltrosAtivos ? (
        <div className="conf-chips">
          {busca.trim() ? <Chip label={`Busca: ${busca.trim()}`} onRemove={() => setBusca("")} /> : null}
          {periodoPersonalizado ? (
            <Chip
              label={labelPeriodo(dataInicio, dataFim)}
              onRemove={() => {
                const { inicio, fim } = getDatasPadraoMesVigente();
                datasEditadasPeloUsuarioRef.current = false;
                setDataInicio(inicio);
                setDataFim(fim);
              }}
            />
          ) : null}
          {filtroStatus ? (
            <Chip label={statusLabelAtivo} onRemove={() => setFiltroStatus("")} />
          ) : null}
          {filtroLocal ? <Chip label={filtroLocal} onRemove={() => setFiltroLocal("")} /> : null}
          {filtroConferente ? (
            <Chip label={filtroConferente} onRemove={() => setFiltroConferente("")} />
          ) : null}
          {showEquipeFilter && filtroEquipe ? (
            <Chip label={equipeLabelAtiva} onRemove={() => setFiltroEquipe("")} />
          ) : null}
          <button type="button" className="conf-chips__clear" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
      ) : null}

      {!loading ? (
        <p className="conf-summary" aria-label="Resumo operacional">
          <span className="conf-summary__item">
            <strong>{resumo.realizadas}</strong> realizadas
          </span>
          <span className="conf-summary__item is-ok">
            <strong>{resumo.conforme}</strong> conformes
          </span>
          <span className="conf-summary__item is-bad">
            <strong>{resumo.alerta}</strong> não conformes
          </span>
          <span className="conf-summary__item is-warn">
            <strong>{resumo.vencido}</strong> vencidos
          </span>
        </p>
      ) : null}

      <div className="professional-card conf-list">
        <div className="conf-list__head">
          <div>
            <p className="page-eyebrow">Relatórios de inspeção</p>
            <h2>
              {tipoLista === "extintor" ? "Extintores inspecionados" : "Hidrantes inspecionados"}
            </h2>
          </div>
          <span className="conf-list__count">
            {visiveis.length} {visiveis.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {loading ? (
          <div className="conf-empty">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--orange)] border-t-transparent" />
            Carregando conferências…
          </div>
        ) : visiveis.length === 0 ? (
          <div className="conf-empty conf-empty--box">
            <p>Nenhuma inspeção encontrada</p>
            <span>Ajuste a busca ou os filtros para ver outros resultados.</span>
          </div>
        ) : (
          <div className="conf-grid">
            {visiveis.map((item) => (
              <ConferenciaCard
                key={`${item.tipo}-${item.id}`}
                item={item}
                teamLabel={equipeLabelForCodigo(item.codigo, item.tipo)}
                questions={item.tipo === "extintor" ? extintorQuestions : hidranteQuestions}
                onOpen={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      <ConferenciaFilterDrawer
        open={filterDrawerOpen}
        showEquipeFilter={showEquipeFilter}
        value={filtrosDraft}
        locais={locaisDisponiveis}
        conferentes={conferentesDisponiveis}
        onApply={aplicarFiltros}
        onClear={() => {
          limparFiltrosAvancados();
          setFilterDrawerOpen(false);
        }}
        onClose={() => setFilterDrawerOpen(false)}
      />

      {selectedItem ? (
        <ConferenciaDetailDrawer
          item={selectedItem}
          teamLabel={equipeLabelForCodigo(selectedItem.codigo, selectedItem.tipo)}
          questions={selectedItem.tipo === "extintor" ? extintorQuestions : hidranteQuestions}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </section>
  );
}
