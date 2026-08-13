-- Fase 4: preparação Storage para plantas legadas (JPG > 10 MB)
-- Execute no SQL Editor do Supabase ANTES de scripts/migrate-legacy-maps.mjs --execute
-- Idempotente.

-- Aumentar limite do bucket (terreo.jpg ~19 MB, pavimento 1 ~21 MB)
update storage.buckets
set file_size_limit = 26214400 -- 25 MB
where id = 'mapas';

-- Rastreio de migração legada (opcional mas recomendado)
alter table public.base_floors
  add column if not exists legacy_migrated_at timestamptz;

comment on column public.base_floors.legacy_migrated_at is
  'Timestamp da migração automática public/maps → Storage (Fase 4). Null = pendente ou migrado manualmente antes.';
