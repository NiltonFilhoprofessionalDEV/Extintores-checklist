import { hidranteChecklistTemNaoConformidade } from "@/lib/checklist/hidrante-types";
import { checklistTemNaoConformidade, isDataVencida } from "@/lib/checklist/types";
import { hidranteTemMangueiraVencida, type HidranteVencimentoRow } from "@/lib/hidrantes/vencimento-mangueiras";

export const MARKER_GREEN = "#16a34a";
export const MARKER_RED = "#dc2626";
export const MARKER_AMBER = "#eab308";

export type MarkerColors = {
  bg: string;
  ring: string;
};

type ExtintorMarkerInput = {
  id: string;
  manutencao_2_nivel: string | null;
};

type ChecklistExtResumo = {
  local_correto?: string | null;
  dados_corretos?: string | null;
  sinalizacao_correta?: string | null;
  mangueira_status?: string | null;
  bico_difusor_status?: string | null;
  alca_gatilho_status?: string | null;
  medidor_pressao_status?: string | null;
  cilindro_status?: string | null;
};

export function extintorMarkerColors(
  item: ExtintorMarkerInput,
  conferidoNoMes: boolean,
  ultimoChecklist: ChecklistExtResumo | undefined,
): MarkerColors {
  const vencido = isDataVencida(item.manutencao_2_nivel);
  const temNc = ultimoChecklist
    ? checklistTemNaoConformidade({
        local_correto: ultimoChecklist.local_correto ?? null,
        dados_corretos: ultimoChecklist.dados_corretos ?? null,
        sinalizacao_correta: ultimoChecklist.sinalizacao_correta ?? null,
        mangueira_status: ultimoChecklist.mangueira_status ?? null,
        bico_difusor_status: ultimoChecklist.bico_difusor_status ?? null,
        alca_gatilho_status: ultimoChecklist.alca_gatilho_status ?? null,
        medidor_pressao_status: ultimoChecklist.medidor_pressao_status ?? null,
        cilindro_status: ultimoChecklist.cilindro_status ?? null,
      })
    : false;

  // Cor do badge = status (atenção sempre vermelho; conforme só se conferido e sem alerta).
  if (vencido || temNc) {
    return { bg: MARKER_RED, ring: conferidoNoMes ? MARKER_GREEN : MARKER_RED };
  }
  if (conferidoNoMes) {
    return { bg: MARKER_GREEN, ring: MARKER_GREEN };
  }
  return { bg: MARKER_AMBER, ring: MARKER_AMBER };
}

export function hidranteMarkerColors(
  h: HidranteVencimentoRow,
  conferidoNoMes: boolean,
  ultimoChecklist: Record<string, string | null> | undefined,
): MarkerColors {
  const temNc = ultimoChecklist ? hidranteChecklistTemNaoConformidade(ultimoChecklist) : false;
  const mangueiraVencida = hidranteTemMangueiraVencida(h);

  if (conferidoNoMes) {
    const alerta = temNc || mangueiraVencida;
    return { bg: alerta ? MARKER_RED : MARKER_GREEN, ring: MARKER_GREEN };
  }

  if (temNc || mangueiraVencida) {
    return { bg: MARKER_RED, ring: MARKER_RED };
  }

  return { bg: MARKER_AMBER, ring: MARKER_AMBER };
}
