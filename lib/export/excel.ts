import * as XLSX from "xlsx";

export type ExtintorRow = {
  id: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
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
  status_lacre: boolean;
  status_manometro: boolean;
  observacoes: string | null;
  created_at: string;
};

export type ExtintorComConferencias = ExtintorRow & {
  checklists: ChecklistRow[];
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
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR");
}

/** Export 1: All extintores with basic data */
export function exportExtintoresBasico(extintores: ExtintorRow[]): void {
  const rows = extintores.map((e) => ({
    "Código": e.codigo,
    "Pavimento": e.setor,
    "Local Detalhado": e.local_detalhado,
    "Nº INMETRO": e.num_inmetro,
    "Tipo": e.tipo,
    "Tamanho": e.tamanho,
    "Capacidade Extintora": e.capacidade_extintora,
    "Pavimento na planta": e.pavimento ?? "",
    "Vencto. Manutenção Nível 2": formatDate(e.manutencao_2_nivel),
    "Vencto. Manutenção Nível 3": formatDate(e.manutencao_3_nivel),
    "Posicionado no Mapa": e.coord_x != null ? "Sim" : "Não",
    "Cadastrado em": formatDate(e.created_at),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 18 },
    { wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Extintores");
  XLSX.writeFile(wb, `extintores_${today()}.xlsx`);
}

/** Export 2: Each extintor + all its conference history (one row per checklist) */
export function exportExtintoresComConferencias(
  extintores: ExtintorComConferencias[],
): void {
  const rows: Record<string, string>[] = [];

  for (const e of extintores) {
    for (const c of e.checklists) {
      rows.push({
        "Código do Extintor": e.codigo,
        "Data da Conferência": formatDateTime(c.data_conferencia),
        "Conferente": c.conferente,
        "Local correto conforme mapa": normalizeChecklistValue(c.local_correto),
        "Dados do extintor corretos": normalizeChecklistValue(c.dados_corretos),
        "Sinalização correta": normalizeChecklistValue(c.sinalizacao_correta),
        "Mangueira em boas condições": normalizeChecklistValue(c.mangueira_status),
        "Bico ou difusor em boas condições": normalizeChecklistValue(c.bico_difusor_status),
        "Alça/Gatilho/Lacre/Pino em boas condições": normalizeChecklistValue(
          c.alca_gatilho_status,
        ),
        "Medidor de pressão correto": normalizeChecklistValue(c.medidor_pressao_status),
        "Cilindro em boas condições": normalizeChecklistValue(c.cilindro_status),
        "Observações": c.observacoes ?? "",
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 28 },
    { wch: 28 }, { wch: 24 }, { wch: 32 }, { wch: 34 },
    { wch: 42 }, { wch: 28 }, { wch: 30 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Extintores + Conferências");
  XLSX.writeFile(wb, `extintores_conferencias_${today()}.xlsx`);
}

/** Uma linha por hidrante — dados cadastrais e mapa */
export function exportHidrantesBasico(hidrantes: HidranteExportRow[]): void {
  const rows = hidrantes.map((h) => ({
    Código: h.codigo,
    Pavimento: h.pavimento ?? "",
    "Local detalhado": h.local_detalhado,
    "Posicionado no mapa": h.coord_x != null ? "Sim" : "Não",
    "Cadastrado em": formatDate(h.created_at),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 36 }, { wch: 20 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hidrantes");
  XLSX.writeFile(wb, `hidrantes_${today()}.xlsx`);
}

/** Uma linha por inspeção de hidrante (checklists_hidrantes) */
export function exportHidrantesComInspecoes(hidrantes: HidranteComInspecoes[]): void {
  const rows: Record<string, string>[] = [];

  for (const h of hidrantes) {
    for (const c of h.checklists) {
      rows.push({
        "Código do hidrante": h.codigo,
        Pavimento: h.pavimento ?? "",
        "Local detalhado": h.local_detalhado,
        "Data da inspeção": formatDateTime(c.data_conferencia),
        Conferente: c.conferente,
        "Acesso e desobstrução": normalizeChecklistValue(c.acesso_desobstruido),
        "Identificação e sinalização": normalizeChecklistValue(c.identificacao_sinalizacao),
        "Mangueira e esguicho": normalizeChecklistValue(c.mangueira_esguicho),
        "Válvulas e registros": normalizeChecklistValue(c.valvulas_registros),
        "Pressão / abastecimento": normalizeChecklistValue(c.pressao_abastecimento),
        "Gabinete ou caixa": normalizeChecklistValue(c.gabinete_caixa),
        "Integridade geral do hidrante": normalizeChecklistValue(c.hidrante_integridade),
        "Acesso à documentação / inspeção": normalizeChecklistValue(c.documentacao_acesso),
        Observações: c.observacoes ?? "",
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 30 }, { wch: 26 },
    { wch: 26 }, { wch: 28 }, { wch: 24 }, { wch: 32 }, { wch: 36 }, { wch: 40 },
  ];
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

  const ws = XLSX.utils.json_to_sheet(out);
  ws["!cols"] = [
    { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 40 }, { wch: 38 }, { wch: 38 }, { wch: 22 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Luz e placa");
  XLSX.writeFile(wb, `inspecoes_luz_placa_${today()}.xlsx`);
}

/** Export 3: Filtered alert list (vencimentos) */
export function exportAlertasVencimento(
  extintores: ExtintorRow[],
  label: string,
): void {
  const rows = extintores.map((e) => ({
    "Código": e.codigo,
    "Pavimento": e.setor,
    "Local Detalhado": e.local_detalhado,
    "Nº INMETRO": e.num_inmetro,
    "Tipo": e.tipo,
    "Tamanho": e.tamanho,
    "Pavimento na planta": e.pavimento ?? "",
    "Vencto. Manutenção Nível 2": formatDate(e.manutencao_2_nivel),
    "Vencto. Manutenção Nível 3": formatDate(e.manutencao_3_nivel),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 28 }, { wch: 28 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
  XLSX.writeFile(wb, `alertas_${label.replace(/\s+/g, "_")}_${today()}.xlsx`);
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
