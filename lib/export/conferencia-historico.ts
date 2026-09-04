import { hidranteChecklistTemNaoConformidade, type HidranteItemKey } from "@/lib/checklist/hidrante-types";
import {
  extrairComentariosLivresConferente,
  formatarObservacaoConferenciaExtintor,
  formatarObservacaoConferenciaHidrante,
} from "@/lib/checklist/observacao-conferencia";
import { fillChecklistItemsFromObservacoes } from "@/lib/checklist/parse-legacy-observacoes";
import {
  CHECKLIST_ITEM_KEYS,
  checklistTemNaoConformidade,
  isDataVencida,
} from "@/lib/checklist/types";
import { hidranteTemMangueiraVencida, type HidranteVencimentoRow } from "@/lib/hidrantes/vencimento-mangueiras";

export type ConferenciaExportStatus = "conforme" | "alerta" | "vencido" | "pendente";

export type ConferenciaExportResult = {
  status: ConferenciaExportStatus;
  observacao: string;
};

type ExtintorChecklistCampos = {
  local_correto: string | null;
  dados_corretos: string | null;
  sinalizacao_correta: string | null;
  mangueira_status: string | null;
  bico_difusor_status: string | null;
  alca_gatilho_status: string | null;
  medidor_pressao_status: string | null;
  cilindro_status: string | null;
  observacoes: string | null;
};

function normalizeChecklistExtintor(raw: Record<string, unknown>): ExtintorChecklistCampos {
  const base = {
    local_correto: (raw.local_correto as string | null) ?? null,
    dados_corretos: (raw.dados_corretos as string | null) ?? null,
    sinalizacao_correta: (raw.sinalizacao_correta as string | null) ?? null,
    mangueira_status: (raw.mangueira_status as string | null) ?? null,
    bico_difusor_status: (raw.bico_difusor_status as string | null) ?? null,
    alca_gatilho_status: (raw.alca_gatilho_status as string | null) ?? null,
    medidor_pressao_status: (raw.medidor_pressao_status as string | null) ?? null,
    cilindro_status: (raw.cilindro_status as string | null) ?? null,
    observacoes: (raw.observacoes as string | null) ?? null,
  };
  const filled = fillChecklistItemsFromObservacoes(base, base.observacoes);
  return { ...base, ...filled };
}

function textoObservacaoFinal(textoNc: string, prefixoVencimento?: string): string {
  const partes = [prefixoVencimento, textoNc].filter(Boolean);
  if (partes.length === 0) return "Conforme";
  return partes.join("\n\n");
}

export function extintorTemManutencaoVencida(
  manutencao2Nivel: string | null,
  manutencao3Nivel: string | null,
): boolean {
  return isDataVencida(manutencao2Nivel) || isDataVencida(manutencao3Nivel);
}

function mensagemManutencaoVencidaExtintor(
  manutencao2Nivel: string | null,
  manutencao3Nivel: string | null,
): string {
  const n2 = isDataVencida(manutencao2Nivel);
  const n3 = isDataVencida(manutencao3Nivel);
  if (n2 && n3) return "Manutenções de 2º e 3º nível vencidas";
  if (n2) return "Manutenção de 2º nível vencida";
  if (n3) return "Manutenção de 3º nível vencida";
  return "Manutenção vencida";
}

export function resolveExtintorConferenciaExport(
  raw: Record<string, unknown>,
  manutencao2Nivel: string | null,
  manutencao3Nivel: string | null = null,
): ConferenciaExportResult {
  const row = normalizeChecklistExtintor(raw);
  const vencido = extintorTemManutencaoVencida(manutencao2Nivel, manutencao3Nivel);
  const temNc = checklistTemNaoConformidade(row);
  const textoObs = formatarObservacaoConferenciaExtintor(row, row.observacoes);
  const temConteudo = textoObs.trim().length > 0;
  const comentariosLivres = extrairComentariosLivresConferente(row.observacoes);

  if (vencido) {
    return {
      status: "vencido",
      observacao: textoObservacaoFinal(
        textoObs,
        mensagemManutencaoVencidaExtintor(manutencao2Nivel, manutencao3Nivel),
      ),
    };
  }

  if (temNc || comentariosLivres.length > 0 || temConteudo) {
    return {
      status: "alerta",
      observacao: temConteudo ? textoObs : "Não conformidade registrada",
    };
  }

  return { status: "conforme", observacao: "Conforme" };
}

export function resolveHidranteConferenciaExport(
  raw: Record<string, unknown>,
  hidrante: HidranteVencimentoRow | null,
): ConferenciaExportResult {
  const row = raw as Partial<Record<HidranteItemKey, string | null>>;
  const vencido = hidrante ? hidranteTemMangueiraVencida(hidrante) : false;
  const temNc = hidranteChecklistTemNaoConformidade(row as Record<string, string | null>);
  const observacoes = (raw.observacoes as string | null) ?? null;
  const textoObs = formatarObservacaoConferenciaHidrante(row, observacoes);
  const temConteudo = textoObs.trim().length > 0;
  const comentariosLivres = extrairComentariosLivresConferente(observacoes);

  if (vencido) {
    return {
      status: "vencido",
      observacao: textoObservacaoFinal(textoObs, "Teste hidrostático de mangueira vencido"),
    };
  }

  if (temNc || comentariosLivres.length > 0 || temConteudo) {
    return {
      status: "alerta",
      observacao: temConteudo ? textoObs : "Não conformidade registrada na inspeção",
    };
  }

  return { status: "conforme", observacao: "Conforme" };
}

/** Cor de fundo da linha no Excel (sem #). */
export function corLinhaConferenciaExport(status: ConferenciaExportStatus, rowIndex: number): string {
  if (status === "vencido") return "FFFFCDD2";
  if (status === "alerta") return rowIndex % 2 === 0 ? "FFFFF3CD" : "FFFFEDD5";
  if (status === "pendente") return rowIndex % 2 === 0 ? "FFE2E8F0" : "FFF8FAFC";
  return rowIndex % 2 === 0 ? "FFE2F0D9" : "FFFFFFFF";
}
