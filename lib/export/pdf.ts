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

type PdfCell = string | number | null | undefined;
type PdfRow = Record<string, PdfCell>;

type PdfSection = {
  title: string;
  rows: PdfRow[];
};

type PdfExportResult = { ok: true } | { ok: false; reason: "popup_blocked" };

function escapeHtml(value: PdfCell): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function toTable(section: PdfSection): string {
  if (section.rows.length === 0) {
    return `<section><h2>${escapeHtml(section.title)}</h2><p class="empty">Nenhum registro.</p></section>`;
  }
  const columns = Object.keys(section.rows[0]);
  const head = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = section.rows
    .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`)
    .join("");
  return `<section><h2>${escapeHtml(section.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}

export function printPdfReport(title: string, sections: PdfSection[]): PdfExportResult {
  const reportWindow = window.open("", "_blank", "width=1200,height=800");
  if (!reportWindow) {
    window.alert("O navegador bloqueou a janela do relatório. Libere pop-ups e tente novamente.");
    return { ok: false, reason: "popup_blocked" };
  }
  reportWindow.opener = null;

  const generatedAt = new Date().toLocaleString("pt-BR");
  reportWindow.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #181a1d; font: 10px Arial, sans-serif; }
    header { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; border-bottom: 3px solid #f97316; padding-bottom: 10px; }
    h1 { margin: 0; font-size: 22px; }
    h2 { margin: 22px 0 8px; font-size: 15px; }
    .meta { color: #687078; font-size: 9px; }
    section { break-inside: avoid; }
    section + section { break-before: page; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th { background: #1c1f23; color: white; text-align: left; font-size: 8px; letter-spacing: .03em; text-transform: uppercase; }
    th, td { border: 1px solid #dfe2e5; padding: 5px 6px; vertical-align: top; overflow-wrap: anywhere; }
    tbody tr:nth-child(even) { background: #f7f7f7; }
    .empty { border: 1px solid #e3e5e7; border-radius: 8px; padding: 14px; color: #687078; }
    footer { margin-top: 16px; color: #899097; font-size: 8px; }
  </style>
</head>
<body>
  <header><div><div class="meta">FIRECHECK · RELATÓRIO</div><h1>${escapeHtml(title)}</h1></div><div class="meta">Gerado em ${escapeHtml(generatedAt)}</div></header>
  ${sections.map(toTable).join("")}
  <footer>Documento gerado pelo FireCheck.</footer>
  <script>window.addEventListener("load", () => { window.print(); });</script>
</body>
</html>`);
  reportWindow.document.close();
  return { ok: true };
}

function extintorInventoryRows(items: ExtintorRow[]): PdfRow[] {
  return [...items].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })).map((item) => ({
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
  return [...items].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })).map((item) => {
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
): PdfExportResult {
  return printPdfReport("Inventário de equipamentos", [
    { title: "Extintores", rows: extintorInventoryRows(extintores) },
    { title: "Hidrantes", rows: hidranteInventoryRows(hidrantes) },
  ]);
}

export function exportAlertasExtintoresPdf(items: ExtintorRow[], label: string): PdfExportResult {
  return printPdfReport(label, [{ title: "Extintores", rows: extintorInventoryRows(items) }]);
}

export function exportAlertasHidrantesPdf(
  items: HidranteVencimentoExportRow[],
  label: string,
): PdfExportResult {
  return printPdfReport(label, [{ title: "Hidrantes", rows: hidranteInventoryRows(items) }]);
}

export function exportConferenciasPdf(
  extintores: ConferenciaHistoricoExtintorRow[],
  hidrantes: ConferenciaHistoricoHidranteRow[],
  title = "Histórico de conferências",
): PdfExportResult {
  const extRows: PdfRow[] = extintores.map((item) => {
    const resolved = resolveExtintorConferenciaExport(
      item.checklistRaw,
      item.manutencao_2_nivel,
      item.manutencao_3_nivel,
    );
    return {
      Equipe: item.equipe,
      Código: item.codigo,
      Setor: item.setor,
      Local: item.local_detalhado,
      Tipo: item.tipo,
      Tamanho: item.tamanho,
      Data: formatDateTime(item.data_conferencia),
      Conferente: item.conferente,
      Status: item.exportStatus ?? resolved.status,
      Observação: item.observacao ?? resolved.observacao,
    };
  });
  const hidRows: PdfRow[] = hidrantes.map((item) => {
    const resolved = resolveHidranteConferenciaExport(item.checklistRaw, item.hidrante);
    return {
      Equipe: item.equipe,
      Código: item.codigo,
      Pavimento: item.pavimento,
      Local: item.local_detalhado,
      Data: formatDateTime(item.data_conferencia),
      Conferente: item.conferente,
      Status: item.exportStatus ?? resolved.status,
      Observação: item.observacao ?? resolved.observacao,
    };
  });
  return printPdfReport(title, [
    { title: "Extintores", rows: extRows },
    { title: "Hidrantes", rows: hidRows },
  ]);
}
