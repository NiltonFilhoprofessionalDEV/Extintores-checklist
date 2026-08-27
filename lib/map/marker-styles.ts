import { hidranteChecklistTemNaoConformidade } from "@/lib/checklist/hidrante-types";
import { checklistTemNaoConformidade, isDataVencida } from "@/lib/checklist/types";
import { hidranteTemMangueiraVencida, type HidranteVencimentoRow } from "@/lib/hidrantes/vencimento-mangueiras";

export const MARKER_GREEN = "#16a34a";
export const MARKER_RED = "#dc2626";
export const MARKER_AMBER = "#eab308";
export const MARKER_GRAY = "#64748b";

export type MarkerColors = {
  bg: string;
  ring: string;
};

type ExtintorMarkerInput = {
  id: string;
  manutencao_2_nivel: string | null;
  sem_equipamento?: boolean | null;
};

type ChecklistExtResumo = {
  data_conferencia?: string;
  local_correto?: string | null;
  dados_corretos?: string | null;
  sinalizacao_correta?: string | null;
  mangueira_status?: string | null;
  bico_difusor_status?: string | null;
  alca_gatilho_status?: string | null;
  medidor_pressao_status?: string | null;
  cilindro_status?: string | null;
  answers_json?: Record<string, string | null> | null;
  observacoes?: string | null;
};

export function extintorMarkerColors(
  item: ExtintorMarkerInput,
  conferidoNoMes: boolean,
  ultimoChecklist: ChecklistExtResumo | undefined,
): MarkerColors {
  if (item.sem_equipamento) {
    return { bg: MARKER_GRAY, ring: MARKER_GRAY };
  }

  const vencido = isDataVencida(item.manutencao_2_nivel);
  const temNc = ultimoChecklist ? checklistTemNaoConformidade(ultimoChecklist) : false;

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
  ultimoChecklist:
    | (Record<string, string | null> & {
        data_conferencia?: string;
        answers_json?: Record<string, string | null> | null;
        observacoes?: string | null;
      })
    | undefined,
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

/** Evita que um refetch incompleto apague NC já conhecida no estado local. */
export function preferChecklistComNaoConformidade<T extends { data_conferencia?: string }>(
  local: T | undefined,
  server: T,
  hasNc: (row: T) => boolean,
): T {
  if (!local) return server;
  if (hasNc(server) || !hasNc(local)) return server;
  const localMs = new Date(local.data_conferencia ?? 0).getTime();
  const serverMs = new Date(server.data_conferencia ?? 0).getTime();
  if (!Number.isFinite(localMs) || localMs + 5000 < serverMs) return server;
  return {
    ...server,
    ...local,
    data_conferencia: server.data_conferencia || local.data_conferencia,
  };
}
