-- Adiciona Nº do cilindro no cadastro de extintores.
-- Execute no SQL Editor do Supabase.

alter table public.extintores
  add column if not exists num_cilindro text;

comment on column public.extintores.num_cilindro is 'Número do cilindro do extintor';
