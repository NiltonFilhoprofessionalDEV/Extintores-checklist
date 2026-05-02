"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  exportExtintoresBasico,
  exportExtintoresComConferencias,
  exportHidrantesBasico,
  exportHidrantesComInspecoes,
  exportInspecoesMarcadoresEmergencia,
  type ExtintorRow,
  type ExtintorComConferencias,
  type ChecklistRow,
  type HidranteExportRow,
  type HidranteComInspecoes,
  type ChecklistHidranteRow,
  type InspecaoMarcadorEmergenciaRow,
} from "@/lib/export/excel";

type ExportStatus = "idle" | "loading" | "done" | "error";

function ExportCard({
  title,
  description,
  details,
  buttonLabel,
  icon,
  onExport,
  status,
}: {
  title: string;
  description: string;
  details: string[];
  buttonLabel: string;
  icon: React.ReactNode;
  onExport: () => void;
  status: ExportStatus;
}) {
  return (
    <div className="surface-card flex h-full flex-col gap-5 p-6">
      <div className="flex items-start gap-4">
        <div className="brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Colunas incluídas</p>
        <div className="flex flex-wrap gap-1.5">
          {details.map((d) => (
            <span
              key={d}
              className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200"
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onExport}
        disabled={status === "loading"}
        className="brand-gradient mt-auto flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-60"
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

export default function AdminExportacaoPage() {
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [hidrantes, setHidrantes] = useState<HidranteExportRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusBasico, setStatusBasico] = useState<ExportStatus>("idle");
  const [statusCompleto, setStatusCompleto] = useState<ExportStatus>("idle");
  const [statusHidBasico, setStatusHidBasico] = useState<ExportStatus>("idle");
  const [statusHidInspecoes, setStatusHidInspecoes] = useState<ExportStatus>("idle");
  const [statusEmergencia, setStatusEmergencia] = useState<ExportStatus>("idle");

  const supabase = useMemo(() => getSupabaseClient(), []);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    const [extRes, hidRes] = await Promise.all([
      supabase
        .from("extintores")
        .select(
          "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,pavimento,created_at",
        )
        .order("codigo", { ascending: true }),
      supabase
        .from("hidrantes")
        .select("id,codigo,pavimento,local_detalhado,coord_x,coord_y,created_at")
        .order("codigo", { ascending: true }),
    ]);
    setExtintores((extRes.data ?? []) as ExtintorRow[]);
    setHidrantes((hidRes.data ?? []) as HidranteExportRow[]);
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
      setStatusBasico("done");
      setTimeout(() => setStatusBasico("idle"), 4000);
    } catch {
      setStatusBasico("error");
    }
  }

  async function handleExportCompleto() {
    setStatusCompleto("loading");
    try {
      const { data: checklists, error } = await supabase
        .from("checklists")
        .select(
          "id,extintor_id,data_conferencia,conferente,local_correto,dados_corretos,sinalizacao_correta,mangueira_status,bico_difusor_status,alca_gatilho_status,medidor_pressao_status,cilindro_status,status_lacre,status_manometro,observacoes,created_at",
        )
        .order("data_conferencia", { ascending: false });

      if (error) throw error;

      const checklistMap: Record<string, ChecklistRow[]> = {};
      for (const c of (checklists ?? []) as ChecklistRow[]) {
        if (!checklistMap[c.extintor_id]) checklistMap[c.extintor_id] = [];
        checklistMap[c.extintor_id].push(c);
      }

      const combined: ExtintorComConferencias[] = extintores.map((e) => ({
        ...e,
        checklists: checklistMap[e.id] ?? [],
      }));

      exportExtintoresComConferencias(combined);
      setStatusCompleto("done");
      setTimeout(() => setStatusCompleto("idle"), 4000);
    } catch {
      setStatusCompleto("error");
    }
  }

  async function handleExportHidrantesBasico() {
    setStatusHidBasico("loading");
    try {
      exportHidrantesBasico(hidrantes);
      setStatusHidBasico("done");
      setTimeout(() => setStatusHidBasico("idle"), 4000);
    } catch {
      setStatusHidBasico("error");
    }
  }

  async function handleExportHidrantesInspecoes() {
    setStatusHidInspecoes("loading");
    try {
      const { data: checklists, error } = await supabase
        .from("checklists_hidrantes")
        .select(
          "id,hidrante_id,data_conferencia,conferente,acesso_desobstruido,identificacao_sinalizacao,mangueira_esguicho,valvulas_registros,pressao_abastecimento,gabinete_caixa,hidrante_integridade,documentacao_acesso,observacoes,created_at",
        )
        .order("data_conferencia", { ascending: false });

      if (error) throw error;

      const checklistMap: Record<string, ChecklistHidranteRow[]> = {};
      for (const c of (checklists ?? []) as ChecklistHidranteRow[]) {
        if (!checklistMap[c.hidrante_id]) checklistMap[c.hidrante_id] = [];
        checklistMap[c.hidrante_id].push(c);
      }

      const combined: HidranteComInspecoes[] = hidrantes.map((h) => ({
        ...h,
        checklists: checklistMap[h.id] ?? [],
      }));

      exportHidrantesComInspecoes(combined);
      setStatusHidInspecoes("done");
      setTimeout(() => setStatusHidInspecoes("idle"), 4000);
    } catch {
      setStatusHidInspecoes("error");
    }
  }

  async function handleExportEmergencia() {
    setStatusEmergencia("loading");
    try {
      const { data, error } = await supabase
        .from("inspecoes_marcadores_emergencia")
        .select(
          "id,marcador_emergencia_id,marcador_kind,pavimento,data_inspecao,conferente,inspecao_resultado,nao_conformidade_descricao,created_at",
        )
        .order("data_inspecao", { ascending: false });

      if (error) throw error;

      exportInspecoesMarcadoresEmergencia((data ?? []) as InspecaoMarcadorEmergenciaRow[]);
      setStatusEmergencia("done");
      setTimeout(() => setStatusEmergencia("idle"), 4000);
    } catch {
      setStatusEmergencia("error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Exportação</h1>
        <p className="text-sm text-slate-500">
          Baixe dados cadastrais e histórico de inspeções (extintores, hidrantes e luz/placa de emergência) em Excel
          (.xlsx).
        </p>
      </div>

      {!loadingData && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-700">
            <strong>{extintores.length}</strong> extintores e <strong>{hidrantes.length}</strong> hidrantes cadastrados
            para exportação cadastral; inspeções vêm das tabelas de checklist e de auditoria de emergência.
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
              "Data da conferência",
              "Conferente",
              "Local correto conforme mapa",
              "Dados do extintor corretos",
              "Sinalização correta",
              "Mangueira",
              "Bico ou difusor",
              "Alça/Gatilho/Lacre/Pino",
              "Medidor de pressão",
              "Cilindro",
              "Observações",
            ]}
            buttonLabel="Exportar histórico de extintores"
            status={statusCompleto}
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
              "Acesso e desobstrução",
              "Identificação e sinalização",
              "Mangueira e esguicho",
              "Válvulas e registros",
              "Pressão / abastecimento",
              "Gabinete ou caixa",
              "Integridade do hidrante",
              "Documentação / acesso",
              "Observações",
            ]}
            buttonLabel="Exportar histórico de hidrantes"
            status={statusHidInspecoes}
            onExport={handleExportHidrantesInspecoes}
            icon={
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 8h8M8 16h8" />
              </svg>
            }
          />

          <div className="lg:col-span-2">
            <ExportCard
              title="Luz e placa de emergência — Histórico de inspeções"
              description="Todas as linhas da tabela inspecoes_marcadores_emergencia (auditoria). Exige migração SQL em docs/migration_mapa_recursos.sql."
              details={[
                "Tipo de ponto",
                "Pavimento",
                "Data da inspeção",
                "Conferente",
                "Resultado",
                "Descrição não conformidade",
                "ID marcador",
                "ID registro",
                "Criado em",
              ]}
              buttonLabel="Exportar inspeções luz/placa"
              status={statusEmergencia}
              onExport={handleExportEmergencia}
              icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
