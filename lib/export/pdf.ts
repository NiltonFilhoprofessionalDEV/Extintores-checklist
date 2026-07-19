import type {
  ConferenciaHistoricoExtintorRow,
  ConferenciaHistoricoHidranteRow,
  ExtintorRow,
  HidranteInventarioCompletoRow,
  HidranteVencimentoExportRow,
} from "@/lib/export/excel";
import {
  resolveExtintorConferenciaExport,
  resolveHidranteConferenciaExport,
} from "@/lib/export/conferencia-historico";
import {
  downloadPdfReport,
  type PdfExportResult,
  type PdfRow,
} from "@/lib/export/pdf-report-renderer";

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function extintorInventoryRows(items: ExtintorRow[]): PdfRow[] {
  return [...items]
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }))
    .map((item) => ({
      Código: item.codigo,
      Setor: item.setor,
      "Local detalhado": item.local_detalhado,
      "Nº INMETRO": item.num_inmetro,
      Tipo: item.tipo,
      Tamanho: item.tamanho,
      "Capacidade extintora": item.capacidade_extintora,
      Pavimento: item.pavimento ?? "",
      "Manutenção nível 2": formatDate(item.manutencao_2_nivel),
      "Manutenção nível 3": formatDate(item.manutencao_3_nivel),
    }));
}

function hidranteInventoryRows(items: HidranteVencimentoExportRow[]): PdfRow[] {
  return [...items]
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }))
    .map((item) => {
      const details = item as Partial<HidranteInventarioCompletoRow>;
      return {
        Código: item.codigo,
        Pavimento: item.pavimento ?? "",
        "Local detalhado": item.local_detalhado,
        Mangueiras: item.quantidade_mangueiras ?? "",
        "Teste M-1": formatDate(item.teste_hidrostatico_m1),
        "Teste M-2": formatDate(item.teste_hidrostatico_m2),
        "Teste M-3": formatDate(item.teste_hidrostatico_m3),
        "Teste M-4": formatDate(item.teste_hidrostatico_m4),
        "Chaves Storz": details.quantidade_chaves_storz ?? "",
        Esguichos: details.quantidade_esguichos ?? "",
      };
    });
}

export function exportInventarioPdf(
  extintores: ExtintorRow[],
  hidrantes: HidranteInventarioCompletoRow[],
): Promise<PdfExportResult> {
  return downloadPdfReport("Inventário de equipamentos", [
    { title: "Extintores", rows: extintorInventoryRows(extintores) },
    { title: "Hidrantes", rows: hidranteInventoryRows(hidrantes) },
  ]);
}

export function exportAlertasExtintoresPdf(
  items: ExtintorRow[],
  label: string,
): Promise<PdfExportResult> {
  return downloadPdfReport(label, [{ title: "Extintores", rows: extintorInventoryRows(items) }]);
}

export function exportAlertasHidrantesPdf(
  items: HidranteVencimentoExportRow[],
  label: string,
): Promise<PdfExportResult> {
  return downloadPdfReport(label, [{ title: "Hidrantes", rows: hidranteInventoryRows(items) }]);
}

function conferenciaExtintorRows(items: ConferenciaHistoricoExtintorRow[]): PdfRow[] {
  return items.map((item) => {
    const resolved = resolveExtintorConferenciaExport(
      item.checklistRaw,
      item.manutencao_2_nivel,
      item.manutencao_3_nivel,
    );
    return {
      Código: item.codigo,
      Status: item.exportStatus ?? resolved.status,
      Equipe: item.equipe,
      Setor: item.setor,
      Local: item.local_detalhado,
      Tipo: item.tipo,
      Tamanho: item.tamanho,
      Data: formatDateTime(item.data_conferencia),
      Conferente: item.conferente,
      Observação: item.observacao ?? resolved.observacao,
    };
  });
}

function conferenciaHidranteRows(items: ConferenciaHistoricoHidranteRow[]): PdfRow[] {
  return items.map((item) => {
    const resolved = resolveHidranteConferenciaExport(item.checklistRaw, item.hidrante);
    return {
      Código: item.codigo,
      Status: item.exportStatus ?? resolved.status,
      Equipe: item.equipe,
      Pavimento: item.pavimento,
      Local: item.local_detalhado,
      Data: formatDateTime(item.data_conferencia),
      Conferente: item.conferente,
      Observação: item.observacao ?? resolved.observacao,
    };
  });
}

export function exportConferenciasPdf(
  extintores: ConferenciaHistoricoExtintorRow[],
  hidrantes: ConferenciaHistoricoHidranteRow[],
  title = "Histórico de conferências",
): Promise<PdfExportResult> {
  return downloadPdfReport(title, [
    { title: "Extintores", rows: conferenciaExtintorRows(extintores) },
    { title: "Hidrantes", rows: conferenciaHidranteRows(hidrantes) },
  ]);
}
