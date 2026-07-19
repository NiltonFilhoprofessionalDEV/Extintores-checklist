-- Multi-tenant: bases (aeroportos) isoladas
-- Passo 2/2 — execute DEPOIS de docs/migration_multi_base_enum.sql
-- (o valor de enum "corporativo" precisa estar commitado antes deste script).
-- Idempotente onde possível.

-- ---------------------------------------------------------------------------
-- 1) Tabelas de base / floors / memberships
-- ---------------------------------------------------------------------------
create table if not exists public.bases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.base_floors (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases(id) on delete cascade,
  key text not null,
  label text not null,
  sort_order integer not null default 0,
  image_path text not null,
  image_width integer not null default 14042,
  image_height integer not null default 9934,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (base_id, key)
);

create index if not exists idx_base_floors_base_id on public.base_floors (base_id);

create table if not exists public.base_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  base_id uuid not null references public.bases(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, base_id)
);

create index if not exists idx_base_memberships_base_id on public.base_memberships (base_id);

drop trigger if exists trg_bases_set_updated_at on public.bases;
create trigger trg_bases_set_updated_at
before update on public.bases
for each row
execute function public.set_updated_at();

drop trigger if exists trg_base_floors_set_updated_at on public.base_floors;
create trigger trg_base_floors_set_updated_at
before update on public.base_floors
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Seed base Santa Genoveva
-- ---------------------------------------------------------------------------
insert into public.bases (id, slug, nome, active, config)
values (
  'a0000000-0000-4000-8000-000000000001',
  'santa-genoveva',
  'Aeroporto Santa Genoveva',
  true,
  jsonb_build_object(
    'empresa_tabs', true,
    'equipes_conferencia', true
  )
)
on conflict (slug) do update
set nome = excluded.nome,
    active = excluded.active,
    config = excluded.config;

-- Resolve id estável (seed) ou existente por slug
do $$
declare
  v_base_id uuid;
begin
  select id into v_base_id from public.bases where slug = 'santa-genoveva';

  insert into public.base_floors (base_id, key, label, sort_order, image_path, image_width, image_height)
  values
    (v_base_id, 'terreo', 'Térreo', 0, '/maps/terreo', 14042, 9934),
    (v_base_id, 'pavimento_1', 'Pavimento 1', 1, '/maps/pavimento 1', 14042, 9934),
    (v_base_id, 'galeria_tecnica', 'Galeria Técnica', 2, '/maps/galeria_tecniica', 14042, 9934),
    (v_base_id, 'pavimento_tecnico', 'Pavimento Técnico', 3, '/maps/pavimento_tecnico', 14042, 9934),
    (v_base_id, 'subsolo', 'Subsolo', 4, '/maps/subsolo', 14042, 9934),
    (v_base_id, 'teca', 'TECA', 5, '/maps/teca', 14042, 9934),
    (v_base_id, 'tps_1', 'TPS 1', 6, '/maps/tps_1', 14042, 9934),
    (v_base_id, 'sci', 'SCI', 7, '/maps/sci', 14042, 9934),
    (v_base_id, 'other_places', 'Guaritas/Central de resíduos', 8, '/maps/other_places', 14042, 9934)
  on conflict (base_id, key) do update
  set label = excluded.label,
      sort_order = excluded.sort_order,
      image_path = excluded.image_path,
      image_width = excluded.image_width,
      image_height = excluded.image_height;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Colunas base_id
-- ---------------------------------------------------------------------------
alter table public.extintores add column if not exists base_id uuid references public.bases(id);
alter table public.hidrantes add column if not exists base_id uuid references public.bases(id);
alter table public.marcadores_emergencia add column if not exists base_id uuid references public.bases(id);
alter table public.checklists add column if not exists base_id uuid references public.bases(id);
alter table public.checklists_hidrantes add column if not exists base_id uuid references public.bases(id);
alter table public.inspecoes_marcadores_emergencia add column if not exists base_id uuid references public.bases(id);
alter table public.profiles add column if not exists base_id uuid references public.bases(id);

-- Backfill inventário / profiles → Santa Genoveva
update public.extintores e
set base_id = b.id
from public.bases b
where b.slug = 'santa-genoveva' and e.base_id is null;

update public.hidrantes h
set base_id = b.id
from public.bases b
where b.slug = 'santa-genoveva' and h.base_id is null;

update public.marcadores_emergencia m
set base_id = b.id
from public.bases b
where b.slug = 'santa-genoveva' and m.base_id is null;

update public.profiles p
set base_id = b.id
from public.bases b
where b.slug = 'santa-genoveva'
  and p.base_id is null
  and p.role::text <> 'corporativo';

update public.checklists c
set base_id = e.base_id
from public.extintores e
where c.extintor_id = e.id and c.base_id is null;

update public.checklists_hidrantes c
set base_id = h.base_id
from public.hidrantes h
where c.hidrante_id = h.id and c.base_id is null;

update public.inspecoes_marcadores_emergencia i
set base_id = m.base_id
from public.marcadores_emergencia m
where i.marcador_emergencia_id = m.id and i.base_id is null;

-- NOT NULL em inventário (após backfill)
alter table public.extintores alter column base_id set not null;
alter table public.hidrantes alter column base_id set not null;
alter table public.marcadores_emergencia alter column base_id set not null;

-- Profiles: staff precisa de base_id; corporativo pode ser null (usa memberships)
alter table public.profiles drop constraint if exists profiles_base_required_for_staff;
alter table public.profiles
  add constraint profiles_base_required_for_staff
  check (role::text = 'corporativo' or base_id is not null);

-- Team constraint: admin/cliente/corporativo podem sem team
-- Usa ::text para não depender de literal de enum na mesma sessão de migração.
alter table public.profiles drop constraint if exists profiles_team_required_for_non_admin;
alter table public.profiles
  add constraint profiles_team_required_for_non_admin
  check (role::text in ('admin', 'cliente', 'corporativo') or team is not null);

-- Uniques por base
drop index if exists public.idx_hidrantes_codigo_unique;
create unique index if not exists idx_hidrantes_base_codigo_unique
  on public.hidrantes (base_id, codigo);

create unique index if not exists idx_extintores_base_codigo_unique
  on public.extintores (base_id, codigo);

create index if not exists idx_extintores_base_id on public.extintores (base_id);
create index if not exists idx_hidrantes_base_id on public.hidrantes (base_id);
create index if not exists idx_marcadores_emergencia_base_id on public.marcadores_emergencia (base_id);
create index if not exists idx_checklists_base_id on public.checklists (base_id);
create index if not exists idx_checklists_hidrantes_base_id on public.checklists_hidrantes (base_id);
create index if not exists idx_inspecoes_marcadores_base_id on public.inspecoes_marcadores_emergencia (base_id);
create index if not exists idx_profiles_base_id on public.profiles (base_id);

-- ---------------------------------------------------------------------------
-- 4) Helpers RLS multi-base
-- ---------------------------------------------------------------------------
create or replace function public.user_base_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select array_agg(distinct bid)
      from (
        select p.base_id as bid
        from public.profiles p
        where p.id = auth.uid() and p.base_id is not null
        union
        select m.base_id as bid
        from public.base_memberships m
        where m.user_id = auth.uid()
      ) s
    ),
    '{}'::uuid[]
  );
$$;

create or replace function public.can_access_base(target_base_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_base_id is not null
    and target_base_id = any(public.user_base_ids());
$$;

create or replace function public.is_corporativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role()::text = 'corporativo', false);
$$;

create or replace function public.is_admin_of_base(target_base_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() and public.can_access_base(target_base_id);
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS bases / floors / memberships
-- ---------------------------------------------------------------------------
alter table public.bases enable row level security;
alter table public.base_floors enable row level security;
alter table public.base_memberships enable row level security;

drop policy if exists bases_select_accessible on public.bases;
create policy bases_select_accessible
on public.bases for select to authenticated
using (id = any(public.user_base_ids()));

drop policy if exists base_floors_select_accessible on public.base_floors;
create policy base_floors_select_accessible
on public.base_floors for select to authenticated
using (public.can_access_base(base_id));

drop policy if exists base_floors_write_admin on public.base_floors;
create policy base_floors_insert_admin
on public.base_floors for insert to authenticated
with check (public.is_admin_of_base(base_id));

drop policy if exists base_floors_update_admin on public.base_floors;
create policy base_floors_update_admin
on public.base_floors for update to authenticated
using (public.is_admin_of_base(base_id))
with check (public.is_admin_of_base(base_id));

drop policy if exists base_floors_delete_admin on public.base_floors;
create policy base_floors_delete_admin
on public.base_floors for delete to authenticated
using (public.is_admin_of_base(base_id));

drop policy if exists base_memberships_select_self_or_admin on public.base_memberships;
create policy base_memberships_select_self_or_admin
on public.base_memberships for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists base_memberships_write_admin on public.base_memberships;
create policy base_memberships_write_admin
on public.base_memberships for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6) RLS inventário escopado por base
-- ---------------------------------------------------------------------------
drop policy if exists extintores_select_authenticated on public.extintores;
create policy extintores_select_authenticated
on public.extintores for select to authenticated
using (public.can_access_base(base_id));

drop policy if exists extintores_insert_staff on public.extintores;
create policy extintores_insert_staff
on public.extintores for insert to authenticated
with check (
  public.is_admin_or_leadership()
  and public.can_access_base(base_id)
  and not public.is_corporativo()
);

drop policy if exists extintores_update_staff on public.extintores;
create policy extintores_update_staff
on public.extintores for update to authenticated
using (
  public.is_admin_or_leadership()
  and public.can_access_base(base_id)
  and not public.is_corporativo()
)
with check (
  public.is_admin_or_leadership()
  and public.can_access_base(base_id)
  and not public.is_corporativo()
);

drop policy if exists extintores_delete_staff on public.extintores;
create policy extintores_delete_staff
on public.extintores for delete to authenticated
using (
  public.is_admin_or_leadership()
  and public.can_access_base(base_id)
  and not public.is_corporativo()
);

drop policy if exists extintores_update_user_coords on public.extintores;
create policy extintores_update_user_coords
on public.extintores for update to authenticated
using (
  public.can_access_base(base_id)
  and public.current_role() in ('admin', 'leadership', 'user')
)
with check (
  public.can_access_base(base_id)
  and public.current_role() in ('admin', 'leadership', 'user')
);

drop policy if exists checklists_select_authenticated on public.checklists;
create policy checklists_select_authenticated
on public.checklists for select to authenticated
using (
  public.can_access_base(base_id)
  or exists (
    select 1 from public.extintores e
    where e.id = extintor_id and public.can_access_base(e.base_id)
  )
);

drop policy if exists checklists_insert_authenticated on public.checklists;
create policy checklists_insert_authenticated
on public.checklists for insert to authenticated
with check (
  not public.is_corporativo()
  and (
    public.can_access_base(base_id)
    or exists (
      select 1 from public.extintores e
      where e.id = extintor_id and public.can_access_base(e.base_id)
    )
  )
);

drop policy if exists hidrantes_select_authenticated on public.hidrantes;
create policy hidrantes_select_authenticated
on public.hidrantes for select to authenticated
using (public.can_access_base(base_id));

drop policy if exists hidrantes_insert_admin on public.hidrantes;
create policy hidrantes_insert_admin
on public.hidrantes for insert to authenticated
with check (public.is_admin_of_base(base_id));

drop policy if exists hidrantes_update_admin on public.hidrantes;
create policy hidrantes_update_admin
on public.hidrantes for update to authenticated
using (public.is_admin_of_base(base_id))
with check (public.is_admin_of_base(base_id));

drop policy if exists checklists_hidrantes_select_authenticated on public.checklists_hidrantes;
create policy checklists_hidrantes_select_authenticated
on public.checklists_hidrantes for select to authenticated
using (
  public.can_access_base(base_id)
  or exists (
    select 1 from public.hidrantes h
    where h.id = hidrante_id and public.can_access_base(h.base_id)
  )
);

drop policy if exists checklists_hidrantes_insert_authenticated on public.checklists_hidrantes;
create policy checklists_hidrantes_insert_authenticated
on public.checklists_hidrantes for insert to authenticated
with check (
  auth.uid() is not null
  and not public.is_corporativo()
  and (
    public.can_access_base(base_id)
    or exists (
      select 1 from public.hidrantes h
      where h.id = hidrante_id and public.can_access_base(h.base_id)
    )
  )
);

drop policy if exists marcadores_emergencia_select_authenticated on public.marcadores_emergencia;
create policy marcadores_emergencia_select_authenticated
on public.marcadores_emergencia for select to authenticated
using (public.can_access_base(base_id));

drop policy if exists marcadores_emergencia_insert_admin on public.marcadores_emergencia;
create policy marcadores_emergencia_insert_admin
on public.marcadores_emergencia for insert to authenticated
with check (public.is_admin_of_base(base_id));

drop policy if exists marcadores_emergencia_update_authenticated on public.marcadores_emergencia;
create policy marcadores_emergencia_update_authenticated
on public.marcadores_emergencia for update to authenticated
using (
  auth.uid() is not null
  and public.can_access_base(base_id)
  and not public.is_corporativo()
)
with check (
  auth.uid() is not null
  and public.can_access_base(base_id)
  and not public.is_corporativo()
);

drop policy if exists marcadores_emergencia_delete_admin on public.marcadores_emergencia;
create policy marcadores_emergencia_delete_admin
on public.marcadores_emergencia for delete to authenticated
using (public.is_admin_of_base(base_id));

drop policy if exists inspecoes_marcadores_emergencia_select_authenticated on public.inspecoes_marcadores_emergencia;
create policy inspecoes_marcadores_emergencia_select_authenticated
on public.inspecoes_marcadores_emergencia for select to authenticated
using (
  public.can_access_base(base_id)
  or exists (
    select 1 from public.marcadores_emergencia m
    where m.id = marcador_emergencia_id and public.can_access_base(m.base_id)
  )
);

drop policy if exists inspecoes_marcadores_emergencia_insert_authenticated on public.inspecoes_marcadores_emergencia;
create policy inspecoes_marcadores_emergencia_insert_authenticated
on public.inspecoes_marcadores_emergencia for insert to authenticated
with check (
  auth.uid() is not null
  and not public.is_corporativo()
  and (
    public.can_access_base(base_id)
    or exists (
      select 1 from public.marcadores_emergencia m
      where m.id = marcador_emergencia_id and public.can_access_base(m.base_id)
    )
  )
);

-- Profiles: ver self, admin da mesma base, ou corporativo só self
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or (
    public.is_admin()
    and (
      base_id is not null and public.can_access_base(base_id)
    )
  )
  or (
    public.is_admin_or_leadership()
    and base_id is not null
    and public.can_access_base(base_id)
  )
);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
on public.profiles for insert to authenticated
with check (public.is_admin());
