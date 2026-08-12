PRD: Sistema de Gestão e Inspeção de Extintores via Planta Baixa (PWA)
1. Visão Geral
O objetivo é criar um Progressive Web App (PWA) para gerenciar a inspeção de extintores no Aeroporto Internacional Santa Genoveva. O app permitirá o cadastro em massa de equipamentos, o mapeamento visual sobre a planta baixa técnica e a realização de checklists periódicos com exportação de dados.

2. Personas
Administrador: Importa planilhas de dados, faz o upload das plantas e posiciona os extintores no mapa.

Conferente (Bombeiro): Visualiza os pontos na planta, abre o modal de inspeção e preenche o checklist em campo (mesmo offline).

3. Requisitos Funcionais (RF)
RF01: Importação de Dados
O sistema deve permitir o upload de arquivos .xlsx ou .csv.

Campos obrigatórios: Código, Setor, Local Detalhado, Número Inmetro, Tipo (Água, PQS, CO2), Tamanho, Capacidade Extintora, Vencimento Manutenção 2º Nível, Vencimento Manutenção 3º Nível.

RF02: Mapeamento em Planta Baixa
Interface utilizando Leaflet.js com CRS.Simple para exibir imagens estáticas (plantas do aeroporto) como mapas navegáveis.

Funcionalidade de "Arrastar e Soltar" ou "Clique para Posicionar" para definir as coordenadas x e y de cada extintor cadastrado.

Filtro por pavimento (Térreo, 1º Pavimento, Galerias, etc.).

RF03: Fluxo de Checklist (Operacional)
Ao clicar em um marcador na planta, abrir um Modal.

Cabeçalho do Modal: Dados técnicos do extintor (Somente Leitura).

Formulário de Checklist: * Status do Lacre (Ok/Não Ok).

Status do Manômetro (Ok/Não Ok).

Obstrução de Acesso (Sim/Não).

Sinalização (Ok/Não Ok).

Campo de observações e fotos (opcional).

RF04: Exportação e Relatórios
Gerar arquivo Excel padronizado contendo o histórico de inspeções cruzado com os dados técnicos do extintor.

4. Requisitos Não Funcionais (RNF)
PWA: Deve ser instalável no celular e funcionar offline via Service Workers.

Sincronização: Dados coletados offline devem ser enviados ao Supabase assim que a conexão retornar.

Interface: Design limpo, moderno (Paleta sugerida: Cinza Chumbo, Amarelo Mostarda e Branco) para alta legibilidade em ambiente operacional.

5. Modelo de Dados (Supabase)
SQL
Table extinguidores {
  id uuid [primary key]
  codigo text
  setor text
  local_detalhado text
  num_inmetro text
  num_cilindro text
  tipo text
  tamanho text
  capacidade_extintora text
  manutencao_2_nivel date
  manutencao_3_nivel date
  coord_x float
  coord_y float
  pavimento text
}

Table checklists {
  id uuid [primary key]
  extinguidor_id uuid [ref: > extinguidores.id]
  data_conferencia timestamp
  conferente text
  status_lacre boolean
  status_manometro boolean
  observacoes text
}

6. Stack Tecnológica
Framework: Next.js 14 (App Router).

Estilização: Tailwind CSS.

Banco de Dados/Auth: Supabase.

Mapas: Leaflet.js (react-leaflet).

Excel: biblioteca xlsx.

PWA: next-pwa.