-- Corrige importação/cadastro de extintores e hidrantes com bases separadas.
-- Execute no SQL Editor do Supabase se a importação retornar erro de RLS.
--
-- Pré-requisitos: migration_multi_base.sql e migration_admin_corporativo.sql

-- Garante helpers atualizados (admin_corporativo incluído)
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

-- Extintores: admin / admin_corporativo com acesso à base
drop policy if exists extintores_insert_staff on public.extintores;
create policy extintores_insert_staff
on public.extintores for insert to authenticated
with check (public.is_admin_of_base(base_id));

drop policy if exists extintores_update_staff on public.extintores;
create policy extintores_update_staff
on public.extintores for update to authenticated
using (public.is_admin_of_base(base_id))
with check (public.is_admin_of_base(base_id));

drop policy if exists extintores_delete_staff on public.extintores;
create policy extintores_delete_staff
on public.extintores for delete to authenticated
using (public.is_admin_of_base(base_id));

-- Hidrantes: alinhar insert/update/delete ao mesmo critério
drop policy if exists hidrantes_insert_admin on public.hidrantes;
create policy hidrantes_insert_admin
on public.hidrantes for insert to authenticated
with check (public.is_admin_of_base(base_id));

drop policy if exists hidrantes_update_admin on public.hidrantes;
create policy hidrantes_update_admin
on public.hidrantes for update to authenticated
using (public.is_admin_of_base(base_id))
with check (public.is_admin_of_base(base_id));

drop policy if exists hidrantes_delete_admin on public.hidrantes;
create policy hidrantes_delete_admin
on public.hidrantes for delete to authenticated
using (public.is_admin_of_base(base_id));
