# Design de Repaginação Estética com shadcn/ui

**Data:** 2026-04-30  
**Projeto:** Extintor Conferência  
**Objetivo:** Modernizar a estética de todas as telas sem alterar regras de negócio, contratos de dados ou fluxos operacionais.

## 1) Contexto e objetivo

O aplicativo já está funcional e possui fluxos consolidados para administração e conferência em campo.  
A necessidade atual é uma repaginação visual completa, mantendo a lógica existente e reduzindo risco de regressão.

Diretriz aprovada: **Abordagem 1 (`shadcn-first` incremental)** com estilo **híbrido (clean + destaques fortes em ações e estados críticos)**.

## 2) Escopo funcional da repaginação

### Incluído

- Atualização visual de **todas as telas** (`admin`, `mobile`, `login` e layouts compartilhados).
- Migração de elementos visuais para componentes `shadcn/ui`.
- Padronização de tema, espaçamento, tipografia e estados de interface.
- Melhoria de UX visual em desktop (admin) e mobile (conferente).

### Não incluído

- Mudanças de regra de negócio.
- Mudanças de schema/database.
- Mudanças de autenticação/autorização.
- Refatorações profundas de lógica offline/sincronização.
- Alteração de endpoints, contratos ou payloads.

## 3) Arquitetura de UI aprovada

### Princípios

- **Segurança de entrega:** trocar apenas camada visual.
- **Consistência sistêmica:** um único design language para todo o app.
- **Incremental e reversível:** entrega por tela, com baixo impacto.
- **Acessibilidade operacional:** legibilidade e contraste para ambiente de uso real.

### Estrutura de layout

- **Admin (desktop-first):**
  - Base com `SidebarProvider`, `Sidebar`, `SidebarInset`, `Breadcrumb`, `Header`.
- **Mobile (conferente-first):**
  - Telas com maior área útil de conteúdo, ações primárias visíveis e `Sheet` para fluxos de inspeção.
- **Componentes comuns reutilizáveis:**
  - `PageHeader`, `StatCard`, `StatusBadge`, `DataTableCard`, `EmptyState`, `LoadingState`.

## 4) Sistema visual (estilo híbrido C)

### Linguagem visual

- Base clean e neutra para leitura contínua.
- Destaques fortes apenas para ações primárias e estados críticos.
- Uso semântico de cor para reduzir ambiguidade de status.

### Cores por semântica

- `primary`: ações principais/navegação ativa.
- `success`: conforme/concluído.
- `warning`: pendência/atenção.
- `destructive`: vencido/não conforme/erro crítico.
- `muted`: metadados e informação secundária.

### Componentes shadcn prioritários

- Estrutura e navegação: `sidebar`, `breadcrumb`, `separator`, `tabs`.
- Conteúdo: `card`, `table`, `badge`.
- Formulários: `input`, `textarea`, `select`, `checkbox`, `label`, `button`.
- Interações: `dialog`, `sheet`, `dropdown-menu`, `tooltip`.
- Estados: `alert`, `skeleton`, `spinner` (ou equivalente visual consistente).

## 5) Mapeamento tela → repaginação

### Admin

- `admin/dashboard`:
  - KPIs em `Card`, tabelas em `Table`, alertas com `Badge/Alert`.
- `admin/extintores`:
  - Busca/filtro em topo com `Input/Select`, tabela principal com ações contextualizadas.
- `admin/conferencias`:
  - Histórico com filtros e detalhe em `Dialog`.
- `admin/importacao`:
  - Upload e feedback de validação em cards/alerts.
- `admin/mapeamento`:
  - Mantém Leaflet; moderniza shell visual (toolbar, filtros, legendas, CTAs).
- `admin/exportacao`:
  - Cartões de exportação com ações claras.
- `admin/usuarios`:
  - Tabela + fluxo de criação/edição em `Dialog/Sheet`.

### Mobile

- `mobile/conferencia`:
  - Busca + `Tabs` de status, lista em cards e checklist em `Sheet`.
- `mobile/mapa`:
  - Mantém mapa e repagina painéis, filtros e legendas.
- `mobile/perfil`:
  - Cartões de usuário/sincronização e ações de sessão.

### Compartilhadas

- `login`:
  - Base de layout inspirada em blocos shadcn de autenticação, adaptada à identidade do app.
- Layout global:
  - Padronização de header/sidebar, espaçamentos e estados de feedback.

## 6) Ordem de execução aprovada

1. Fundação visual (tokens + componentes base reutilizáveis).
2. `admin/dashboard`.
3. `mobile/conferencia`.
4. Demais telas admin.
5. Demais telas mobile.
6. `login` e polish final.

## 7) Estratégia de validação e aceite (Seção 4)

### Objetivo de validação

Garantir que a repaginação melhora UX visual sem quebrar comportamento existente.

### Critérios de aceite por tela

- Layout consistente com o design system definido.
- Hierarquia visual clara (título, contexto, ação principal, conteúdo).
- Estados `loading`, `empty`, `error`, `success` presentes e coerentes.
- Responsividade adequada no breakpoint alvo da tela.
- Nenhuma regressão de fluxo funcional já existente.

### Checklist de QA visual/técnico

- Desktop:
  - Navegação lateral, header, tabelas, filtros e ações.
- Mobile:
  - Tamanhos de toque, legibilidade, `Sheet/Dialog`, feedback de ação.
- Acessibilidade básica:
  - Contraste aceitável, foco visível, textos e labels claros.
- Consistência:
  - Mesma semântica de status em todo o app.

### Testes de regressão funcional (smoke)

- Login/logout.
- Navegação entre telas admin e mobile.
- Fluxo de checklist no mobile (incluindo cenário offline já existente).
- Fluxo de importação e exportação.
- Tela de mapeamento com interação de planta sem alteração de comportamento.

## 8) Riscos e mitigação

- **Risco:** quebra visual durante migração parcial.  
  **Mitigação:** padronização por componentes base antes de atacar todas as telas.

- **Risco:** inconsistência de estilos entre rotas.  
  **Mitigação:** tokens de tema centralizados e revisão por checklist visual.

- **Risco:** regressão de interação em mobile.  
  **Mitigação:** validação antecipada em `mobile/conferencia` como segunda entrega.

## 9) Decisões finais aprovadas

- Escopo: repaginação estética de todas as telas.
- Estratégia: `shadcn-first` incremental.
- Direção visual: híbrido (clean + destaque para criticidade).
- Preservação de regra de negócio: obrigatória.
