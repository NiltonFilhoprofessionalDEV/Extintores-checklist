-- Soft-delete de inventário + auditoria do app.
-- Execute no SQL Editor do Supabase.

-- ---------------------------------------------------------------------------
-- 1) Soft-delete em extintores / hidrantes
-- ---------------------------------------------------------------------------
alter table public.extintores
  add column if not exists active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references auth.users(id);

alter table public.hidrantes
  add column if not exists active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references auth.users(id);

create index if not exists idx_extintores_base_active
  on public.extintores (base_id, active);

create index if not exists idx_hidrantes_base_active
  on public.hidrantes (base_id, active);

-- ---------------------------------------------------------------------------
-- 2) Tabela de auditoria (linguagem humana na UI)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  base_id uuid references public.bases(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_nome text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_label text,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_base_created
  on public.audit_logs (base_id, created_at desc);

create index if not exists idx_audit_logs_action
  on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin
on public.audit_logs for select to authenticated
using (
  public.is_admin()
  and (base_id is null or public.can_access_base(base_id))
);

-- Inserts via service role (API). Sem insert autenticado direto.
drop policy if exists audit_logs_insert_none on public.audit_logs;
create policy audit_logs_insert_none
on public.audit_logs for insert to authenticated
with check (false);

drop policy if exists audit_logs_update_none on public.audit_logs;
create policy audit_logs_update_none
on public.audit_logs for update to authenticated
using (false);

drop policy if exists audit_logs_delete_none on public.audit_logs;
create policy audit_logs_delete_none
on public.audit_logs for delete to authenticated
using (false);
