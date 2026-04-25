"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  exportExtintoresBasico,
  exportExtintoresComConferencias,
  type ExtintorRow,
  type ExtintorComConferencias,
  type ChecklistRow,
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
    <div className="flex h-full flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #E02020, #B51313)" }}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>

      {/* Column preview */}
      <div className="flex-1 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Colunas incluídas
        </p>
        <div className="flex flex-wrap gap-1.5">
          {details.map((d) => (
            <span
              key={d}
              className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-200"
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
        className="mt-auto flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-60"
        style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
      >
        {status === "loading" ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Preparando...
          </>
        ) : (
          <>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {buttonLabel}
          </>
        )}
      </button>

      {status === "done" && (
        <p className="text-center text-xs font-semibold text-green-600">
          ✓ Arquivo gerado e download iniciado!
        </p>
      )}
      {status === "error" && (
        <p className="text-center text-xs font-semibold text-red-600">
          Erro ao gerar arquivo. Tente novamente.
        </p>
      )}
    </div>
  );
}

export default function AdminExportacaoPage() {
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusBasico, setStatusBasico] = useState<ExportStatus>("idle");
  const [statusCompleto, setStatusCompleto] = useState<ExportStatus>("idle");

  const supabase = useMemo(() => getSupabaseClient(), []);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    const { data } = await supabase
      .from("extintores")
      .select(
        "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,coord_x,coord_y,pavimento,created_at",
      )
      .order("codigo", { ascending: true });
    setExtintores((data ?? []) as ExtintorRow[]);
    setLoadingData(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
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
      // Fetch all checklists
      const { data: checklists, error } = await supabase
        .from("checklists")
        .select("id,extintor_id,data_conferencia,conferente,local_correto,dados_corretos,sinalizacao_correta,mangueira_status,bico_difusor_status,alca_gatilho_status,medidor_pressao_status,cilindro_status,status_lacre,status_manometro,observacoes,created_at")
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Exportação</h1>
        <p className="text-sm text-gray-500">
          Baixe os dados dos extintores em formato Excel (.xlsx)
        </p>
      </div>

      {/* Info banner */}
      {!loadingData && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-700">
            <strong>{extintores.length}</strong> extintores cadastrados disponíveis para exportação.
          </p>
        </div>
      )}

      {loadingData ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E02020] border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Export 1: Basic data */}
          <ExportCard
            title="Extintores — Dados Cadastrais"
            description="Uma linha por extintor com todos os dados de cadastro, datas de manutenção e status de posicionamento no mapa."
            details={[
              "Código",
              "Setor",
              "Local Detalhado",
              "Nº INMETRO",
              "Tipo",
              "Tamanho",
              "Capacidade",
              "Pavimento",
              "Vencto. Manutenção N2",
              "Vencto. Manutenção N3",
              "Posicionado no Mapa",
              "Data de Cadastro",
            ]}
            buttonLabel="Exportar dados cadastrais"
            status={statusBasico}
            onExport={handleExportBasico}
            icon={
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />

          {/* Export 2: Full with conferences */}
          <ExportCard
            title="Extintores + Histórico de Conferências"
            description="Uma linha por conferência, contendo apenas os campos do checklist da inspeção."
            details={[
              "Código do Extintor",
              "Data da Conferência",
              "Conferente",
              "Local correto conforme mapa",
              "Dados do extintor corretos",
              "Sinalização correta",
              "Mangueira em boas condições",
              "Bico ou difusor em boas condições",
              "Alça/Gatilho/Lacre/Pino em boas condições",
              "Medidor de pressão correto",
              "Cilindro em boas condições",
              "Observações",
            ]}
            buttonLabel="Exportar com histórico de conferências"
            status={statusCompleto}
            onExport={handleExportCompleto}
            icon={
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M-1 12l5 5 9-9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
              </svg>
            }
          />
        </div>
      )}
    </div>
  );
}
