/** Payload confirmado pelo drawer de substituição (estoque ou digitação direta). */
export type SubstituirConfirmPayload =
  | {
      source: "estoque";
      estoque_id: string;
      num_inmetro: string;
      num_cilindro: string | null;
      manutencao_2_nivel: string | null;
      manutencao_3_nivel: string | null;
    }
  | {
      source: "direto";
      tipo: string;
      tamanho: string;
      capacidade_extintora: string;
      num_inmetro: string;
      num_cilindro: string | null;
      manutencao_2_nivel: string | null;
      manutencao_3_nivel: string | null;
    };
