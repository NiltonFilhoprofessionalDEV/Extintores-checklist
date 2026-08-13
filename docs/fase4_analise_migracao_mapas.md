# Fase 4 — Análise: migração mapas legados → Storage

**Status:** análise concluída (sem alteração de dados).  
**Data:** 2026-08-13  
**Próximo passo:** executar `npm run maps:analyze-legacy` (relatório) e depois `npm run maps:migrate-legacy -- --execute`.

---

## 1. Mapas legados em `public/maps/`

| Arquivo JPG | WebP local | Dimensões (px) | Tamanho JPG | Key `base_floors` | Label | `imageBase` legado |
|-------------|------------|----------------|-------------|-------------------|-------|---------------------|
| `terreo.jpg` | `terreo.webp` | 14042 × 9934 | ~18,8 MB | `terreo` | Térreo | `/maps/terreo` |
| `pavimento 1.jpg` | `pavimento 1.webp` | 14042 × 9934 | ~20,5 MB | `pavimento_1` | Pavimento 1 | `/maps/pavimento 1` |
| `galeria_tecniica.jpg` | `galeria_tecniica.webp` | 14042 × 9934 | ~12,5 MB | `galeria_tecnica` | Galeria Técnica | `/maps/galeria_tecniica` |
| `pavimento_tecnico.jpg` | `pavimento_tecnico.webp` | 14042 × 9934 | ~15,8 MB | `pavimento_tecnico` | Pavimento Técnico | `/maps/pavimento_tecnico` |
| `subsolo.jpg` | `subsolo.webp` | 14042 × 9934 | ~13,8 MB | `subsolo` | Subsolo | `/maps/subsolo` |
| `teca.jpg` | `teca.webp` | 14042 × 9934 | ~5,3 MB | `teca` | TECA | `/maps/teca` |
| `tps_1.jpg` | `tps_1.webp` | 14042 × 9934 | ~16,4 MB | `tps_1` | TPS 1 | `/maps/tps_1` |
| `sci.jpg` | `sci.webp` | 14042 × 9934 | ~8,0 MB | `sci` | SCI | `/maps/sci` |
| `other_places.jpg` | `other_places.webp` | 14042 × 9934 | ~6,5 MB | `other_places` | Guaritas/Central de resíduos | `/maps/other_places` |

**Total:** 9 plantas únicas, **~118 MB** em JPG (originais) + **~27 MB** em WebP locais (não enviados ao Storage nesta contagem).

Todas as plantas têm a **mesma resolução** — compatível com o seed `migration_multi_base.sql` (`14042 × 9934`) e com coordenadas em pixels absolutos já usadas no app.

---

## 2. Definição em código (`FALLBACK_PAVIMENTOS` / `LEGACY_FLOOR_MAPS`)

Fonte canônica: `lib/map/legacy-floor-maps.ts` (9 entradas).  
`MapView.tsx` importa como `FALLBACK_PAVIMENTOS` quando `fetchBaseFloors` falha ou base sem `activeBaseId`.

**Não remover nesta fase** — permanece fallback de segurança após migração.

---

## 3. Bases e setores que utilizam cada planta

### Seed conhecido (Santa Genoveva)

`migration_multi_base.sql` insere em `base_floors` para `bases.slug = 'santa-genoveva'` os 9 keys acima com `image_path = '/maps/...'`.

### Bases adicionais

Outras bases podem ter floors com o **mesmo `key`** se replicaram o seed ou cadastraram manualmente. O script de migração identifica **dinamicamente** todos os registros em `base_floors` onde:

- `image_path` começa com `/maps`, **ou**
- `key` está na lista legada e `image_path` ainda não aponta ao Storage.

**Não assumir** que só Santa Genoveva usa os mapas — o script trata cada `base_id` + `key`.

---

## 4. Coordenadas antigas (como estão hoje)

| Campo | Uso |
|-------|-----|
| `coord_x`, `coord_y` | Pixels absolutos no sistema da planta (0…14042, 0…9934) — **preservados** |
| `coord_x_norm`, `coord_y_norm` | 0–1 relativos à planta (Fase 1) — backfill via SQL ou script |
| `floor_id` | FK `base_floors.id` — backfill por label `pavimento` |
| `pavimento` | Texto legado (label do setor) — **não apagar** |

Matching de equipamentos ao setor (app): `lib/map/floor-matching.ts` — `floor_id` estrito; legado por `pavimento`/`setor` normalizado.

### Conversão automática (possível)

Quando `coord_x` e `coord_y` existem e `image_width`/`image_height` > 0:

```
coord_x_norm = coord_x / image_width
coord_y_norm = coord_y / image_height
```

(clamp 0–1 no script; pixels originais **não** alterados.)

`docs/migration_map_unified.sql` já contém o mesmo backfill para extintores/hidrantes/marcadores.

---

## 5. Equipamentos associados

O script analisa e migra:

- `extintores` (`base_id`, `pavimento`, `setor`, `coord_*`, `floor_id`)
- `hidrantes` (idem)
- `marcadores_emergencia` (idem, sem `setor`)

Associação `floor_id`:

1. Se já tem `floor_id` válido → mantém (idempotente).
2. Se `floor_id` nulo → match `pavimento` com `base_floors.label` (case/acento insensível, igual SQL da Fase 1).

**Não inventar posição** se `coord_x`/`coord_y` nulos.

---

## 6. Viabilidade da conversão automática

| Condição | Ação |
|----------|------|
| `coord_x` + `coord_y` válidos, norm null | Calcular `coord_*_norm` |
| `coord_x_norm` + `coord_y_norm` já preenchidos | **Não alterar** (idempotente) |
| Coordenadas fora dos limites da planta | Não corrigir; marcar `needs_position_review` no **floor** |
| Sem coordenadas | Sem posição; não marcar revisão por isso sozinho |
| `coord_x` sem `coord_y` (incompleto) | Marcar floor `needs_position_review` |

---

## 7. O que será migrado (plano de execução)

### Por floor (`base_floors`)

1. Ler JPG original em `public/maps/` (fonte de alta resolução).
2. Upload Storage `mapas/{base_id}/{key}.jpg` — **original sem compressão agressiva**.
3. Upload preview `mapas/{base_id}/{key}_preview.webp` — max 4000px maior lado, quality 82 (igual upload admin).
4. Atualizar `image_path`, `image_path_preview`, `image_width`, `image_height`.
5. Definir `legacy_migrated_at` (nova coluna opcional, ver SQL).
6. **Manter** `image_path` antigo apenas em log/relatório — DB passa a URL Storage.

### Por equipamento

1. `floor_id` se ainda null e `pavimento` casa com floor.
2. `coord_*_norm` se coords em pixels existem e norm null.
3. Não alterar `coord_x`/`coord_y`.

### O que **não** muda

- `public/maps/*` (arquivos locais)
- `LEGACY_FLOOR_MAPS` / fallback no frontend
- Histórico de inspeções, auth, RLS, usuários

---

## 8. Storage e qualidade

| Artefato | Política |
|----------|----------|
| Original | JPG completo do arquivo local (~5–21 MB/planta) |
| Preview | WebP ~4000px maior lado (visualização / mobile) |
| Duplicação | Um original + um preview por floor; sem terceira cópia |

### ⚠️ Ação manual Supabase (obrigatória antes do upload)

`migration_mapas_storage.sql` define `file_size_limit = 10485760` (10 MB).  
Vários JPGs excedem 10 MB → **aumentar limite** (ver `docs/fase4_migration_storage_bucket.sql`, sug.: **25 MB**).

Estimativa Storage após migração (1 base, 9 plantas): **~145 MB** (118 JPG + ~27 preview).  
Bases adicionais com os mesmos keys: +145 MB cada (se todas as 9 plantas).

---

## 9. Identificação pós-migração

| Estado | Como identificar |
|--------|------------------|
| Floor migrado | `legacy_migrated_at IS NOT NULL` **ou** `image_path` contém `/storage/v1/object/public/mapas/` |
| Floor pendente | `image_path` começa com `/maps` |
| Equipamento posicionado | `coord_x`/`coord_y` ou norm preenchidos |
| Sem posição | coords null |
| Precisa revisão | `base_floors.needs_position_review = true` |

---

## 10. Idempotência (requisitos do script)

Reexecutar **não deve**:

- Duplicar floors/setores (update por `base_id` + `key`)
- Re-upload se já migrado (skip se Storage URL + `legacy_migrated_at`, unless `--force`)
- Recalcular `coord_*_norm` já preenchidos
- Alterar `floor_id` já correto

Flag `--force`: re-upload plantas e recalcular norms (uso excepcional).

---

## 11. Validação visual (obrigatória após `--execute`)

1. Mapa migrado abre com planta do Storage.
2. Comparar marcadores com mapa legado (mesma base/setor).
3. Mobile / tablet / desktop — posições iguais.
4. Troca rápida de setores — sem marcadores no mapa errado.
5. Equipamento aberto — `floor_id` correto.
6. Extintores + hidrantes migrados.
7. Coords incompletas → `needs_position_review`, sem posição inventada.
8. Falha parcial → dados legados intactos; reexecutar script.

---

## 12. Arquivos entregues na Fase 4 (implementação)

| Arquivo | Função |
|---------|--------|
| `docs/fase4_analise_migracao_mapas.md` | Este relatório |
| `docs/fase4_migration_storage_bucket.sql` | Aumentar limite do bucket + coluna `legacy_migrated_at` |
| `scripts/lib/legacy-map-catalog.mjs` | Catálogo legado + helpers |
| `scripts/analyze-legacy-maps.mjs` | Análise sem alterar dados |
| `scripts/migrate-legacy-maps.mjs` | Migração idempotente (`--dry-run` / `--execute`) |
| `package.json` | Scripts `maps:analyze-legacy`, `maps:migrate-legacy` |

---

## 13. Ações manuais no Supabase (antes de `--execute`)

1. Executar `docs/fase4_migration_storage_bucket.sql` no SQL Editor.
2. Confirmar `docs/migration_map_unified.sql` já aplicada (`floor_id`, `coord_*_norm`, `needs_position_review`, `image_path_preview`).
3. Confirmar bucket `mapas` público (`migration_mapas_storage.sql`).
4. Exportar backup ou snapshot recomendado antes da primeira execução em produção.
5. Configurar `.env.local` com `SUPABASE_SERVICE_ROLE_KEY` (apenas local/CI seguro; **nunca** no frontend).
