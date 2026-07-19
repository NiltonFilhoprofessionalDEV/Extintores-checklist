---
name: firecheck-dev
description: >-
  Guia de desenvolvimento do FireCheck (gestão/inspeção de extintores e hidrantes).
  Use ao criar ou alterar features, APIs, checklists, mapeamento, importação,
  auth/roles, multi-base, migrations Supabase ou UI admin/mobile neste repositório.
---

# FireCheck — Skill de desenvolvimento

Sistema PWA de inspeção de extintores/hidrantes sobre planta baixa (Leaflet), com
painel admin e app mobile. Stack: **Next.js 16 (App Router)**, React 19, Tailwind 4,
Supabase, Leaflet/`react-leaflet`, `xlsx`.

## Antes de codar

1. Leia `AGENTS.md`: este Next.js **não** é o da sua memória de treino. Consulte
   `node_modules/next/dist/docs/` antes de APIs novas.
2. Preferir padrões já usados em `lib/`, `app/` e `src/components/`.
3. Não inventar schema: conferir `docs/supabase_schema.sql` e migrations em `docs/`.
4. Responder ao usuário em **português (Brasil)**; termos técnicos em English.

## Mapa do código

| Área | Onde |
|------|------|
| Rotas admin | `app/admin/**` |
| Rotas mobile (bombeiro) | `app/mobile/**` |
| APIs | `app/api/**` |
| Auth / roles / bases | `lib/auth/**` |
| Checklist (extintor/hidrante) | `lib/checklist/**`, `src/components/ChecklistForm.tsx`, `HidranteChecklistForm.tsx` |
| Importação planilha | `lib/rf01/**`, `lib/import/**`, `app/admin/importacao` |
| Mapa / marcadores | `src/components/MapView*.tsx`, `lib/map/**`, `app/admin/mapeamento` |
| Export Excel | `lib/export/**`, `lib/supabase/checklists-export.ts` |
| Tipos Supabase | `lib/supabase/types.ts` |
| Docs / SQL | `docs/**`, `README.md` |

Aliases: `@/` → raiz do projeto (`tsconfig`).

## Domínio e papéis

Roles em `lib/auth/roles.ts`:

- `admin_corporativo` — controla a app: bases, admins, outros corporativos
- `admin` — gestão completa de **uma** base
- `leadership` — liderança de equipe (ALFA/BRAVO/CHARLIE/DELTA)
- `user` — bombeiro / conferente (fluxo mobile `/mobile/conferencia`)
- `cliente` / `corporativo` — leitura (dashboard, inventário, mapa)

Regras importantes:

- Multi-base: `admin_corporativo` e `corporativo` usam `base_memberships`; `profiles.base_id` pode ser null.
- Admin de base **não** cria perfis corporativos nem bases.
- Cliente/corporativo: só paths em `CLIENT_ALLOWED_ADMIN_PATHS`.
- Edição de mapa: `canUseMapEditing` (admin / admin_corporativo).
- Inspeção no mapa: `canUseMapInspection`.

Home por role: `getHomePathForRole`.

## Checklist

- Valores: `"conforme" | "nao_conforme" | "nao_aplica"`.
- Extintor: chaves em `CHECKLIST_ITEM_KEYS` (`lib/checklist/types.ts`).
- Hidrante: `lib/checklist/hidrante-types.ts`.
- Perguntas padrão + custom por base: `default-questions.ts`, API
  `app/api/admin/checklist-questions`, migration `docs/migration_base_checklist_questions.sql`.
- Não conformidade exige detalhe (`detalhesNaoConformidade`).
- Campos extras vão em `extraAnswers` / JSON (ver `migration_checklist_answers_json.sql`).

Ao mudar itens do checklist:

1. Atualizar types + labels padrão.
2. Garantir compatibilidade com respostas antigas / export.
3. Se precisar de coluna ou JSON novo, adicionar SQL em `docs/` e documentar no README.

## Multi-base e dados

- Escopo sempre pela **base ativa** (contexto em `lib/auth/active-base-context.tsx`).
- APIs admin devem validar sessão + role + isolamento por `base_id`.
- Enums novos no Postgres: migration em **dois passos** (criar enum → commit → usar),
  como em `migration_multi_base_enum.sql` + `migration_multi_base.sql`.

## Importação e mapa

- Planilhas: `.xlsx` / `.csv`; parsers em `lib/rf01/`. Validar colunas obrigatórias
  antes de gravar.
- Mapas: Leaflet + `CRS.Simple` (imagem estática, não geo real).
- Storage de plantas: bucket `mapas` (`migration_mapas_storage.sql`).
- Scripts de otimização de mapa: `npm run maps:optimize`, `maps:extract-pdf`, `maps:crop`.

## Auth e segurança

- Cliente browser: `lib/supabase/client.ts` (anon key).
- Operações privilegiadas (criar usuários, etc.): `lib/supabase/server-admin.ts` +
  `SUPABASE_SERVICE_ROLE_KEY` — **somente server**.
- Nunca hardcodar secrets; usar `.env.local` (não commitar).
- Validar inputs nas rotas `app/api/**`.
- Respeitar RLS e helpers de autorização existentes; não bypassar no client.

## UI / PWA

- Admin: layout + sidebar em `app/admin/layout.tsx`, `AdminSidebar`.
- Mobile: `app/mobile/layout.tsx`; priorizar toque, legibilidade em campo.
- PWA via `next-pwa` em `next.config.ts` (desabilitado em development).
- Preferir componentes existentes; evitar cards/overlays genéricos sem necessidade.
- Design operacional: contraste alto; seguir tokens/cores já usados no app.

## Checklist do agent ao implementar

1. Identificar role(s) afetados e guards (`AuthGuard`, `AdminAreaGuard`, helpers em `roles.ts`).
2. Reusar types e parsers; não duplicar labels/keys de checklist.
3. Se schema mudar → SQL versionado em `docs/` + nota no README.
4. Rodar `npm run lint` (e `build` se a mudança for estrutural).
5. Não alterar `.env*`; não commitar artefatos de `public/sw.js` gerados localmente
   salvo se o projeto já versionar isso de propósito.

## Quando NÃO usar esta skill

Tarefas genéricas sem relação com FireCheck (ex.: só config de editor Cursor).
Para criar **outra** skill do projeto, use a skill built-in `/create-skill`.
