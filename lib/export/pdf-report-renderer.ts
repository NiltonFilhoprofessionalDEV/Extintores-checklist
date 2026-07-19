import type { jsPDF } from "jspdf";

export type PdfCell = string | number | null | undefined;
export type PdfRow = Record<string, PdfCell>;
export type PdfSection = { title: string; rows: PdfRow[] };
export type PdfExportResult = { ok: true } | { ok: false; reason: "generation_failed" };

const PAGE = { width: 210, height: 297, margin: 12, bottom: 284 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const ORANGE = [249, 115, 22] as const;
const GRAPHITE = [28, 31, 35] as const;
const MUTED = [104, 112, 120] as const;
const BORDER = [227, 229, 231] as const;
const SURFACE = [247, 248, 249] as const;

function text(value: PdfCell): string {
  return String(value ?? "").trim() || "Não informado";
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function color(doc: jsPDF, value: readonly [number, number, number]) {
  doc.setTextColor(value[0], value[1], value[2]);
}

function pageHeader(doc: jsPDF, title: string) {
  doc.setFillColor(...GRAPHITE);
  doc.rect(0, 0, PAGE.width, 13, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("FIRECHECK", PAGE.margin, 8.7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 204, 208);
  doc.text(title, PAGE.width - PAGE.margin, 8.7, { align: "right", maxWidth: 120 });
  doc.setFillColor(...ORANGE);
  doc.rect(0, 13, PAGE.width, 1.2, "F");
}

function cover(doc: jsPDF, title: string, sections: PdfSection[]) {
  doc.setFillColor(...GRAPHITE);
  doc.rect(0, 0, PAGE.width, 74, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, 7, 74, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 184, 132);
  doc.text("FIRECHECK · RELATÓRIO OPERACIONAL", PAGE.margin, 20);
  doc.setFontSize(27);
  doc.setTextColor(255, 255, 255);
  doc.text(doc.splitTextToSize(title, 165) as string[], PAGE.margin, 37);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 204, 208);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, PAGE.margin, 64);

  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  color(doc, GRAPHITE);
  doc.text("RESUMO DO RELATÓRIO", PAGE.margin, 96);
  const summaries = [{ title: "Total", count: total }, ...sections].slice(0, 3);
  summaries.forEach((summary, index) => {
    const x = PAGE.margin + index * 60;
    doc.setFillColor(index === 0 ? 247 : 255, index === 0 ? 248 : 247, index === 0 ? 249 : 237);
    doc.roundedRect(x, 104, 54, 38, 4, 4, "F");
    doc.setFontSize(24);
    if (index === 0) color(doc, GRAPHITE);
    else doc.setTextColor(...ORANGE);
    doc.text(String("count" in summary ? summary.count : summary.rows.length), x + 6, 123);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    color(doc, MUTED);
    doc.text(summary.title.toUpperCase().slice(0, 24), x + 6, 134);
    doc.setFont("helvetica", "bold");
  });

  doc.setFontSize(11);
  color(doc, GRAPHITE);
  doc.text("CONTEÚDO", PAGE.margin, 170);
  sections.forEach((section, index) => {
    const y = 182 + index * 18;
    doc.setFillColor(...ORANGE);
    doc.circle(PAGE.margin + 3, y - 1.5, 2.5, "F");
    doc.setFontSize(11);
    doc.text(`${index + 1}. ${section.title}`, PAGE.margin + 10, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    color(doc, MUTED);
    doc.text(`${section.rows.length} registros`, PAGE.width - PAGE.margin, y, { align: "right" });
    doc.setDrawColor(...BORDER);
    doc.line(PAGE.margin + 10, y + 5, PAGE.width - PAGE.margin, y + 5);
    doc.setFont("helvetica", "bold");
  });
}

function ensure(doc: jsPDF, y: number, height: number, title: string): number {
  if (y + height <= PAGE.bottom) return y;
  doc.addPage();
  pageHeader(doc, title);
  return 22;
}

function statusColor(status: string): readonly [number, number, number] {
  const normalized = status.toLowerCase();
  if (normalized.includes("venc")) return [225, 29, 72];
  if (normalized.includes("alert") || normalized.includes("não conforme")) return [217, 119, 6];
  return [22, 163, 74];
}

function recordHeading(doc: jsPDF, row: PdfRow, index: number, y: number) {
  const code = row.Código ?? row["Código do Extintor"] ?? row["Código do hidrante"];
  doc.setFillColor(...SURFACE);
  doc.roundedRect(PAGE.margin, y, CONTENT_WIDTH, 10, 2.5, 2.5, "F");
  doc.setFillColor(...ORANGE);
  doc.roundedRect(PAGE.margin, y, 2.5, 10, 1.25, 1.25, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  color(doc, GRAPHITE);
  doc.text(code ? `Registro ${index + 1} · ${text(code)}` : `Registro ${index + 1}`, PAGE.margin + 7, y + 6.8);
  if (row.Status) {
    doc.setFontSize(7);
    color(doc, statusColor(text(row.Status)));
    doc.text(text(row.Status).toUpperCase(), PAGE.width - PAGE.margin - 3, y + 6.8, { align: "right" });
  }
}

function drawShortFields(
  doc: jsPDF,
  entries: [string, PdfCell][],
  startY: number,
  title: string,
): number {
  let y = startY;
  const gap = 4;
  const width = (CONTENT_WIDTH - gap * 2) / 3;
  for (let index = 0; index < entries.length; index += 3) {
    const group = entries.slice(index, index + 3);
    const lines = group.map(([, value]) => doc.splitTextToSize(text(value), width - 3) as string[]);
    const height = Math.max(...lines.map((value) => value.length * 3.5 + 6), 10);
    y = ensure(doc, y, height + 1, title);
    group.forEach(([label, value], groupIndex) => {
      const x = PAGE.margin + groupIndex * (width + gap);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      color(doc, MUTED);
      doc.text(label.toUpperCase(), x, y + 2.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      color(doc, GRAPHITE);
      doc.text(doc.splitTextToSize(text(value), width - 3) as string[], x, y + 6);
    });
    doc.setDrawColor(...BORDER);
    doc.line(PAGE.margin, y + height, PAGE.width - PAGE.margin, y + height);
    y += height + 1.5;
  }
  return y;
}

function drawLongField(doc: jsPDF, label: string, value: PdfCell, startY: number, title: string): number {
  let y = ensure(doc, startY, 14, title);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  color(doc, MUTED);
  doc.text(label.toUpperCase(), PAGE.margin, y + 2.5);
  y += 6;
  for (const line of doc.splitTextToSize(text(value), CONTENT_WIDTH) as string[]) {
    y = ensure(doc, y, 5, title);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    color(doc, GRAPHITE);
    doc.text(line, PAGE.margin, y);
    y += 3.8;
  }
  return y + 2.5;
}

function record(doc: jsPDF, row: PdfRow, index: number, startY: number, title: string): number {
  let y = ensure(doc, startY, 15, title);
  recordHeading(doc, row, index, y);
  y += 13;
  const ignored = new Set(["Código", "Código do Extintor", "Código do hidrante", "Status"]);
  const entries = Object.entries(row).filter(([key]) => !ignored.has(key));
  y = drawShortFields(doc, entries.filter(([, value]) => text(value).length <= 100), y, title);
  for (const [label, value] of entries.filter(([, value]) => text(value).length > 100)) {
    y = drawLongField(doc, label, value, y, title);
  }
  return y + 4;
}

function section(doc: jsPDF, value: PdfSection, title: string) {
  doc.addPage();
  pageHeader(doc, title);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  color(doc, GRAPHITE);
  doc.text(value.title, PAGE.margin, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  color(doc, MUTED);
  doc.text(`${value.rows.length} registros`, PAGE.margin, 35);
  doc.setFillColor(...ORANGE);
  doc.rect(PAGE.margin, 39, 24, 1.5, "F");
  let y = 47;
  if (value.rows.length === 0) doc.text("Nenhum registro encontrado.", PAGE.margin, y);
  value.rows.forEach((row, index) => { y = record(doc, row, index, y, title); });
}

function footers(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    color(doc, MUTED);
    doc.text(`FireCheck · Página ${page} de ${pages}`, PAGE.width - PAGE.margin, PAGE.height - 8, { align: "right" });
  }
}

export async function downloadPdfReport(title: string, sections: PdfSection[]): Promise<PdfExportResult> {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    cover(doc, title, sections);
    sections.forEach((value) => section(doc, value, title));
    footers(doc);
    doc.save(`${slug(title) || "relatorio"}_${new Date().toISOString().slice(0, 10)}.pdf`);
    return { ok: true };
  } catch (error) {
    console.error("Falha ao gerar PDF", error);
    window.alert("Não foi possível gerar o relatório PDF. Tente novamente.");
    return { ok: false, reason: "generation_failed" };
  }
}
