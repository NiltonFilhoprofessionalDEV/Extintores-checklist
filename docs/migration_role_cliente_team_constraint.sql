-- Permite perfil "cliente" sem equipe (mesma regra do admin).
-- Execute no SQL Editor do Supabase após migration_role_cliente.sql

alter table public.profiles
  drop constraint if exists profiles_team_required_for_non_admin;

alter table public.profiles
  add constraint profiles_team_required_for_non_admin
  check (role in ('admin', 'cliente') or team is not null);
