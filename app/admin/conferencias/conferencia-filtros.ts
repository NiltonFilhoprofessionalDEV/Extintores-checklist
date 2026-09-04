import type { EquipeConferenciaId } from "@/lib/equipes/conferencia-filtro";
import type { ConferenciaExportStatus } from "@/lib/export/conferencia-historico";

export type PeriodoPreset = "hoje" | "7d" | "mes" | "custom";
export type FiltroStatusConferencia = ConferenciaExportStatus | "";
export type ConferenciaOrdenacao = "data_desc" | "codigo_asc" | "codigo_desc";

export type ConferenciaFiltrosDraft = {
  equipe: EquipeConferenciaId | "";
  status: FiltroStatusConferencia;
  dataInicio: string;
  dataFim: string;
  local: string;
  conferente: string;
  ordenacao: ConferenciaOrdenacao;
};

export const OPCOES_FILTRO_STATUS: { value: FiltroStatusConferencia; label: string }[] = [
  { value: "conforme", label: "Conforme" },
  { value: "alerta", label: "Não conforme" },
  { value: "vencido", label: "Vencido" },
  { value: "pendente", label: "Pendentes" },
];

export const OPCOES_ORDENACAO: { value: ConferenciaOrdenacao; label: string }[] = [
  { value: "data_desc", label: "Mais recentes" },
  { value: "codigo_asc", label: "Código crescente" },
  { value: "codigo_desc", label: "Código decrescente" },
];

export const PERIODO_PRESETS: { id: Exclude<PeriodoPreset, "custom">; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "mes", label: "Este mês" },
];

export function formatDateInputLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDatasPadraoMesVigente(): { inicio: string; fim: string } {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return {
    inicio: formatDateInputLocal(inicioMes),
    fim: formatDateInputLocal(hoje),
  };
}

export function datasParaPreset(preset: Exclude<PeriodoPreset, "custom">): { inicio: string; fim: string } {
  const hoje = new Date();
  const fim = formatDateInputLocal(hoje);
  if (preset === "hoje") return { inicio: fim, fim };
  if (preset === "7d") {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 6);
    return { inicio: formatDateInputLocal(inicio), fim };
  }
  return getDatasPadraoMesVigente();
}

export function detectarPeriodoPreset(inicio: string, fim: string): PeriodoPreset {
  const mes = datasParaPreset("mes");
  if (inicio === mes.inicio && fim === mes.fim) return "mes";
  const hoje = datasParaPreset("hoje");
  if (inicio === hoje.inicio && fim === hoje.fim) return "hoje";
  const d7 = datasParaPreset("7d");
  if (inicio === d7.inicio && fim === d7.fim) return "7d";
  return "custom";
}

export function formatarDataFiltro(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("pt-BR");
}

export function labelPeriodo(inicio: string, fim: string): string {
  const preset = detectarPeriodoPreset(inicio, fim);
  if (preset === "hoje") return "Hoje";
  if (preset === "7d") return "Últimos 7 dias";
  if (preset === "mes") return "Este mês";
  if (inicio && fim) return `${formatarDataFiltro(inicio)} – ${formatarDataFiltro(fim)}`;
  if (inicio) return `De ${formatarDataFiltro(inicio)}`;
  if (fim) return `Até ${formatarDataFiltro(fim)}`;
  return "Período";
}

export function filtrosPadraoMesVigente(): ConferenciaFiltrosDraft {
  const { inicio, fim } = getDatasPadraoMesVigente();
  return {
    equipe: "",
    status: "",
    dataInicio: inicio,
    dataFim: fim,
    local: "",
    conferente: "",
    ordenacao: "data_desc",
  };
}
