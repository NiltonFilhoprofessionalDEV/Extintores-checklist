# Sistema de Gestão e Inspeção de Extintores

Estrutura inicial do projeto com:

- Next.js (App Router)
- Tailwind CSS
- Supabase (`@supabase/supabase-js`)
- Importação de planilhas (`xlsx`)
- Base de PWA (`next-pwa`)
- Base para mapas (`leaflet`, `react-leaflet`)

## Configuração

1. Copie `.env.example` para `.env.local`.
2. Preencha as variáveis do Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (necessária para criação de usuários no painel admin)
3. Instale dependências:

```bash
npm install
```

4. Crie as tabelas no Supabase usando o script:
   - `docs/supabase_schema.sql`
   - Cole o conteúdo no SQL Editor do Supabase e execute.

## Execução local

```bash
npm run dev
```

Aplicação em [http://localhost:3000](http://localhost:3000).

## Fluxo de acesso

- `admin`: acesso ao painel administrativo (`/admin/dashboard`)
- `user`: acesso operacional mobile (`/mobile/conferencia`)
- Login em `/login`

## Módulos principais

- Importação de dados em `app/importacao/page.tsx`:
  - Upload de `.xlsx` e `.csv`
  - Validação de colunas obrigatórias
  - Pré-visualização dos dados carregados
  - Importação para a tabela `extintores` no Supabase

- Mapeamento em planta em `app/mapeamento/page.tsx` (Leaflet + CRS.Simple)
- Gestão de usuários admin em `app/admin/usuarios/page.tsx`
- Conferência mobile em `app/mobile/conferencia/page.tsx`
