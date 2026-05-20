import type { ChecklistItemKey } from "./types";

/** Cabeçalhos das colunas de inspeção no Excel (alinhados ao formulário de conferência). */
export const CHECKLIST_EXPORT_COLUMN_LABELS: Record<ChecklistItemKey, string> = {
  local_correto: "Localização conforme mapa/normas",
  dados_corretos: "Identificação e rotulagem",
  sinalizacao_correta: "Sinalização",
  mangueira_status: "Mangueira",
  bico_difusor_status: "Bico ou difusor",
  alca_gatilho_status: "Alça, gatilho, lacre e pino",
  medidor_pressao_status: "Manômetro / indicador de pressão",
  cilindro_status: "Cilindro",
};
