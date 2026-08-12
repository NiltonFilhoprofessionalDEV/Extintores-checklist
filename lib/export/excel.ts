import * as XLSX from "xlsx-js-style";
import { codigoPertenceEquipe, type EquipeConferenciaId } from "@/lib/equipes/conferencia-filtro";
import { COLUNAS_EXTINTOR, COLUNAS_PADRAO } from "@/lib/inventario/equipamento-padrao";
import {
  corLinhaConferenciaExport,
  resolveExtintorConferenciaExport,
  resolveHidranteConferenciaExport,
  type ConferenciaExportStatus,
} from "@/lib/export/conferencia-historico";
import type { HidranteVencimentoRow } from "@/lib/hidrantes/vencimento-mangueiras";
import { hidranteTemMangueiraVencida } from "@/lib/hidrantes/vencimento-mangueiras";
import { HIDRANTE_ACTIVE_ITEM_KEYS, HIDRANTE_ITEM_LABELS } from "@/lib/checklist/hidrante-types";
import { CHECKLIST_EXPORT_COLUMN_LABELS } from "@/lib/checklist/export-labels";
import { CHECKLIST_ITEM_KEYS, dataVencimentoTeste, isDataVencida } from "@/lib/checklist/types";
import { formatDateOnlyPt } from "@/lib/date/date-only";

export type ExtintorRow = {
  id: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
  num_cilindro?: string | null;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  coord_x: number | null;
  coord_y: number | null;
  pavimento: string | null;
  created_at: string;
};

export type ChecklistRow = {
  id: string;
  extintor_id: string;
  data_conferencia: string;
  conferente: string;
  local_correto: string | null;
  dados_corretos: string | null;
  sinalizacao_correta: string | null;
  mangueira_status: string | null;
  bico_difusor_status: string | null;
  alca_gatilho_status: string | null;
  medidor_pressao_status: string | null;
  cilindro_status: string | null;
  status_lacre?: boolean;
  status_manometro?: boolean;
  observacoes: string | null;
  created_at: string;
};

export type ExtintorComConferencias = ExtintorRow & {
  checklists: ChecklistRow[];
};

export type ExtintorChecklistExportItem = {
  codigo: string;
  setor: string;
  local_detalhado: string;
  checklist: ChecklistRow;
};

export type HidranteChecklistExportItem = {
  codigo: string;
  pavimento: string;
  local_detalhado: string;
  checklist: ChecklistHidranteRow;
};

export type HidranteExportRow = {
  id: string;
  codigo: string;
  pavimento: string | null;
  local_detalhado: string;
  coord_x: number | null;
  coord_y: number | null;
  created_at: string;
};

export type ChecklistHidranteRow = {
  id: string;
  hidrante_id: string;
  data_conferencia: string;
  conferente: string;
  acesso_desobstruido: string | null;
  identificacao_sinalizacao: string | null;
  mangueira_esguicho: string | null;
  valvulas_registros: string | null;
  pressao_abastecimento: string | null;
  gabinete_caixa: string | null;
  hidrante_integridade: string | null;
  documentacao_acesso: string | null;
  observacoes: string | null;
  created_at: string;
};

export type HidranteComInspecoes = HidranteExportRow & {
  checklists: ChecklistHidranteRow[];
};

export type InspecaoMarcadorEmergenciaRow = {
  id: string;
  marcador_emergencia_id: string;
  marcador_kind: string;
  pavimento: string | null;
  data_inspecao: string;
  conferente: string;
  inspecao_resultado: string;
  nao_conformidade_descricao: string | null;
  created_at: string;
};

function formatDate(value: string | null): string {
  if (!value) return "";
  const formatted = formatDateOnlyPt(value);
  return formatted === "—" ? "" : formatted;
}

function formatDateValue(value: string | Date | null): string {
  if (!value) return "";
  const formatted = formatDateOnlyPt(value);
  return formatted === "—" ? "" : formatted;
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR");
}

/** Ordem crescente por código (ex.: EXT-2 antes de EXT-10). */
export function compareCodigo(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

function sortExtintoresByCodigo(extintores: ExtintorRow[]): ExtintorRow[] {
  return [...extintores].sort((a, b) => compareCodigo(a.codigo, b.codigo));
}

function sortHidrantesByCodigo(hidrantes: HidranteExportRow[]): HidranteExportRow[] {
  return [...hidrantes].sort((a, b) => compareCodigo(a.codigo, b.codigo));
}

function sortExtintorChecklistItems(items: ExtintorChecklistExportItem[]): ExtintorChecklistExportItem[] {
  return [...items].sort((a, b) => {
    const byCodigo = compareCodigo(a.codigo, b.codigo);
    if (byCodigo !== 0) return byCodigo;
    return (
      new Date(a.checklist.data_conferencia).getTime() -
      new Date(b.checklist.data_conferencia).getTime()
    );
  });
}

function sortHidranteChecklistItems(items: HidranteChecklistExportItem[]): HidranteChecklistExportItem[] {
  return [...items].sort((a, b) => {
    const byCodigo = compareCodigo(a.codigo, b.codigo);
    if (byCodigo !== 0) return byCodigo;
    return (
      new Date(a.checklist.data_conferencia).getTime() -
      new Date(b.checklist.data_conferencia).getTime()
    );
  });
}

type StyledCell = XLSX.CellObject & {
  s?: Record<string, unknown>;
};

const EXCEL_HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: "FF70AD47" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "FF548235" } },
    bottom: { style: "thin", color: { rgb: "FF548235" } },
    left: { style: "thin", color: { rgb: "FF548235" } },
    right: { style: "thin", color: { rgb: "FF548235" } },
  },
};

const EXCEL_BODY_BORDER = {
  top: { style: "thin", color: { rgb: "FFD9EAD3" } },
  bottom: { style: "thin", color: { rgb: "FFD9EAD3" } },
  left: { style: "thin", color: { rgb: "FFD9EAD3" } },
  right: { style: "thin", color: { rgb: "FFD9EAD3" } },
};

function applyConferenciaHistoricoStyle(
  ws: XLSX.WorkSheet,
  rowStatuses: ConferenciaExportStatus[],
): void {
  if (!ws["!ref"]) return;

  const range = XLSX.utils.decode_range(ws["!ref"]);
  ws["!autofilter"] = { ref: ws["!ref"] };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!rows"] = [{ hpt: 24 }];

  let bodyIndex = 0;
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = (ws[address] ?? { t: "s", v: "" }) as StyledCell;
      ws[address] = cell;

      if (row === range.s.r) {
        cell.s = EXCEL_HEADER_STYLE;
        continue;
      }

      const status = rowStatuses[bodyIndex] ?? "conforme";
      const fillRgb = corLinhaConferenciaExport(status, bodyIndex);
      const border =
        status === "vencido"
          ? {
              top: { style: "thin", color: { rgb: "FFEF9A9A" } },
              bottom: { style: "thin", color: { rgb: "FFEF9A9A" } },
              left: { style: "thin", color: { rgb: "FFEF9A9A" } },
              right: { style: "thin", color: { rgb: "FFEF9A9A" } },
            }
          : EXCEL_BODY_BORDER;
      cell.s = {
        fill: { patternType: "solid", fgColor: { rgb: fillRgb } },
        alignment: { vertical: "center", wrapText: true },
        border,
      };
    }
    if (row > range.s.r) bodyIndex += 1;
  }
}

export type AlertaVencimentoRowHighlight = "vencido" | "alerta" | "none";

function applyAlertaVencimentoStyle(ws: XLSX.WorkSheet, rowHighlight: AlertaVencimentoRowHighlight): void {
  if (rowHighlight === "none") {
    applyGreenTableStyle(ws);
    return;
  }
  if (!ws["!ref"]) return;

  const range = XLSX.utils.decode_range(ws["!ref"]);
  ws["!autofilter"] = { ref: ws["!ref"] };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!rows"] = [{ hpt: 24 }];

  const status: ConferenciaExportStatus = rowHighlight === "vencido" ? "vencido" : "alerta";
  let bodyIndex = 0;
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = (ws[address] ?? { t: "s", v: "" }) as StyledCell;
      ws[address] = cell;

      if (row === range.s.r) {
        cell.s = EXCEL_HEADER_STYLE;
        continue;
      }

      const fillRgb = corLinhaConferenciaExport(status, bodyIndex);
      const border =
        status === "vencido"
          ? {
              top: { style: "thin", color: { rgb: "FFEF9A9A" } },
              bottom: { style: "thin", color: { rgb: "FFEF9A9A" } },
              left: { style: "thin", color: { rgb: "FFEF9A9A" } },
              right: { style: "thin", color: { rgb: "FFEF9A9A" } },
            }
          : EXCEL_BODY_BORDER;
      cell.s = {
        fill: { patternType: "solid", fgColor: { rgb: fillRgb } },
        alignment: { vertical: "center", wrapText: true },
        border,
      };
    }
    if (row > range.s.r) bodyIndex += 1;
  }
}

function applyInventarioExportStyle(ws: XLSX.WorkSheet, vencidoPorLinha: boolean[]): void {
  if (!ws["!ref"]) return;

  const range = XLSX.utils.decode_range(ws["!ref"]);
  ws["!autofilter"] = { ref: ws["!ref"] };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!rows"] = [{ hpt: 24 }];

  let bodyIndex = 0;
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = (ws[address] ?? { t: "s", v: "" }) as StyledCell;
      ws[address] = cell;

      if (row === range.s.r) {
        cell.s = EXCEL_HEADER_STYLE;
        continue;
      }

      const status: ConferenciaExportStatus = vencidoPorLinha[bodyIndex] ? "vencido" : "conforme";
      const fillRgb = corLinhaConferenciaExport(status, bodyIndex);
      const border =
        status === "vencido"
          ? {
              top: { style: "thin", color: { rgb: "FFEF9A9A" } },
              bottom: { style: "thin", color: { rgb: "FFEF9A9A" } },
              left: { style: "thin", color: { rgb: "FFEF9A9A" } },
              right: { style: "thin", color: { rgb: "FFEF9A9A" } },
            }
          : EXCEL_BODY_BORDER;
      cell.s = {
        fill: { patternType: "solid", fgColor: { rgb: fillRgb } },
        alignment: { vertical: "center", wrapText: true },
        border,
      };
    }
    if (row > range.s.r) bodyIndex += 1;
  }
}

function applyGreenTableStyle(ws: XLSX.WorkSheet): void {
  if (!ws["!ref"]) return;

  const range = XLSX.utils.decode_range(ws["!ref"]);
  ws["!autofilter"] = { ref: ws["!ref"] };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!rows"] = [{ hpt: 24 }];

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = (ws[address] ?? { t: "s", v: "" }) as StyledCell;
      ws[address] = cell;

      if (row === range.s.r) {
        cell.s = EXCEL_HEADER_STYLE;
        continue;
      }

      cell.s = {
        fill: {
          patternType: "solid",
          fgColor: { rgb: row % 2 === 0 ? "FFE2F0D9" : "FFFFFFFF" },
        },
        alignment: { vertical: "center", wrapText: true },
        border: EXCEL_BODY_BORDER,
      };
    }
  }
}

function jsonToSheet(rows: Record<string, string | number>[]): ReturnType<typeof XLSX.utils.json_to_sheet> {
  if (rows.length === 0) {
    return XLSX.utils.json_to_sheet([
      { Mensagem: "Nenhum registro encontrado para exportação." },
    ]);
  }
  return XLSX.utils.json_to_sheet(rows);
}

export type HidranteVencimentoExportRow = {
  id: string;
  codigo: string;
  pavimento: string | null;
  local_detalhado: string;
  quantidade_mangueiras: number | null;
  teste_hidrostatico_m1: string | null;
  teste_hidrostatico_m2: string | null;
  teste_hidrostatico_m3: string | null;
  teste_hidrostatico_m4: string | null;
};

/** Export 1: All extintores with basic data */
export function exportExtintoresBasico(extintores: ExtintorRow[]): void {
  const rows = sortExtintoresByCodigo(extintores).map((e) => ({
    [COLUNAS_EXTINTOR.codigo]: e.codigo,
    [COLUNAS_EXTINTOR.pavimento]: e.setor,
    [COLUNAS_EXTINTOR.localDetalhado]: e.local_detalhado,
    [COLUNAS_EXTINTOR.numInmetro]: e.num_inmetro,
    [COLUNAS_EXTINTOR.numCilindro]: e.num_cilindro ?? "",
    [COLUNAS_EXTINTOR.tipo]: e.tipo,
    [COLUNAS_EXTINTOR.tamanho]: e.tamanho,
    [COLUNAS_EXTINTOR.capacidadeExtintora]: e.capacidade_extintora,
    "Pavimento na planta": e.pavimento ?? "",
    [COLUNAS_EXTINTOR.manutencao2]: formatDate(e.manutencao_2_nivel),
    [COLUNAS_EXTINTOR.manutencao3]: formatDate(e.manutencao_3_nivel),
    "Posicionado no Mapa": e.coord_x != null ? "Sim" : "Não",
    "Cadastrado em": formatDate(e.created_at),
  }));

  const ws = jsonToSheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 18 },
    { wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 18 },
  ];
  applyGreenTableStyle(ws);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Extintores");
  XLSX.writeFile(wb, `extintores_${today()}.xlsx`);
}

export type HidranteInventarioCompletoRow = HidranteVencimentoExportRow & {
  quantidade_chaves_storz: number | null;
  quantidade_esguichos: number | null;
  coord_x: number | null;
  coord_y: number | null;
  created_at: string;
};

function buildExtintorInventarioExport(extintores: ExtintorRow[]): {
  rows: Record<string, string | number>[];
  vencidoPorLinha: boolean[];
} {
  const sorted = sortExtintoresByCodigo(extintores);
  const vencidoPorLinha = sorted.map(
    (e) => isDataVencida(e.manutencao_2_nivel) || isDataVencida(e.manutencao_3_nivel),
  );
  const rows = sorted.map((e) => ({
    [COLUNAS_EXTINTOR.codigo]: e.codigo,
    [COLUNAS_EXTINTOR.pavimento]: e.setor,
    [COLUNAS_EXTINTOR.localDetalhado]: e.local_detalhado,
    [COLUNAS_EXTINTOR.numInmetro]: e.num_inmetro,
    [COLUNAS_EXTINTOR.numCilindro]: e.num_cilindro ?? "",
    [COLUNAS_EXTINTOR.tipo]: e.tipo,
    [COLUNAS_EXTINTOR.tamanho]: e.tamanho,
    [COLUNAS_EXTINTOR.capacidadeExtintora]: e.capacidade_extintora,
    "Pavimento na planta": e.pavimento ?? "",
    [COLUNAS_EXTINTOR.manutencao2]: formatDate(e.manutencao_2_nivel),
    [COLUNAS_EXTINTOR.manutencao3]: formatDate(e.manutencao_3_nivel),
  }));
  return { rows, vencidoPorLinha };
}

function buildHidranteInventarioExport(hidrantes: HidranteInventarioCompletoRow[]): {
  rows: Record<string, string | number>[];
  vencidoPorLinha: boolean[];
} {
  const sorted = [...hidrantes].sort((a, b) => compareCodigo(a.codigo, b.codigo));
  const vencidoPorLinha = sorted.map((h) => hidranteTemMangueiraVencida(h));
  const rows = sorted.map((h) => ({
    Código: h.codigo,
    Pavimento: h.pavimento ?? "",
    "Local detalhado": h.local_detalhado,
    "Quantidade de Mangueiras": h.quantidade_mangueiras ?? "",
    "Últ. teste hidrostático M-1": formatDate(h.teste_hidrostatico_m1),
    "Últ. teste hidrostático M-2": formatDate(h.teste_hidrostatico_m2),
    "Últ. teste hidrostático M-3": formatDate(h.teste_hidrostatico_m3),
    "Últ. teste hidrostático M-4": formatDate(h.teste_hidrostatico_m4),
    "Quantidade de Chaves Storz": h.quantidade_chaves_storz ?? "",
    "Quantidade de Esguichos": h.quantidade_esguichos ?? "",
  }));
  return { rows, vencidoPorLinha };
}

/** Inventário completo: um arquivo Excel com planilhas Extintores e Hidrantes. */
export function exportInventarioCompleto(
  extintores: ExtintorRow[],
  hidrantes: HidranteInventarioCompletoRow[],
): void {
  const extExport = buildExtintorInventarioExport(extintores);
  const extWs = jsonToSheet(extExport.rows);
  extWs["!cols"] = [
    { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
    { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 28 },
  ];
  applyInventarioExportStyle(extWs, extExport.vencidoPorLinha);

  const hidExport = buildHidranteInventarioExport(hidrantes);
  const hidWs = jsonToSheet(hidExport.rows);
  hidWs["!cols"] = [
    { wch: 14 }, { wch: 18 }, { wch: 32 }, { wch: 16 },
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 18 }, { wch: 18 },
  ];
  applyInventarioExportStyle(hidWs, hidExport.vencidoPorLinha);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, extWs, "Extintores");
  XLSX.utils.book_append_sheet(wb, hidWs, "Hidrantes");
  XLSX.writeFile(wb, `inventario_extintores_hidrantes_${today()}.xlsx`);
}

/** Uma linha por checklist de extintor (histórico completo). */
export function exportExtintoresComConferencias(items: ExtintorChecklistExportItem[]): void {
  const rows: Record<string, string>[] = sortExtintorChecklistItems(items).map(
    ({ codigo, setor, local_detalhado, checklist: c }) => {
      const row: Record<string, string> = {
        "Código do Extintor": codigo,
        Setor: setor,
        "Local Detalhado": local_detalhado,
        "Data da Conferência": formatDateTime(c.data_conferencia),
        Conferente: c.conferente,
      };

      for (const key of CHECKLIST_ITEM_KEYS) {
        row[CHECKLIST_EXPORT_COLUMN_LABELS[key]] = normalizeChecklistValue(c[key]);
      }

      if (c.status_lacre !== undefined) {
        row["Lacre (campo legado)"] = c.status_lacre ? "Sim" : "Não";
      }
      if (c.status_manometro !== undefined) {
        row["Manômetro (campo legado)"] = c.status_manometro ? "Sim" : "Não";
      }

      row.Observações = c.observacoes ?? "";
      return row;
    },
  );

  const ws = jsonToSheet(rows);
  ws["!cols"] = [
    { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 28 },
    { wch: 28 }, { wch: 24 }, { wch: 32 }, { wch: 34 },
    { wch: 42 }, { wch: 28 }, { wch: 30 }, { wch: 30 },
  ];
  applyGreenTableStyle(ws);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Extintores + Conferências");
  XLSX.writeFile(wb, `extintores_conferencias_${today()}.xlsx`);
}

/** Uma linha por hidrante — dados cadastrais e mapa */
export function exportHidrantesBasico(hidrantes: HidranteExportRow[]): void {
  const rows = sortHidrantesByCodigo(hidrantes).map((h) => ({
    Código: h.codigo,
    Pavimento: h.pavimento ?? "",
    "Local detalhado": h.local_detalhado,
    "Posicionado no mapa": h.coord_x != null ? "Sim" : "Não",
    "Cadastrado em": formatDate(h.created_at),
  }));

  const ws = jsonToSheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 36 }, { wch: 20 }, { wch: 18 }];
  applyGreenTableStyle(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hidrantes");
  XLSX.writeFile(wb, `hidrantes_${today()}.xlsx`);
}

/** Uma linha por inspeção de hidrante (checklists_hidrantes). */
export function exportHidrantesComInspecoes(items: HidranteChecklistExportItem[]): void {
  const rows: Record<string, string>[] = sortHidranteChecklistItems(items).map(({ codigo, pavimento, local_detalhado, checklist: c }) => ({
    "Código do hidrante": codigo,
    Pavimento: pavimento,
    "Local detalhado": local_detalhado,
    "Data da inspeção": formatDateTime(c.data_conferencia),
    Conferente: c.conferente,
    ...Object.fromEntries(
      HIDRANTE_ACTIVE_ITEM_KEYS.map((key) => [
        HIDRANTE_ITEM_LABELS[key],
        normalizeChecklistValue(c[key]),
      ]),
    ),
    Observações: c.observacoes ?? "",
  }));

  const ws = jsonToSheet(rows);
  ws["!cols"] = [
    { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 30 }, { wch: 26 },
    { wch: 26 }, { wch: 28 }, { wch: 24 }, { wch: 32 }, { wch: 36 }, { wch: 40 },
  ];
  applyGreenTableStyle(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hidrantes + Inspeções");
  XLSX.writeFile(wb, `hidrantes_inspecoes_${today()}.xlsx`);
}

function labelMarcadorEmergenciaKind(kind: string): string {
  if (kind === "luz_emergencia") return "Luz de emergência";
  if (kind === "placa_saida_emergencia") return "Placa saída de emergência";
  return kind;
}

function labelResultadoInspecao(v: string): string {
  if (v === "conforme") return "Conforme";
  if (v === "nao_conforme") return "Não conforme";
  return v;
}

/** Histórico de inspeções de luz/placa (tabela inspecoes_marcadores_emergencia) */
export function exportInspecoesMarcadoresEmergencia(rows: InspecaoMarcadorEmergenciaRow[]): void {
  const out = rows.map((r) => ({
    "Tipo de ponto": labelMarcadorEmergenciaKind(r.marcador_kind),
    Pavimento: r.pavimento ?? "",
    "Data da inspeção": formatDateTime(r.data_inspecao),
    Conferente: r.conferente,
    Resultado: labelResultadoInspecao(r.inspecao_resultado),
    "Descrição não conformidade": r.nao_conformidade_descricao ?? "",
    "ID marcador (mapa)": r.marcador_emergencia_id,
    "ID registro": r.id,
    "Registro criado em": formatDateTime(r.created_at),
  }));

  const ws = jsonToSheet(out);
  ws["!cols"] = [
    { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 40 }, { wch: 38 }, { wch: 38 }, { wch: 22 },
  ];
  applyGreenTableStyle(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Luz e placa");
  XLSX.writeFile(wb, `inspecoes_luz_placa_${today()}.xlsx`);
}

/** Export: alertas de vencimento de mangueiras (hidrantes) */
export function exportAlertasVencimentoHidrantes(
  hidrantes: HidranteVencimentoExportRow[],
  label: string,
  rowHighlight: AlertaVencimentoRowHighlight = "none",
): void {
  const rows = [...hidrantes]
    .sort((a, b) => compareCodigo(a.codigo, b.codigo))
    .map((h) => ({
      Código: h.codigo,
      Pavimento: h.pavimento ?? "",
      "Local detalhado": h.local_detalhado,
      "Qtd. mangueiras": h.quantidade_mangueiras ?? "",
      "Últ. teste M-1": formatDate(h.teste_hidrostatico_m1),
      "Venc. M-1": formatDateValue(dataVencimentoTeste(h.teste_hidrostatico_m1)),
      "Últ. teste M-2": formatDate(h.teste_hidrostatico_m2),
      "Últ. teste M-3": formatDate(h.teste_hidrostatico_m3),
      "Últ. teste M-4": formatDate(h.teste_hidrostatico_m4),
    }));

  const ws = jsonToSheet(rows);
  ws["!cols"] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 30 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];
  applyAlertaVencimentoStyle(ws, rowHighlight);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
  XLSX.writeFile(wb, `alertas_hidrantes_${label.replace(/\s+/g, "_")}_${today()}.xlsx`);
}

/** Export 3: Filtered alert list (vencimentos) */
export function exportAlertasVencimento(
  extintores: ExtintorRow[],
  label: string,
  rowHighlight: AlertaVencimentoRowHighlight = "none",
): void {
  const rows = sortExtintoresByCodigo(extintores).map((e) => ({
    [COLUNAS_EXTINTOR.codigo]: e.codigo,
    [COLUNAS_EXTINTOR.pavimento]: e.setor,
    [COLUNAS_EXTINTOR.localDetalhado]: e.local_detalhado,
    [COLUNAS_EXTINTOR.numInmetro]: e.num_inmetro,
    [COLUNAS_EXTINTOR.numCilindro]: e.num_cilindro ?? "",
    [COLUNAS_EXTINTOR.tipo]: e.tipo,
    [COLUNAS_EXTINTOR.tamanho]: e.tamanho,
    "Pavimento na planta": e.pavimento ?? "",
    [COLUNAS_EXTINTOR.manutencao2]: formatDate(e.manutencao_2_nivel),
    [COLUNAS_EXTINTOR.manutencao3]: formatDate(e.manutencao_3_nivel),
  }));

  const ws = jsonToSheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 28 }, { wch: 28 },
  ];
  applyAlertaVencimentoStyle(ws, rowHighlight);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
  XLSX.writeFile(wb, `alertas_${label.replace(/\s+/g, "_")}_${today()}.xlsx`);
}

export type ConferenciaHistoricoExtintorRow = {
  id: string;
  data_conferencia: string;
  conferente: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  tipo: string;
  tamanho: string;
  equipe: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  checklistRaw: Record<string, unknown>;
  /** Quando vindo da listagem filtrada, evita recalcular observação/status. */
  observacao?: string;
  exportStatus?: ConferenciaExportStatus;
};

export type ConferenciaHistoricoHidranteRow = {
  id: string;
  data_conferencia: string;
  conferente: string;
  codigo: string;
  pavimento: string;
  local_detalhado: string;
  equipe: string;
  hidrante: HidranteVencimentoRow | null;
  checklistRaw: Record<string, unknown>;
  observacao?: string;
  exportStatus?: ConferenciaExportStatus;
};

export type ConferenciasHistoricoExportOptions = {
  /** Sufixo opcional no nome do arquivo quando há filtros ativos. */
  sufixoArquivo?: string;
};

function resolveEquipeLabel(codigo: string, tipo: "extintor" | "hidrante"): string {
  const ids: EquipeConferenciaId[] = ["equipe_1", "equipe_2", "equipe_3", "equipe_4"];
  for (const id of ids) {
    if (codigoPertenceEquipe(codigo, id, tipo)) {
      return id.replace("equipe_", "Equipe ");
    }
  }
  return "";
}

/** Histórico de conferências: sempre gera planilhas Extintores e Hidrantes no mesmo arquivo. */
export function exportConferenciasHistorico(
  extintores: ConferenciaHistoricoExtintorRow[],
  hidrantes: ConferenciaHistoricoHidranteRow[],
  options?: ConferenciasHistoricoExportOptions,
): void {
  const extSorted = [...extintores].sort(
    (a, b) =>
      compareCodigo(a.codigo, b.codigo) ||
      new Date(a.data_conferencia).getTime() - new Date(b.data_conferencia).getTime(),
  );
  const extStatuses: ConferenciaExportStatus[] = [];
  const extRows = extSorted.map((r) => {
    const resolved = resolveExtintorConferenciaExport(
      r.checklistRaw,
      r.manutencao_2_nivel,
      r.manutencao_3_nivel ?? null,
    );
    const status = resolved.status;
    const observacao = r.observacao ?? resolved.observacao;
    extStatuses.push(status);
    return {
      [COLUNAS_PADRAO.equipe]: r.equipe || resolveEquipeLabel(r.codigo, "extintor"),
      [COLUNAS_PADRAO.codigo]: r.codigo,
      [COLUNAS_PADRAO.pavimento]: r.setor,
      [COLUNAS_PADRAO.localDetalhado]: r.local_detalhado,
      [COLUNAS_PADRAO.tipo]: r.tipo,
      [COLUNAS_PADRAO.tamanho]: r.tamanho,
      [COLUNAS_PADRAO.venctoN2]: formatDate(r.manutencao_2_nivel),
      [COLUNAS_PADRAO.venctoN3]: formatDate(r.manutencao_3_nivel),
      [COLUNAS_PADRAO.dataConferencia]: formatDateTime(r.data_conferencia),
      [COLUNAS_PADRAO.conferente]: r.conferente,
      [COLUNAS_PADRAO.observacao]: observacao,
    };
  });

  const hidSorted = [...hidrantes].sort(
    (a, b) =>
      compareCodigo(a.codigo, b.codigo) ||
      new Date(a.data_conferencia).getTime() - new Date(b.data_conferencia).getTime(),
  );
  const hidStatuses: ConferenciaExportStatus[] = [];
  const hidRows = hidSorted.map((r) => {
    const resolved = resolveHidranteConferenciaExport(r.checklistRaw, r.hidrante);
    const status = resolved.status;
    const observacao = r.observacao ?? resolved.observacao;
    const h = r.hidrante;
    hidStatuses.push(status);
    return {
      [COLUNAS_PADRAO.equipe]: r.equipe || resolveEquipeLabel(r.codigo, "hidrante"),
      [COLUNAS_PADRAO.codigo]: r.codigo,
      [COLUNAS_PADRAO.pavimento]: r.pavimento,
      [COLUNAS_PADRAO.localDetalhado]: r.local_detalhado,
      "Qtd. mangueiras": h?.quantidade_mangueiras ?? "",
      "Teste hidrostático M-1": formatDate(h?.teste_hidrostatico_m1 ?? null),
      "Teste hidrostático M-2": formatDate(h?.teste_hidrostatico_m2 ?? null),
      "Teste hidrostático M-3": formatDate(h?.teste_hidrostatico_m3 ?? null),
      "Teste hidrostático M-4": formatDate(h?.teste_hidrostatico_m4 ?? null),
      "Qtd. esguichos": h?.quantidade_esguichos ?? "",
      "Qtd. chaves Storz": h?.quantidade_chaves_storz ?? "",
      [COLUNAS_PADRAO.dataConferencia]: formatDateTime(r.data_conferencia),
      [COLUNAS_PADRAO.conferente]: r.conferente,
      [COLUNAS_PADRAO.observacao]: observacao,
    };
  });

  const wb = XLSX.utils.book_new();

  const wsExt = jsonToSheet(extRows);
  wsExt["!cols"] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 32 },
    { wch: 14 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
    { wch: 48 },
  ];
  applyConferenciaHistoricoStyle(wsExt, extStatuses);
  XLSX.utils.book_append_sheet(wb, wsExt, "Extintores");

  const wsHid = jsonToSheet(hidRows);
  wsHid["!cols"] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 32 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 24 },
    { wch: 48 },
  ];
  applyConferenciaHistoricoStyle(wsHid, hidStatuses);
  XLSX.utils.book_append_sheet(wb, wsHid, "Hidrantes");

  const sufixo = options?.sufixoArquivo?.trim();
  const nomeBase = sufixo ? `conferencias_${sufixo}_${today()}` : `conferencias_historico_${today()}`;
  XLSX.writeFile(wb, `${nomeBase}.xlsx`);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeChecklistValue(value: string | null): string {
  if (!value) return "";
  if (value === "conforme") return "Conforme";
  if (value === "nao_conforme") return "Não conforme";
  if (value === "nao_aplica") return "Não se aplica";
  return value;
}
