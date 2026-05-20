"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllFromTable, fetchAllPages } from "@/lib/supabase/fetch-all";
import { fetchChecklistsExtintoresForExport } from "@/lib/supabase/checklists-export";
import {
  exportExtintoresBasico,
  exportExtintoresComConferencias,
  exportHidrantesBasico,
  exportHidrantesComInspecoes,
  type ExtintorRow,
  type HidranteExportRow,
  type ChecklistHidranteRow,
  type HidranteChecklistExportItem,
} from "@/lib/export/excel";
import { CHECKLIST_EXPORT_COLUMN_LABELS } from "@/lib/checklist/export-labels";
import { HIDRANTE_ACTIVE_ITEM_KEYS, HIDRANTE_ITEM_LABELS } from "@/lib/checklist/hidrante-types";
import { CHECKLIST_ITEM_KEYS } from "@/lib/checklist/types";

type ExportStatus = "idle" | "loading" | "done" | "error";

function pickRelation<T extends Record<string, unknown>>(rel: unknown): T | null {
  if (!rel || typeof rel !== "object") return null;
  if (Array.isArray(rel)) return (rel[0] as T | undefined) ?? null;
  return rel as T;
}

function buildExtintorLookup(extintores: ExtintorRow[]) {
  return new Map(
    extintores.map((e) => [
      e.id,
      { codigo: e.codigo, setor: e.setor, local_detalhado: e.local_detalhado },
    ]),
  );
}

function resetStatusAfterDelay(setStatus: (s: ExportStatus) => void, status: ExportStatus) {
  setStatus(status);
  if (status === "done" || status === "error") {
    window.setTimeout(() => setStatus("idle"), 4000);
  }
}

function ExportCard({
  title,
  description,
  details,
  buttonLabel,
  icon,
  onExport,
  status,
  disabled,
}: {
  title: string;
  description: string;
  details: string[];
  buttonLabel: string;
  icon: React.ReactNode;
  onExport: () => void;
  status: ExportStatus;
  disabled?: boolean;
}) {
  return (
    <div className="section-card flex h-full flex-col gap-5 p-6 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/40">
      <div className="flex items-start gap-4">
        <div className="brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg shadow-red-200">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
        </div>
      </div>

      <div className="flex-1 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Colunas incluídas</p>
        <div className="flex flex-wrap gap-1.5">
          {details.map((d) => (
            <span
              key={d}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200"
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onExport}
        disabled={disabled || status === "loading"}
        className="btn-primary mt-auto w-full py-3.5 disabled:opacity-60"
      >
        {status === "loading" ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Preparando...
          </>
        ) : (
          <>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {buttonLabel}
          </>
        )}
      </button>

      {status === "done" && (
        <p className="text-center text-xs font-semibold text-green-600">✓ Arquivo gerado e download iniciado!</p>
      )}
      {status === "error" && (
        <p className="text-center text-xs font-semibold text-red-600">Erro ao gerar arquivo. Tente novamente.</p>
      )}
    </div>
  );
}

const EXTINTOR_SELECT =
  "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,pavimento,created_at";

const HIDRANTE_SELECT = "id,codigo,pavimento,local_detalhado,coord_x,coord_y,created_at";

const CHECKLIST_HIDRANTE_SELECT =
  "id,hidrante_id,data_conferencia,conferente,acesso_desobstruido,identificacao_sinalizacao,mangueira_esguicho,valvulas_registros,pressao_abastecimento,gabinete_caixa,hidrante_integridade,documentacao_acesso,observacoes,created_at,hidrantes(codigo,pavimento,local_detalhado)";

export default function AdminExportacaoPage() {
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [hidrantes, setHidrantes] = useState<HidranteExportRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusBasico, setStatusBasico] = useState<ExportStatus>("idle");
  const [statusCompleto, setStatusCompleto] = useState<ExportStatus>("idle");
  const [statusHidBasico, setStatusHidBasico] = useState<ExportStatus>("idle");
  const [statusHidInspecoes, setStatusHidInspecoes] = useState<ExportStatus>("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const extintorById = useMemo(() => buildExtintorLookup(extintores), [extintores]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setLoadError(null);

    const [extRes, hidRes] = await Promise.all([
      fetchAllFromTable<ExtintorRow>(supabase, "extintores", EXTINTOR_SELECT, {
        column: "codigo",
        ascending: true,
      }),
      fetchAllFromTable<HidranteExportRow>(supabase, "hidrantes", HIDRANTE_SELECT, {
        column: "codigo",
        ascending: true,
      }),
    ]);

    if (extRes.error || hidRes.error) {
      setLoadError(extRes.error ?? hidRes.error);
      setExtintores([]);
      setHidrantes([]);
    } else {
      setExtintores(extRes.data);
      setHidrantes(hidRes.data);
    }

    setLoadingData(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function handleExportBasico() {
    setStatusBasico("loading");
    try {
      exportExtintoresBasico(extintores);
      resetStatusAfterDelay(setStatusBasico, "done");
    } catch {
      resetStatusAfterDelay(setStatusBasico, "error");
    }
  }

  async function handleExportCompleto() {
    setStatusCompleto("loading");
    setExportError(null);
    try {
      const { items, error } = await fetchChecklistsExtintoresForExport(supabase, extintorById);
      if (error) throw new Error(error);

      exportExtintoresComConferencias(items);
      resetStatusAfterDelay(setStatusCompleto, "done");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Erro ao exportar conferências.");
      resetStatusAfterDelay(setStatusCompleto, "error");
    }
  }

  async function handleExportHidrantesBasico() {
    setStatusHidBasico("loading");
    try {
      exportHidrantesBasico(hidrantes);
      resetStatusAfterDelay(setStatusHidBasico, "done");
    } catch {
      resetStatusAfterDelay(setStatusHidBasico, "error");
    }
  }

  async function handleExportHidrantesInspecoes() {
    setStatusHidInspecoes("loading");
    try {
      const { data, error } = await fetchAllPages<Record<string, unknown>>((from, to) =>
        supabase
          .from("checklists_hidrantes")
          .select(CHECKLIST_HIDRANTE_SELECT)
          .order("data_conferencia", { ascending: false })
          .range(from, to) as unknown as Promise<{
          data: Record<string, unknown>[] | null;
          error: { message: string } | null;
        }>,
      );

      if (error) throw new Error(error);

      const items: HidranteChecklistExportItem[] = [];
      for (const row of data) {
        const hid = pickRelation<{ codigo?: string; pavimento?: string | null; local_detalhado?: string }>(
          row.hidrantes,
        );
        const checklist = row as unknown as ChecklistHidranteRow;
        items.push({
          codigo: hid?.codigo ?? "",
          pavimento: hid?.pavimento ?? "",
          local_detalhado: hid?.local_detalhado ?? "",
          checklist,
        });
      }

      exportHidrantesComInspecoes(items);
      resetStatusAfterDelay(setStatusHidInspecoes, "done");
    } catch {
      resetStatusAfterDelay(setStatusHidInspecoes, "error");
    }
  }

  const exportsDisabled = loadingData || !!loadError;

  return (
    <div className="space-y-6">
      <div className="page-hero p-6">
        <div className="page-hero-content">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-red-200">Relatórios</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Exportação</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-300">
            Baixe dados cadastrais e histórico de inspeções em Excel (.xlsx).
          </p>
        </div>
      </div>

      {exportError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">
            Erro na exportação de conferências: <strong>{exportError}</strong>
          </p>
        </div>
      )}

      {loadError && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">
            Erro ao carregar dados: <strong>{loadError}</strong>
          </p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loadingData && !loadError && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm shadow-blue-100/60">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-700">
            <strong>{extintores.length}</strong> extintores e <strong>{hidrantes.length}</strong> hidrantes
            cadastrados para exportação cadastral; históricos vêm das tabelas de checklist.
          </p>
        </div>
      )}

      {loadingData ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E02020] border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ExportCard
            title="Extintores — Dados cadastrais"
            description="Uma linha por extintor com dados de cadastro, manutenção e posicionamento no mapa."
            details={[
              "Código",
              "Pavimento",
              "Local detalhado",
              "Nº INMETRO",
              "Tipo",
              "Tamanho",
              "Capacidade",
              "Pavimento na planta",
              "Vencto. manutenção N2",
              "Vencto. manutenção N3",
              "Posicionado no mapa",
              "Data de cadastro",
            ]}
            buttonLabel="Exportar dados cadastrais"
            status={statusBasico}
            disabled={exportsDisabled}
            onExport={handleExportBasico}
            icon={
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
          />

          <ExportCard
            title="Extintores — Histórico de conferências"
            description="Uma linha por conferência na tabela checklists, com todos os itens do checklist."
            details={[
              "Código do extintor",
              "Setor",
              "Local detalhado",
              "Data da conferência",
              "Conferente",
              ...CHECKLIST_ITEM_KEYS.map((k) => CHECKLIST_EXPORT_COLUMN_LABELS[k]),
              "Observações",
            ]}
            buttonLabel="Exportar histórico de extintores"
            status={statusCompleto}
            disabled={exportsDisabled}
            onExport={handleExportCompleto}
            icon={
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M-1 12l5 5 9-9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
              </svg>
            }
          />

          <ExportCard
            title="Hidrantes — Dados cadastrais"
            description="Uma linha por hidrante: código, pavimento, local e se está posicionado no mapa."
            details={["Código", "Pavimento", "Local detalhado", "Posicionado no mapa", "Cadastrado em"]}
            buttonLabel="Exportar hidrantes (cadastro)"
            status={statusHidBasico}
            disabled={exportsDisabled}
            onExport={handleExportHidrantesBasico}
            icon={
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            }
          />

          <ExportCard
            title="Hidrantes — Histórico de inspeções"
            description="Uma linha por registro em checklists_hidrantes, com itens da inspeção e observações."
            details={[
              "Código do hidrante",
              "Pavimento",
              "Local detalhado",
              "Data da inspeção",
              "Conferente",
              ...HIDRANTE_ACTIVE_ITEM_KEYS.map((key) => HIDRANTE_ITEM_LABELS[key]),
              "Observações",
            ]}
            buttonLabel="Exportar histórico de hidrantes"
            status={statusHidInspecoes}
            disabled={exportsDisabled}
            onExport={handleExportHidrantesInspecoes}
            icon={
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 8h8M8 16h8" />
              </svg>
            }
          />
        </div>
      )}
    </div>
  );
}
