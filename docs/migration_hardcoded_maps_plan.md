# Plano de migração — mapas hardcoded → Storage

## Objetivo

Eliminar gradualmente `public/maps/*` e `FALLBACK_PAVIMENTOS` no frontend, unificando
tudo em `base_floors` + bucket `mapas` no Supabase Storage.

## Mapas hardcoded atuais (`public/maps/`)

| Arquivo base | Key fallback | Label |
|--------------|--------------|-------|
| `/maps/terreo` | terreo | Térreo |
| `/maps/pavimento 1` | pavimento_1 | Pavimento 1 |
| `/maps/galeria_tecniica` | galeria_tecnica | Galeria Técnica |
| `/maps/pavimento_tecnico` | pavimento_tecnico | Pavimento Técnico |
| `/maps/subsolo` | subsolo | Subsolo |
| `/maps/teca` | teca | TECA |
| `/maps/tps_1` | tps_1 | TPS 1 |
| `/maps/sci` | sci | SCI |
| `/maps/other_places` | other_places | Guaritas/Central de resíduos |

## Passos (por base)

1. Confirmar registros em `base_floors` para Santa Genoveva (seed em `migration_multi_base.sql`).
2. Para cada floor sem `image_path` no Storage:
   - Upload do JPG/WebP de `public/maps/` → `mapas/{base_id}/{key}.webp`
   - Upload preview → `mapas/{base_id}/{key}_preview.webp`
   - Atualizar `image_path`, `image_path_preview`, `image_width`, `image_height`
3. Rodar `docs/migration_map_unified.sql` (backfill `floor_id` + `coord_*_norm`).
4. Validar visualmente cada mapa no app (cenários 1–3 do checklist de testes).
5. Remover entrada correspondente de `FALLBACK_PAVIMENTOS` **somente** após validação.
6. Quando todos os floors da base estão no Storage, remover arquivos estáticos órfãos.

## Compatibilidade temporária

- Sem `activeBaseId`: `FALLBACK_PAVIMENTOS` continua disponível (bases legadas).
- Com `activeBaseId`: apenas `fetchBaseFloors` — sem fallback automático.
- Coordenadas legadas em pixels continuam válidas até backfill das norm.

## Script futuro

`scripts/migrate-hardcoded-maps.mjs` — upload + update `base_floors` via service role
(executar manualmente com credenciais locais, não no CI).
