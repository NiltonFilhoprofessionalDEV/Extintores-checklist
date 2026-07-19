-- Passo 2/2 — Administrador Corporativo
-- Execute DEPOIS de docs/migration_admin_corporativo_enum.sql
--
-- Papéis:
--   admin              → uma base (profiles.base_id), gestão completa da base
--   corporativo        → várias bases (memberships), somente consulta
--   admin_corporativo  → várias bases (memberships), gestão completa

-- ---------------------------------------------------------------------------
-- 1) Constraints de profiles
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_base_required_for_staff;
alter table public.profiles
  add constraint profiles_base_required_for_staff
  check (role::text in ('corporativo', 'admin_corporativo') or base_id is not null);

alter table public.profiles drop constraint if exists profiles_team_required_for_non_admin;
alter table public.profiles
  add constraint profiles_team_required_for_non_admin
  check (
    role::text in ('admin', 'admin_corporativo', 'cliente', 'corporativo')
    or team is not null
  );

-- ---------------------------------------------------------------------------
-- 2) Helpers: admin inclui admin_corporativo
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role()::text in ('admin', 'admin_corporativo'), false);
$$;

create or replace function public.is_admin_or_leadership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_role()::text in ('admin', 'admin_corporativo', 'leadership'),
    false
  );
$$;

-- Somente o corporativo "consulta" (não o admin_corporativo)
create or replace function public.is_corporativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role()::text = 'corporativo', false);
$$;

create or replace function public.is_admin_corporativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role()::text = 'admin_corporativo', false);
$$;

-- Admin de base: admin da home base OU admin_corporativo com membership
create or replace function public.is_admin_of_base(target_base_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() and public.can_access_base(target_base_id);
$$;
