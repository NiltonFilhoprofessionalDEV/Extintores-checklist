export type TipoEquipamento = "extintor" | "hidrante";

export const TIPO_EQUIPAMENTO_LABEL: Record<TipoEquipamento, string> = {
  extintor: "Extintor",
  hidrante: "Hidrante",
};

/** Cabeçalhos padronizados (UI, tabelas e Excel). */
export const COLUNAS_PADRAO = {
  equipe: "Equipe",
  codigo: "Código",
  setor: "Setor",
  pavimento: "Pavimento",
  localDetalhado: "Local detalhado",
  tipo: "Tipo",
  tamanho: "Tamanho",
  dataConferencia: "Data da conferência",
  conferente: "Conferente",
  observacao: "Observação",
  numInmetro: "Nº INMETRO",
  numCilindro: "Nº do cilindro",
  venctoN2: "Vencto. manutenção N2",
  mapa: "Mapa",
  mangueiras: "Mangueiras",
  acoes: "Ações",
} as const;

export function tituloEquipamento(codigo: string, tipo: TipoEquipamento): string {
  const label = TIPO_EQUIPAMENTO_LABEL[tipo];
  return codigo ? `${codigo} — ${label}` : label;
}

export function subtituloLocalExtintor(setor: string, local: string): string {
  const s = setor?.trim() || "—";
  const l = local?.trim() || "Local não informado";
  return `${COLUNAS_PADRAO.setor}: ${s} · ${COLUNAS_PADRAO.localDetalhado}: ${l}`;
}

export function subtituloLocalHidrante(pavimento: string | null, local: string): string {
  const p = pavimento?.trim() || "—";
  const l = local?.trim() || "Local não informado";
  return `${COLUNAS_PADRAO.pavimento}: ${p} · ${COLUNAS_PADRAO.localDetalhado}: ${l}`;
}
