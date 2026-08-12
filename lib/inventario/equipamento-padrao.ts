export type TipoEquipamento = "extintor" | "hidrante";

export const TIPO_EQUIPAMENTO_LABEL: Record<TipoEquipamento, string> = {
  extintor: "Extintor",
  hidrante: "Hidrante",
};

/**
 * Nomenclatura oficial das colunas de extintor (UI, importação, planilha-modelo e exports).
 */
export const COLUNAS_EXTINTOR = {
  codigo: "Código de controle do extintor",
  pavimento: "Pavimento",
  localDetalhado: "Local detalhado",
  numInmetro: "Nº do INMETRO",
  numCilindro: "Nº do Cilindro",
  tipo: "Tipo de agente extintor",
  /** Antes: Tamanho */
  tamanho: "Carga nominal",
  capacidadeExtintora: "Capacidade Extintora (Ex: 2-A 20-B:C)",
  manutencao2: "Próx. Manutenção 2º Nível (Recarga)",
  manutencao3: "Próx. Manutenção 3º Nível (Teste hidrostático)",
} as const;

/** Ordem oficial dos cabeçalhos da planilha de importação de extintores. */
export const EXTINTOR_IMPORT_HEADERS = [
  COLUNAS_EXTINTOR.codigo,
  COLUNAS_EXTINTOR.pavimento,
  COLUNAS_EXTINTOR.localDetalhado,
  COLUNAS_EXTINTOR.numInmetro,
  COLUNAS_EXTINTOR.numCilindro,
  COLUNAS_EXTINTOR.tipo,
  COLUNAS_EXTINTOR.tamanho,
  COLUNAS_EXTINTOR.capacidadeExtintora,
  COLUNAS_EXTINTOR.manutencao2,
  COLUNAS_EXTINTOR.manutencao3,
] as const;

/** Cabeçalhos padronizados (UI, tabelas e Excel). */
export const COLUNAS_PADRAO = {
  equipe: "Equipe",
  codigo: COLUNAS_EXTINTOR.codigo,
  codigoCurto: "Código",
  setor: "Setor",
  pavimento: COLUNAS_EXTINTOR.pavimento,
  localDetalhado: COLUNAS_EXTINTOR.localDetalhado,
  tipo: COLUNAS_EXTINTOR.tipo,
  tamanho: COLUNAS_EXTINTOR.tamanho,
  dataConferencia: "Data da conferência",
  conferente: "Conferente",
  observacao: "Observação",
  numInmetro: COLUNAS_EXTINTOR.numInmetro,
  numCilindro: COLUNAS_EXTINTOR.numCilindro,
  capacidadeExtintora: COLUNAS_EXTINTOR.capacidadeExtintora,
  venctoN2: COLUNAS_EXTINTOR.manutencao2,
  venctoN3: COLUNAS_EXTINTOR.manutencao3,
  mapa: "Mapa",
  mangueiras: "Mangueiras",
  acoes: "Ações",
} as const;

/** Classe CSS compartilhada para títulos de coluna (laranja + negrito). */
export const COLUNA_TITULO_CLASS =
  "px-4 py-3 text-left text-xs font-bold tracking-normal text-[var(--orange)]";

export const COLUNA_TITULO_CLASS_COMPACT =
  "px-2 py-2 text-left text-xs font-bold tracking-normal text-[var(--orange)]";

export function tituloEquipamento(codigo: string, tipo: TipoEquipamento): string {
  const label = TIPO_EQUIPAMENTO_LABEL[tipo];
  return codigo ? `${codigo} — ${label}` : label;
}

export function subtituloLocalExtintor(setor: string, local: string): string {
  const s = setor?.trim() || "—";
  const l = local?.trim() || "Local não informado";
  return `${COLUNAS_EXTINTOR.pavimento}: ${s} · ${COLUNAS_EXTINTOR.localDetalhado}: ${l}`;
}

export function subtituloLocalHidrante(pavimento: string | null, local: string): string {
  const p = pavimento?.trim() || "—";
  const l = local?.trim() || "Local não informado";
  return `${COLUNAS_PADRAO.pavimento}: ${p} · ${COLUNAS_PADRAO.localDetalhado}: ${l}`;
}
