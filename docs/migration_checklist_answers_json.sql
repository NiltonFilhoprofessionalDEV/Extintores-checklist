-- Respostas de campos customizados do checklist (além das colunas fixas).
-- Execute no SQL Editor do Supabase após migration_base_checklist_questions.sql.

alter table public.checklists
  add column if not exists answers_json jsonb not null default '{}'::jsonb;

alter table public.checklists_hidrantes
  add column if not exists answers_json jsonb not null default '{}'::jsonb;
