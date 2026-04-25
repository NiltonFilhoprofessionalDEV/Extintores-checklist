export type ChecklistValue = "conforme" | "nao_conforme" | "nao_aplica";

export type ChecklistData = {
  conferente: string;
  local_correto: ChecklistValue | null;
  dados_corretos: ChecklistValue | null;
  sinalizacao_correta: ChecklistValue | null;
  mangueira_status: ChecklistValue | null;
  bico_difusor_status: ChecklistValue | null;
  alca_gatilho_status: ChecklistValue | null;
  medidor_pressao_status: ChecklistValue | null;
  cilindro_status: ChecklistValue | null;
  observacoes: string;
};

export const CHECKLIST_INITIAL: ChecklistData = {
  conferente: "",
  local_correto: null,
  dados_corretos: null,
  sinalizacao_correta: null,
  mangueira_status: null,
  bico_difusor_status: null,
  alca_gatilho_status: null,
  medidor_pressao_status: null,
  cilindro_status: null,
  observacoes: "",
};

/** Returns true if all required fields are answered */
export function isChecklistValid(d: ChecklistData): boolean {
  return (
    d.conferente.trim().length > 0 &&
    d.local_correto !== null &&
    d.dados_corretos !== null &&
    d.sinalizacao_correta !== null &&
    d.mangueira_status !== null &&
    d.bico_difusor_status !== null &&
    d.alca_gatilho_status !== null &&
    d.medidor_pressao_status !== null &&
    d.cilindro_status !== null
  );
}
