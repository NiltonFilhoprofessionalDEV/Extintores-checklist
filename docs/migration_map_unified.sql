-- Mapas unificados: floor_id, coordenadas normalizadas, preview de planta.
-- Execute no SQL Editor do Supabase após migration_multi_base e migration_mapas_storage.
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1) base_floors — preview e revisão de posições
-- ---------------------------------------------------------------------------
alter table public.base_floors
  add column if not exists image_path_preview text,
  add column if not exists needs_position_review boolean not null default false,
  add column if not exists active boolean not null default true;

comment on column public.base_floors.image_path_preview is
  'URL/path da planta otimizada para visualização (WebP ~4000px maior lado)';
comment on column public.base_floors.needs_position_review is
  'True após substituir planta com equipamentos posicionados — revisar marcadores';

-- ---------------------------------------------------------------------------
-- 2) floor_id nos equipamentos / marcadores
-- ---------------------------------------------------------------------------
alter table public.extintores
  add column if not exists floor_id uuid references public.base_floors(id) on delete set null;

alter table public.hidrantes
  add column if not exists floor_id uuid references public.base_floors(id) on delete set null;

alter table public.marcadores_emergencia
  add column if not exists floor_id uuid references public.base_floors(id) on delete set null;

create index if not exists idx_extintores_floor_id on public.extintores (floor_id);
create index if not exists idx_hidrantes_floor_id on public.hidrantes (floor_id);
create index if not exists idx_marcadores_emergencia_floor_id on public.marcadores_emergencia (floor_id);

-- ---------------------------------------------------------------------------
-- 3) Coordenadas normalizadas (0–1 relativas à planta)
-- ---------------------------------------------------------------------------
alter table public.extintores
  add column if not exists coord_x_norm double precision,
  add column if not exists coord_y_norm double precision;

alter table public.hidrantes
  add column if not exists coord_x_norm double precision,
  add column if not exists coord_y_norm double precision;

alter table public.marcadores_emergencia
  add column if not exists coord_x_norm double precision,
  add column if not exists coord_y_norm double precision;

-- ---------------------------------------------------------------------------
-- 4) Backfill coordenadas normalizadas (legado em pixels absolutos)
-- ---------------------------------------------------------------------------
update public.extintores e
set
  coord_x_norm = e.coord_x / bf.image_width::double precision,
  coord_y_norm = e.coord_y / bf.image_height::double precision
from public.base_floors bf
where e.coord_x is not null
  and e.coord_y is not null
  and e.coord_x_norm is null
  and e.coord_y_norm is null
  and e.floor_id = bf.id
  and bf.image_width > 0
  and bf.image_height > 0;

update public.extintores e
set
  coord_x_norm = e.coord_x / bf.image_width::double precision,
  coord_y_norm = e.coord_y / bf.image_height::double precision
from public.base_floors bf
where e.coord_x is not null
  and e.coord_y is not null
  and e.coord_x_norm is null
  and e.coord_y_norm is null
  and e.floor_id is null
  and e.base_id = bf.base_id
  and upper(trim(e.pavimento)) = upper(trim(bf.label))
  and bf.image_width > 0
  and bf.image_height > 0;

update public.hidrantes h
set
  coord_x_norm = h.coord_x / bf.image_width::double precision,
  coord_y_norm = h.coord_y / bf.image_height::double precision
from public.base_floors bf
where h.coord_x is not null
  and h.coord_y is not null
  and h.coord_x_norm is null
  and h.coord_y_norm is null
  and h.floor_id = bf.id
  and bf.image_width > 0
  and bf.image_height > 0;

update public.hidrantes h
set
  coord_x_norm = h.coord_x / bf.image_width::double precision,
  coord_y_norm = h.coord_y / bf.image_height::double precision
from public.base_floors bf
where h.coord_x is not null
  and h.coord_y is not null
  and h.coord_x_norm is null
  and h.coord_y_norm is null
  and h.floor_id is null
  and h.base_id = bf.base_id
  and upper(trim(h.pavimento)) = upper(trim(bf.label))
  and bf.image_width > 0
  and bf.image_height > 0;

-- Backfill floor_id por label do pavimento (mesma base)
update public.extintores e
set floor_id = bf.id
from public.base_floors bf
where e.floor_id is null
  and e.base_id = bf.base_id
  and e.pavimento is not null
  and trim(e.pavimento) <> ''
  and upper(trim(e.pavimento)) = upper(trim(bf.label));

update public.hidrantes h
set floor_id = bf.id
from public.base_floors bf
where h.floor_id is null
  and h.base_id = bf.base_id
  and h.pavimento is not null
  and trim(h.pavimento) <> ''
  and upper(trim(h.pavimento)) = upper(trim(bf.label));

update public.marcadores_emergencia m
set floor_id = bf.id
from public.base_floors bf
where m.floor_id is null
  and m.base_id = bf.base_id
  and m.pavimento is not null
  and trim(m.pavimento) <> ''
  and upper(trim(m.pavimento)) = upper(trim(bf.label));
