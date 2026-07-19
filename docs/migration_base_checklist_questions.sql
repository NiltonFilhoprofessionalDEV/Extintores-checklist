-- Perguntas de checklist configuráveis por base (extintor e hidrante).
-- Execute no SQL Editor do Supabase após multi-base / admin_corporativo.

create table if not exists public.base_checklist_questions (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases(id) on delete cascade,
  kind text not null check (kind in ('extintor', 'hidrante')),
  item_key text not null,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (base_id, kind, item_key)
);

create index if not exists idx_base_checklist_questions_base_kind
  on public.base_checklist_questions (base_id, kind, sort_order);

drop trigger if exists trg_base_checklist_questions_set_updated_at on public.base_checklist_questions;
create trigger trg_base_checklist_questions_set_updated_at
before update on public.base_checklist_questions
for each row
execute function public.set_updated_at();

alter table public.base_checklist_questions enable row level security;

drop policy if exists base_checklist_questions_select_accessible on public.base_checklist_questions;
create policy base_checklist_questions_select_accessible
on public.base_checklist_questions for select to authenticated
using (public.can_access_base(base_id));

drop policy if exists base_checklist_questions_write_admin on public.base_checklist_questions;
create policy base_checklist_questions_insert_admin
on public.base_checklist_questions for insert to authenticated
with check (public.is_admin_of_base(base_id));

drop policy if exists base_checklist_questions_update_admin on public.base_checklist_questions;
create policy base_checklist_questions_update_admin
on public.base_checklist_questions for update to authenticated
using (public.is_admin_of_base(base_id))
with check (public.is_admin_of_base(base_id));

drop policy if exists base_checklist_questions_delete_admin on public.base_checklist_questions;
create policy base_checklist_questions_delete_admin
on public.base_checklist_questions for delete to authenticated
using (public.is_admin_of_base(base_id));
