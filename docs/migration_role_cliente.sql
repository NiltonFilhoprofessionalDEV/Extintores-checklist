-- Adiciona o perfil "cliente" (acesso somente leitura ao painel) ao enum user_role
-- Execute no SQL Editor do Supabase

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role'
      AND e.enumlabel = 'cliente'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'cliente';
  END IF;
END
$$;

-- Cliente não pertence a equipe operacional (como admin)
alter table public.profiles
  drop constraint if exists profiles_team_required_for_non_admin;

alter table public.profiles
  add constraint profiles_team_required_for_non_admin
  check (role in ('admin', 'cliente') or team is not null);
