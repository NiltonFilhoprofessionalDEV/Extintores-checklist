-- Schema inicial para o projeto de Gestão de Extintores
-- Execute no SQL Editor do Supabase

create extension if not exists "pgcrypto";

create table if not exists public.extintores (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  setor text not null,
  local_detalhado text not null,
  num_inmetro text not null,
  tipo text not null,
  tamanho text not null,
  capacidade_extintora text not null,
  manutencao_2_nivel date,
  manutencao_3_nivel date,
  coord_x double precision,
  coord_y double precision,
  pavimento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_extintores_codigo on public.extintores (codigo);
create index if not exists idx_extintores_pavimento on public.extintores (pavimento);
create index if not exists idx_extintores_coords on public.extintores (coord_x, coord_y);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  extintor_id uuid not null references public.extintores(id) on delete cascade,
  data_conferencia timestamptz not null default now(),
  conferente text not null,
  -- Legacy boolean fields kept for compatibility
  status_lacre boolean not null default true,
  status_manometro boolean not null default true,
  -- Detailed checklist items (conforme | nao_conforme | nao_aplica)
  local_correto text,
  dados_corretos text,
  sinalizacao_correta text,
  mangueira_status text,
  bico_difusor_status text,
  alca_gatilho_status text,
  medidor_pressao_status text,
  cilindro_status text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- Migration: add new checklist columns if they don't exist yet
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='checklists' and column_name='local_correto') then
    alter table public.checklists
      add column local_correto text,
      add column dados_corretos text,
      add column sinalizacao_correta text,
      add column mangueira_status text,
      add column bico_difusor_status text,
      add column alca_gatilho_status text,
      add column medidor_pressao_status text,
      add column cilindro_status text;
  end if;
end $$;

create index if not exists idx_checklists_extintor_id on public.checklists (extintor_id);
create index if not exists idx_checklists_data on public.checklists (data_conferencia desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_extintores_set_updated_at on public.extintores;
create trigger trg_extintores_set_updated_at
before update on public.extintores
for each row
execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role'
      and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('admin', 'leadership', 'user', 'cliente');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  role public.user_role not null default 'user',
  team text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_team_allowed
    check (team is null or team in ('ALFA', 'BRAVO', 'CHARLIE', 'DELTA')),
  constraint profiles_team_required_for_non_admin
    check (role in ('admin', 'cliente') or team is not null)
);

create index if not exists idx_profiles_team on public.profiles (team);

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.prevent_profile_privilege_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
    and not public.is_admin()
    and (
      new.role is distinct from old.role
      or new.active is distinct from old.active
      or new.team is distinct from old.team
    )
  then
    raise exception 'Perfil, status e equipe não podem ser alterados pelo próprio usuário.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_privilege_self_update on public.profiles;
create trigger trg_profiles_prevent_privilege_self_update
before update on public.profiles
for each row
execute function public.prevent_profile_privilege_self_update();

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

create or replace function public.is_admin_or_leadership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('admin', 'leadership'), false);
$$;

-- Segurança com RBAC
alter table public.extintores enable row level security;
alter table public.checklists enable row level security;
alter table public.profiles enable row level security;

drop policy if exists extintores_select_authenticated on public.extintores;
create policy extintores_select_authenticated
on public.extintores
for select
to authenticated
using (true);

drop policy if exists extintores_insert_admin on public.extintores;
drop policy if exists extintores_insert_staff on public.extintores;
create policy extintores_insert_staff
on public.extintores
for insert
to authenticated
with check (public.is_admin_or_leadership());

drop policy if exists extintores_update_admin on public.extintores;
drop policy if exists extintores_update_staff on public.extintores;
create policy extintores_update_staff
on public.extintores
for update
to authenticated
using (public.is_admin_or_leadership())
with check (public.is_admin_or_leadership());

drop policy if exists extintores_delete_staff on public.extintores;
create policy extintores_delete_staff
on public.extintores
for delete
to authenticated
using (public.is_admin_or_leadership());

drop policy if exists extintores_update_user_coords on public.extintores;
create policy extintores_update_user_coords
on public.extintores
for update
to authenticated
using (true)
with check (true);

drop policy if exists checklists_select_authenticated on public.checklists;
create policy checklists_select_authenticated
on public.checklists
for select
to authenticated
using (true);

drop policy if exists checklists_insert_authenticated on public.checklists;
create policy checklists_insert_authenticated
on public.checklists
for insert
to authenticated
with check (true);

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
on public.profiles
for insert
to authenticated
with check (public.is_admin());
